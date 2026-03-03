const { pipeline } = require('@xenova/transformers');
const axios = require('axios');
const { query, vectorSearch } = require('../config/database');
const { getBotSession, setBotSession } = require('../config/redis');
const { logger, logPerformance } = require('../config/logger');
const crypto = require('crypto');

const OLLAMA_HOST =
  process.env.OLLAMA_HOST ||
  process.env.OLLAMA_BASE_URL ||
  process.env.OLLAMA_URL ||
  'http://localhost:11434';
  
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3.1:8b';
const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL || 'Xenova/all-MiniLM-L6-v2';
const OLLAMA_TIMEOUT_MS = parseInt(process.env.OLLAMA_TIMEOUT_MS || '12000', 10);
const AI_PROVIDER = (process.env.AI_PROVIDER || 'ollama').toLowerCase();
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4.1-mini';
const OPENAI_BASE_URL = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
const OPENAI_TIMEOUT_MS = parseInt(process.env.OPENAI_TIMEOUT_MS || '20000', 10);

// Embedding model instance
let embeddingPipeline = null;
let botHistoryTableReady = false;
const tableExistsCache = new Map();

const {
  getPrompt,
  detectIntent,
  formatMessagesAsList,
  formatMessagesAsTranscript,
  PROMPT_DETECT_LANGUAGE,
  PROMPT_TRANSLATE,
  PROMPT_TRANSLATE_AND_ANALYSE,
  PROMPT_SUMMARISE_IN_LANGUAGE,
} = require('./prompt');

function isMissingRelation(error, relationName) {
  return (
    error &&
    error.code === '42P01' &&
    typeof error.message === 'string' &&
    error.message.includes(`"${relationName}"`)
  );
}

function resolveProvider() {
  return 'ollama';
}

async function tableExists(tableName) {
  if (tableExistsCache.has(tableName)) {
    return tableExistsCache.get(tableName);
  }

  const result = await query('SELECT to_regclass($1) AS reg', [`public.${tableName}`]);
  const exists = !!(result.rows && result.rows[0] && result.rows[0].reg);
  tableExistsCache.set(tableName, exists);
  return exists;
}

function isTranslationQuery(question) {
  const q = String(question || '').toLowerCase();
  return (
    q.includes('translate') ||
    q.includes('translation') ||
    q.includes('convert to') ||
    q.includes('in english') ||
    q.includes('in tamil') ||
    q.includes('in hindi') ||
    q.includes('in spanish') ||
    q.includes('in french') ||
    q.includes('in arabic') ||
    q.includes('in german') ||
    q.includes('in japanese') ||
    q.includes('in chinese') ||
    q.includes('in korean') ||
    q.includes('in portuguese') ||
    q.includes('in russian') ||
    /translate\s+(?:this|the|these|messages?|chat|text)?(?:\s+(?:to|into)\s+(\w+))?/i.test(q) ||
    /(?:to|into)\s+(english|tamil|hindi|spanish|french|arabic|german|japanese|chinese|korean|portuguese|russian)\b/i.test(q)
  );
}

function extractTargetLanguage(question) {
  const q = String(question || '').toLowerCase();
  const match = q.match(
    /(?:translate|convert|in|into|to)\s+(english|tamil|hindi|spanish|french|arabic|german|japanese|chinese|korean|portuguese|russian|telugu|kannada|malayalam|bengali|marathi|punjabi|urdu|turkish|italian|dutch|greek|hebrew|thai|vietnamese|indonesian|malay|swahili)\b/i
  );
  if (match && match[1]) {
    return match[1].charAt(0).toUpperCase() + match[1].slice(1);
  }
  // Default target language is English
  return 'English';
}

function isLanguageFilterQuery(question) {
  const q = String(question || '').toLowerCase();
  // e.g. "summarize tamil messages", "analyse hindi messages in english"
  return (
    /\b(tamil|hindi|spanish|french|arabic|german|japanese|chinese|korean|portuguese|russian|telugu|kannada|malayalam|bengali|marathi|punjabi|urdu|turkish|italian|dutch|greek|hebrew|thai|vietnamese|indonesian|malay|swahili)\s+(messages?|chats?|texts?)\b/i.test(q) ||
    /\b(messages?|chats?|texts?)\s+in\s+(tamil|hindi|spanish|french|arabic|german|japanese|chinese|korean|portuguese|russian|telugu|kannada|malayalam|bengali|marathi|punjabi|urdu|turkish|italian|dutch|greek|hebrew|thai|vietnamese|indonesian|malay|swahili)\b/i.test(q)
  );
}

function extractSourceLanguage(question) {
  const q = String(question || '');
  const match = q.match(
    /\b(tamil|hindi|spanish|french|arabic|german|japanese|chinese|korean|portuguese|russian|telugu|kannada|malayalam|bengali|marathi|punjabi|urdu|turkish|italian|dutch|greek|hebrew|thai|vietnamese|indonesian|malay|swahili)\b/i
  );
  if (match && match[1]) {
    return match[1].charAt(0).toUpperCase() + match[1].slice(1);
  }
  return null;
}

async function detectLanguageOfMessages(messages) {
  const sample = messages
    .filter(m => !isLowSignalMessage(m.content) && m.content.length > 10)
    .slice(0, 5)
    .map(m => m.content)
    .join(' ');

  if (!sample.trim()) return 'Unknown';

  // Try heuristic first — instant and reliable for non-Latin scripts
  const heuristic = detectLanguageHeuristic(sample);
  if (heuristic !== 'Unknown') return heuristic;

  return await safeDetectLanguage(sample);
}

async function translateText(text, sourceLang, targetLang) {
  return safeTranslateText(text, sourceLang, targetLang);
}

async function detectLanguageOfText(text) {
  const heuristic = detectLanguageHeuristic(text);
  if (heuristic !== 'Unknown') return heuristic;
  return await safeDetectLanguage(text);
}


function extractInlineTextToTranslate(question) {
  const q = String(question || '').trim();

  // Match: "translate <content> to <lang>" or "translate <content>"
  // Strips leading "translate" keyword and trailing "to <language>"
  const match = q.match(
    /^translate\s+(.+?)(?:\s+to\s+(?:english|tamil|hindi|spanish|french|arabic|german|japanese|chinese|korean|portuguese|russian|telugu|kannada|malayalam|bengali|marathi|punjabi|urdu|turkish|italian|dutch|greek|hebrew|thai|vietnamese|indonesian|malay|swahili))?$/is
  );
  if (match && match[1]) {
    const content = match[1].trim();
    // Must be non-trivial (more than just a language name or keyword)
    if (content.length > 10 && !/^(this|the|these|messages?|chat|text|community)$/i.test(content)) {
      return content;
    }
  }
  return '';
}

function chunkText(text, maxChars = 800) {
  const chunks = [];
  let start = 0;
  while (start < text.length) {
    chunks.push(text.slice(start, start + maxChars));
    start += maxChars;
  }
  return chunks;
}

async function safeDetectLanguage(text) {
  // Use only first 300 chars for detection — avoids Ollama 500 on long Unicode
  const sample = String(text || '').trim().slice(0, 300);
  if (!sample) return 'Unknown';

  try {
    const prompt = PROMPT_DETECT_LANGUAGE(sample);
    const result = await queryLLM(prompt, null, 0.1);
    const lang = String(result?.response || '').trim().split('\n')[0].trim();
    return lang || 'Unknown';
  } catch (error) {
    logger.warn('Language detection failed, trying heuristic', { error: error.message });
    return detectLanguageHeuristic(sample);
  }
}

function detectLanguageHeuristic(text) {
  const t = String(text || '');
  // Unicode range checks for common scripts
  if (/[\u0900-\u097F]/.test(t)) return 'Hindi';      // Devanagari
  if (/[\u0B80-\u0BFF]/.test(t)) return 'Tamil';
  if (/[\u0600-\u06FF]/.test(t)) return 'Arabic';
  if (/[\u0400-\u04FF]/.test(t)) return 'Russian';
  if (/[\u4E00-\u9FFF]/.test(t)) return 'Chinese';
  if (/[\u3040-\u30FF]/.test(t)) return 'Japanese';
  if (/[\uAC00-\uD7AF]/.test(t)) return 'Korean';
  if (/[\u0370-\u03FF]/.test(t)) return 'Greek';
  if (/[\u0590-\u05FF]/.test(t)) return 'Hebrew';
  if (/[\u0E00-\u0E7F]/.test(t)) return 'Thai';
  if (/[\u0C00-\u0C7F]/.test(t)) return 'Telugu';
  if (/[\u0C80-\u0CFF]/.test(t)) return 'Kannada';
  if (/[\u0D00-\u0D7F]/.test(t)) return 'Malayalam';
  if (/[\u0980-\u09FF]/.test(t)) return 'Bengali';
  return 'Unknown';
}

async function safeTranslateText(text, sourceLang, targetLang) {
  if (!text || !text.trim()) return '';
  if (sourceLang === targetLang) return text;

  // Smaller chunks for non-Latin scripts to avoid Ollama 500
  const isNonLatin = /[\u0900-\u097F\u0B80-\u0BFF\u0600-\u06FF\u4E00-\u9FFF\u3040-\u30FF\uAC00-\uD7AF]/.test(text);
  const chunkSize = isNonLatin ? 400 : 800;

  const chunks = chunkText(text, chunkSize);
  const translatedChunks = [];

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    let translated = null;

    // Try up to 2 attempts per chunk
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        // Use simpler prompt for non-Latin to reduce Ollama confusion
        const prompt = isNonLatin
          ? `Translate this ${sourceLang} text to ${targetLang}. Output ONLY the ${targetLang} translation, nothing else:\n\n${chunk}`
          : PROMPT_TRANSLATE(chunk, sourceLang, targetLang);

        const result = await queryLLM(prompt, null, 0.1);
        const raw = String(result?.response || '').trim();

        if (raw && !isLimitMessage(raw) && raw !== chunk) {
          translated = raw;
          break;
        }

        // If model echoed back the source text, retry with even simpler prompt
        if (attempt === 1) {
          logger.warn('Model echoed source text, retrying with minimal prompt', {
            chunkLength: chunk.length,
            sourceLang,
            targetLang,
          });
          await new Promise(r => setTimeout(r, 500));
        }
      } catch (error) {
        logger.error('Chunk translation error', {
          error: error.message,
          chunkLength: chunk.length,
          attempt,
        });
        if (attempt < 2) await new Promise(r => setTimeout(r, 800));
      }
    }

    translatedChunks.push(translated || chunk);

    // Delay between chunks to avoid overwhelming Ollama
    if (chunks.length > 1 && i < chunks.length - 1) {
      await new Promise(r => setTimeout(r, 400));
    }
  }

  return translatedChunks.join(' ');
}
async function handleTranslationQuery(question, communityId) {
  const targetLang = extractTargetLanguage(question);
  try {
    await axios.get(`${OLLAMA_HOST}/api/tags`, { timeout: 3000 });
  } catch (healthError) {
    return {
      answer: 'Translation service is currently unavailable. Please ensure Ollama is running.',
      sources: [],
      confidence: 0,
      sourceCount: 0,
      status: 'ollama_unavailable',
    };
  }
  // Priority 1: Inline text in the query itself (e.g. "translate <hindi text> to english")
  const inlineText = extractInlineTextToTranslate(question);
  if (inlineText) {
    // Use heuristic first (instant, no LLM call needed)
    let sourceLang = detectLanguageHeuristic(inlineText);
    if (sourceLang === 'Unknown') {
      sourceLang = await safeDetectLanguage(inlineText);
    }

    const translated = await safeTranslateText(inlineText, sourceLang, targetLang);
    return {
      answer: `**Detected Language:** ${sourceLang}\n\n**Translation (${targetLang}):**\n${translated}`,
      sources: [],
      confidence: 88,
      sourceCount: 1,
      status: 'translation_success',
    };
  }

  // Priority 2: Quoted text in question
  const quoted = extractQuotedQuestionText(question);
  if (quoted && quoted.length > 10) {
    let sourceLang = detectLanguageHeuristic(quoted);
    if (sourceLang === 'Unknown') {
      sourceLang = await safeDetectLanguage(quoted);
    }
    const translated = await safeTranslateText(quoted, sourceLang, targetLang);
    return {
      answer: `**Detected Language:** ${sourceLang}\n\n**Translation (${targetLang}):**\n${translated}`,
      sources: [],
      confidence: 85,
      sourceCount: 1,
      status: 'translation_success',
    };
  }

  // Priority 3: Translate community chat messages
  const messages = await fetchCommunityChatMessages(communityId, question);

  if (!messages.length) {
    return {
      answer: `No messages found to translate for the requested time range.`,
      sources: [],
      confidence: 0,
      sourceCount: 0,
      status: 'no_chat_messages',
    };
  }

  // Detect language from message sample using heuristic first
  const sampleContent = messages.slice(0, 5).map(m => m.content).join(' ');
  let detectedLang = detectLanguageHeuristic(sampleContent);
  if (detectedLang === 'Unknown') {
    detectedLang = await safeDetectLanguage(sampleContent);
  }

  const messagesList = formatMessagesAsList(messages);

  try {
    const prompt = PROMPT_TRANSLATE_AND_ANALYSE(messagesList, detectedLang, targetLang, question);
    const result = await queryLLM(prompt, null, 0.25);
    const answer = String(result?.response || '').trim();

    if (answer && !isLimitMessage(answer)) {
      return {
        answer,
        sources: messages.slice(-5).map((m, idx) => ({
          id: `chat-${idx}`,
          title: `Chat message (${new Date(m.created_at).toLocaleString('en-US')})`,
          similarity: null,
        })),
        confidence: 80,
        sourceCount: messages.length,
        status: 'translation_success',
      };
    }
  } catch (error) {
    logger.error('Translate and analyse failed', { error: error.message });
  }

  // Deterministic fallback: translate messages one by one
  const translatedLines = [];
  for (let i = 0; i < Math.min(messages.length, 20); i++) {
    const m = messages[i];
    const translated = await safeTranslateText(m.content, detectedLang, targetLang);
    translatedLines.push(`${i + 1}. ${translated}`);
  }

  return {
    answer: `### Translated Messages (${detectedLang} → ${targetLang}):\n${translatedLines.join('\n')}`,
    sources: messages.slice(-5).map((m, idx) => ({
      id: `chat-${idx}`,
      title: `Chat message (${new Date(m.created_at).toLocaleString('en-US')})`,
      similarity: null,
    })),
    confidence: 65,
    sourceCount: messages.length,
    status: 'translation_deterministic',
  };
}


async function handleLanguageFilterQuery(question, communityId) {
  const sourceLang = extractSourceLanguage(question);
  const targetLang = extractTargetLanguage(question);
  const messages = await fetchCommunityChatMessages(communityId, question);

  if (!messages.length) {
    return {
      answer: `No ${sourceLang || ''} messages found for the requested time range.`.trim(),
      sources: [],
      confidence: 0,
      sourceCount: 0,
      status: 'no_chat_messages',
    };
  }

  const transcript = formatMessagesAsTranscript(messages);

  try {
    const prompt = PROMPT_SUMMARISE_IN_LANGUAGE(transcript, targetLang, question);
    const result = await queryLLM(prompt, null, 0.3);
    const answer = String(result?.response || '').trim();

    if (answer && !isLimitMessage(answer)) {
      return {
        answer,
        sources: messages.slice(-5).map((m, idx) => ({
          id: `chat-${idx}`,
          title: `Chat message (${new Date(m.created_at).toLocaleString('en-US')})`,
          similarity: null,
        })),
        confidence: 78,
        sourceCount: messages.length,
        status: 'language_filter_success',
      };
    }
  } catch (error) {
    logger.error('Language filter query failed', { error: error.message });
  }

  return {
    answer: `Could not analyse ${sourceLang || 'the'} messages. Please try again.`,
    sources: [],
    confidence: 0,
    sourceCount: messages.length,
    status: 'language_filter_failed',
  };
}

function getDateFilterConfig(question) {
  const q = String(question || '').toLowerCase();
  const compactQ = q.replace(/\s+/g, ' ').trim();
  const now = new Date();
  const monthMap = {
    jan: 0,
    january: 0,
    feb: 1,
    february: 1,
    mar: 2,
    march: 2,
    apr: 3,
    april: 3,
    may: 4,
    jun: 5,
    june: 5,
    jul: 6,
    july: 6,
    aug: 7,
    august: 7,
    sep: 8,
    sept: 8,
    september: 8,
    oct: 9,
    october: 9,
    nov: 10,
    november: 10,
    dec: 11,
    december: 11,
  };
  const numberWords = {
    one: 1,
    two: 2,
    three: 3,
    four: 4,
    five: 5,
    six: 6,
    seven: 7,
    eight: 8,
    nine: 9,
    ten: 10,
  };

  const toNumber = (value) => {
    if (!value) return null;
    const v = String(value).toLowerCase();
    if (/^\d+$/.test(v)) return parseInt(v, 10);
    return numberWords[v] || null;
  };

  if (compactQ.includes('today') || /\boday\b/.test(compactQ)) {
    return { mode: 'day', daysAgo: 0 };
  }
  if (compactQ.includes('yesterday') || compactQ.includes('yester day')) {
    return { mode: 'day', daysAgo: 1 };
  }
  if (
    compactQ.includes('day before yesterday') ||
    compactQ.includes('day before yester day')
  ) {
    return { mode: 'day', daysAgo: 2 };
  }

  // Matches: "2 days ago", "2 day ago", "2days before", "2 days befor"
  const daysAgoMatch = compactQ.match(/\b(\d+)\s*day[s]?\s*(ago|before|befor)\b/);
  if (daysAgoMatch) {
    const daysAgo = parseInt(daysAgoMatch[1], 10);
    if (!Number.isNaN(daysAgo) && daysAgo >= 0) {
      return { mode: 'day', daysAgo };
    }
  }

  // Matches: "two days before", "three day ago"
  const wordDaysAgoMatch = compactQ.match(
    /\b(one|two|three|four|five|six|seven|eight|nine|ten)\s*day[s]?\s*(ago|before|befor)\b/
  );
  if (wordDaysAgoMatch) {
    const daysAgo = numberWords[wordDaysAgoMatch[1]];
    if (daysAgo >= 0) {
      return { mode: 'day', daysAgo };
    }
  }

  // Rolling windows: "1 week fully", "1 month full", "1 year"
  const rollingMatch = compactQ.match(
    /\b(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s*(day|week|month|moth|year)[s]?\b/
  );
  if (rollingMatch) {
    const amount = toNumber(rollingMatch[1]);
    const unitRaw = rollingMatch[2];
    const unit = unitRaw === 'moth' ? 'month' : unitRaw;
    if (amount && amount > 0) {
      return {
        mode: 'rolling_period',
        amount,
        unit,
        label: `${amount} ${unit}${amount > 1 ? 's' : ''}`,
      };
    }
  }

  // "this week/month/year", "last week/month/year"
  const thisPeriodMatch = compactQ.match(/\bthis\s+(week|month|year)\b/);
  if (thisPeriodMatch) {
    return {
      mode: 'calendar_period',
      periodKind: thisPeriodMatch[1],
      periodOffset: 0,
      label: `this ${thisPeriodMatch[1]}`,
    };
  }
  const lastPeriodMatch = compactQ.match(/\blast\s+(week|month|year)\b/);
  if (lastPeriodMatch) {
    return {
      mode: 'calendar_period',
      periodKind: lastPeriodMatch[1],
      periodOffset: -1,
      label: `last ${lastPeriodMatch[1]}`,
    };
  }

  const weekdays = {
    sunday: 0,
    monday: 1,
    tuesday: 2,
    wednesday: 3,
    thursday: 4,
    friday: 5,
    saturday: 6,
  };
  const weekdayName = Object.keys(weekdays).find((d) => compactQ.includes(d));
  if (weekdayName) {
    return {
      mode: 'weekday',
      weekday: weekdays[weekdayName],
      label: weekdayName,
    };
  }

  const makeDateFilter = (year, monthIndex, day) => {
    if (
      Number.isNaN(year) ||
      Number.isNaN(monthIndex) ||
      Number.isNaN(day) ||
      monthIndex < 0 ||
      monthIndex > 11 ||
      day < 1 ||
      day > 31
    ) {
      return null;
    }
    const dt = new Date(year, monthIndex, day);
    if (
      dt.getFullYear() !== year ||
      dt.getMonth() !== monthIndex ||
      dt.getDate() !== day
    ) {
      return null;
    }
    const isoDate = `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return {
      mode: 'calendar_date',
      isoDate,
      label: dt.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }),
    };
  };

  // yyyy-mm-dd
  const isoMatch = compactQ.match(/\b(20\d{2})-(\d{1,2})-(\d{1,2})\b/);
  if (isoMatch) {
    const y = parseInt(isoMatch[1], 10);
    const m = parseInt(isoMatch[2], 10) - 1;
    const d = parseInt(isoMatch[3], 10);
    const filter = makeDateFilter(y, m, d);
    if (filter) return filter;
  }

  // month name + day [+ year], e.g. "feb 4", "on february 4 2026"
  const monthNameMatch = compactQ.match(
    /\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+(\d{1,2})(?:,?\s*(20\d{2}))?\b/
  );
  if (monthNameMatch) {
    const monthIndex = monthMap[monthNameMatch[1]];
    const day = parseInt(monthNameMatch[2], 10);
    let year = monthNameMatch[3] ? parseInt(monthNameMatch[3], 10) : now.getFullYear();
    let filter = makeDateFilter(year, monthIndex, day);
    if (!monthNameMatch[3] && filter) {
      // If inferred date is in the future, use previous year.
      if (new Date(filter.isoDate) > now) {
        year -= 1;
        filter = makeDateFilter(year, monthIndex, day);
      }
    }
    if (filter) return filter;
  }

  // MM/DD[/YYYY], US format
  const slashDateMatch = compactQ.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(20\d{2}))?\b/);
  if (slashDateMatch) {
    const monthIndex = parseInt(slashDateMatch[1], 10) - 1;
    const day = parseInt(slashDateMatch[2], 10);
    let year = slashDateMatch[3] ? parseInt(slashDateMatch[3], 10) : now.getFullYear();
    let filter = makeDateFilter(year, monthIndex, day);
    if (!slashDateMatch[3] && filter) {
      if (new Date(filter.isoDate) > now) {
        year -= 1;
        filter = makeDateFilter(year, monthIndex, day);
      }
    }
    if (filter) return filter;
  }

  // Default: rolling last 24 hours
  return { mode: 'last24h', daysAgo: 0 };
}

function getCalendarPeriodRange(periodKind, offset = 0) {
  const now = new Date();
  const start = new Date(now);

  if (periodKind === 'week') {
    const day = start.getDay(); // 0 Sun ... 6 Sat
    start.setDate(start.getDate() - day + offset * 7);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 7);
    return { start, end };
  }

  if (periodKind === 'month') {
    start.setDate(1);
    start.setMonth(start.getMonth() + offset);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setMonth(end.getMonth() + 1);
    return { start, end };
  }

  // year
  start.setMonth(0, 1);
  start.setFullYear(start.getFullYear() + offset);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setFullYear(end.getFullYear() + 1);
  return { start, end };
}

function isLowSignalMessage(content) {
  const text = String(content || '').trim().toLowerCase();
  if (!text) return true;

  // Ignore short greetings/check-ins so summary focuses on important content.
  const lowSignalPatterns = [
    /^h+i+$/,
    /^hi+$/,
    /^hello+$/,
    /^hey+$/,
    /^gm$/,
    /^gn$/,
    /^good morning$/,
    /^good night$/,
    /^good evening$/,
    /^ok+$/,
    /^okay$/,
    /^oky+$/,
    /^kk$/,
    /^thanks?$/,
    /^thank you$/,
    /^bye$/,
  ];

  if (text.length <= 3) return true;
  return lowSignalPatterns.some((r) => r.test(text));
}

function isSummaryQuery(question) {
  const q = String(question || '').toLowerCase();
  return (
    q.includes('summary') ||
    q.includes('summar') ||
    q.includes('important content') ||
    q.includes('key points') ||
    q.includes('highlights')
  );
}

function isOneLineSummaryQuery(question) {
  const q = String(question || '').toLowerCase();
  return (
    q.includes('one line') ||
    q.includes('single line') ||
    q.includes('in one line')
  );
}

function isTopicOnlySummaryQuery(question) {
  const q = String(question || '').toLowerCase();
  return (
    (q.includes('list topics') || q.includes('just topics') || q.includes('only topics') || q.includes('about what topic')) &&
    q.includes('summar')
  );
}

function isAnnouncementQuery(question) {
  const q = String(question || '').toLowerCase();
  return (
    q.includes('announcement') ||
    q.includes('annoucement') ||
    q.includes('announcements') ||
    q.includes('annoucements')
  );
}

function isAbuseQuery(question) {
  const q = String(question || '').toLowerCase();
  return (
    q.includes('abusive') ||
    q.includes('abuse') ||
    q.includes('offensive') ||
    q.includes('bad words') ||
    q.includes('toxic messages')
  );
}

function isToxicityRatingQuery(question) {
  const q = String(question || '').toLowerCase();
  return (
    q.includes('rate toxicity') ||
    q.includes('toxicity rate') ||
    q.includes('toxicity of') ||
    q.includes('toxicity score') ||
    q.includes('how toxic')
  );
}

function isSentimentQuery(question) {
  const q = String(question || '').toLowerCase();
  return (
    q.includes('sentiment') ||
    q.includes('positive') ||
    q.includes('negative') ||
    q.includes('emotion')
  );
}

function getRequestedCount(question, fallbackCount = 3, maxCount = 10) {
  const q = String(question || '').toLowerCase();
  const direct = q.match(/\b(top|last|latest|most)\s+(\d+)\b/);
  if (direct && direct[2]) {
    const n = parseInt(direct[2], 10);
    if (!Number.isNaN(n) && n > 0) return Math.min(n, maxCount);
  }
  return fallbackCount;
}

function isReplySuggestionQuery(question) {
  const q = String(question || '').toLowerCase();
  return (
    q.includes('suggest reply') ||
    q.includes('reply suggestion') ||
    q.includes('how to reply') ||
    q.includes('what should i reply') ||
    q.includes('how should i answer') ||
    q.includes('suggest answer') ||
    q.includes('draft reply') ||
    q.includes('member question')
  );
}

function wantsSummaryRecommendation(question) {
  const q = String(question || '').toLowerCase();
  return (
    q.includes('recommend') ||
    q.includes('suggestion') ||
    q.includes('suggest') ||
    q.includes('solution') ||
    q.includes('what should we do') ||
    q.includes('what to do') ||
    q.includes('next step')
  );
}

function isSmallTalkQuery(question) {
  const q = String(question || '').trim().toLowerCase();
  if (!q) return false;
  const patterns = [
    /^(hi+|hii+|hello+|hey+|yo+)[!. ]*$/i,
    /^(good morning|good afternoon|good evening|good night)[!. ]*$/i,
    /^(how are you|how r u|how are u)[?.! ]*$/i,
    /^(thanks|thank you|ok|okay|nice|cool|great)[!. ]*$/i,
    /^(who are you|what can you do)[?.! ]*$/i,
  ];
  return patterns.some((p) => p.test(q));
}

function extractQuotedQuestionText(question) {
  const q = String(question || '');
  const quoted = q.match(/["']([^"']{5,})["']/);
  if (quoted && quoted[1]) return quoted[1].trim();
  return '';
}

function isLikelyQuestionText(text) {
  const t = String(text || '').trim();
  if (!t) return false;
  if (t.includes('?')) return true;
  return /^(what|why|how|when|where|who|which|can|could|will|would|is|are|do|does|did)\b/i.test(t);
}

function pickMemberQuestionForReplySuggestion(userPrompt, messages) {
  const quoted = extractQuotedQuestionText(userPrompt);
  if (quoted) {
    const matched = [...messages]
      .reverse()
      .find((m) => String(m.content || '').toLowerCase().includes(quoted.toLowerCase()));
    if (matched) return matched;
  }

  const byQuestion = [...messages]
    .reverse()
    .find((m) => isLikelyQuestionText(m.content));
  if (byQuestion) return byQuestion;

  return [...messages].reverse().find((m) => !isLowSignalMessage(m.content)) || null;
}

async function generateReplySuggestionAnswer(userPrompt, messages) {
  const target = pickMemberQuestionForReplySuggestion(userPrompt, messages);
  if (!target) {
    return 'I could not find a member question in this chat window. Ask me with the exact question text and I will draft a reply.';
  }

  const contextLines = messages.slice(-25).map((m) => {
    const who = m.sender_name || 'Member';
    return `- ${who}: ${String(m.content || '').trim()}`;
  });

  const prompt = `You are helping a group/community moderator reply to a member question across varied community types (hostels, clubs, political groups, companies, institutions, friends).
Write a suggested reply that is:
- polite
- practical
- clear
- short (3 to 6 lines)

Member question:
${String(target.content || '').trim()}

Recent chat context:
${contextLines.join('\n')}

Also include one optional shorter alternative in 1 line.

Output format:
Suggested reply:
<reply>

Short alternative:
<one line>`;

  try {
    const llm = await queryLLM(prompt, null, 0.3);
    const text = String(llm?.response || '').trim();
    if (text) return text;
  } catch (error) {
    logger.warn('Reply suggestion generation failed, using deterministic fallback', {
      error: error.message,
    });
  }

  return `Suggested reply:
Thanks for raising this. We reviewed your question: "${String(target.content || '').trim()}". We will validate the details and share a clear update shortly.

Short alternative:
Thanks for your question, we are checking and will update you soon.`;
}

async function generateGeneralAssistantAnswer(question) {
  const generalPrompt = `You are a high-quality AI assistant.
Give a direct, clear, practical answer to the user's question.
If the question is ambiguous, make the best reasonable assumption and continue.
Keep the answer natural and useful.

Question: ${question}

Answer:`;

  const llmResponse = await queryLLM(generalPrompt, null, 0.35);
  return String(llmResponse?.response || '').trim();
}

function messageRelevanceScore(question, content) {
  const q = String(question || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ');
  const c = String(content || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ');

  const stop = new Set([
    'the', 'is', 'a', 'an', 'and', 'or', 'to', 'of', 'in', 'on', 'for', 'with',
    'chat', 'community', 'today', 'yesterday', 'before', 'ago', 'days', 'day',
    'summary', 'summarization', 'summarize', 'please', 'tell', 'me', 'about',
  ]);
  const qTerms = Array.from(new Set(q.split(/\s+/).filter((w) => w && !stop.has(w))));
  if (!qTerms.length) return 0;

  let score = 0;
  for (const t of qTerms) {
    if (c.includes(t)) score += 1;
  }
  return score;
}

function isImportantMessage(content) {
  const text = String(content || '').trim();
  if (!text) return false;

  if (isLowSignalMessage(text)) return false;
  if (text.length >= 40) return true;

  const lower = text.toLowerCase();
  const importantKeywords = [
    'note',
    'important',
    'urgent',
    'issue',
    'problem',
    'complaint',
    'petition',
    'meeting',
    'event',
    'budget',
    'finance',
    'water',
    'electricity',
    'maintenance',
    'rule',
    'policy',
    'deadline',
    'tomorrow',
    'today',
    'action',
    'must',
    'need',
    'please',
    "don't",
    'do not',
  ];

  return importantKeywords.some((k) => lower.includes(k)) || /[:.!?]/.test(text);
}

function cleanSummaryText(text) {
  let t = String(text || '').trim();
  t = t.replace(/^summary\s*:\s*/i, '');
  // Remove sender prefixes like "Nandha:" at the start
  t = t.replace(/^[A-Za-z][A-Za-z0-9 _.-]{0,30}:\s*/g, '');
  // Remove "Note:" prefix if present
  t = t.replace(/^note\s*:\s*/i, '');
  return t.trim();
}

function detectAbusiveScore(content) {
  const text = String(content || '').toLowerCase();
  if (!text) return 0;
  const abusiveTerms = [
    'idiot', 'stupid', 'fool', 'shut up', 'hate you', 'useless', 'bloody',
    'moron', 'dumb', 'loser', 'bastard', 'damn you',
  ];
  const harshTerms = ['angry', 'worst', 'nonsense', 'annoying', 'trash'];
  let score = 0;
  for (const t of abusiveTerms) {
    if (text.includes(t)) score += 0.55;
  }
  for (const t of harshTerms) {
    if (text.includes(t)) score += 0.2;
  }
  if (/[!?]{2,}/.test(text)) score += 0.1;
  if (/^[A-Z\s!?.,]+$/.test(String(content || '').trim()) && String(content || '').trim().length > 8) {
    score += 0.15;
  }
  return Math.min(1, score);
}

function detectSentimentScore(content) {
  const text = String(content || '').toLowerCase();
  if (!text) return 0;
  const positive = [
    'good', 'great', 'nice', 'excellent', 'thanks', 'thank you', 'appreciate',
    'happy', 'safe', 'resolved', 'applaud', 'well done', 'support',
  ];
  const negative = [
    'bad', 'worst', 'slow', 'disappointing', 'issue', 'problem', 'not working',
    'abuse', 'abusing', 'hell', 'angry', 'unsafe', 'failed', 'delay',
  ];
  let score = 0;
  for (const t of positive) if (text.includes(t)) score += 0.28;
  for (const t of negative) if (text.includes(t)) score -= 0.28;
  if (text.includes('!')) score += score >= 0 ? 0.08 : -0.08;
  return Math.max(-1, Math.min(1, score));
}

function normalizeIssueText(text) {
  let t = cleanSummaryText(text)
    .replace(/\s+/g, ' ')
    .trim();

  const typoFixes = [
    [/\bmr apartment\b/gi, 'my apartment'],
    [/\bappartment\b/gi, 'apartment'],
    [/\bapartmant\b/gi, 'apartment'],
    [/\bsummraization\b/gi, 'summarization'],
    [/\bproblem\b/gi, 'problem'],
    [/\bmaintainance\b/gi, 'maintenance'],
    [/\bsecurty\b/gi, 'security'],
    [/\bcalling bell ring\b/gi, 'calling bell is not working'],
    [/\bnot waste the water\b/gi, "do not waste water"],
  ];
  for (const [pattern, replacement] of typoFixes) {
    t = t.replace(pattern, replacement);
  }

  if (!t) return '';
  return t.charAt(0).toUpperCase() + t.slice(1);
}

function isLimitMessage(text) {
  const t = String(text || '').toLowerCase();
  return (
    t.includes('limit') &&
    (t.includes('exceeded') || t.includes('quota') || t.includes('too many requests') || t.includes('daily request'))
  );
}
function isMetaSummaryLine(text) {
  const t = String(text || '').toLowerCase().trim();
  if (!t) return true;
  if (t.startsWith('title')) return true;
  if (t.startsWith('summary')) return true;
  if (t.startsWith('recommendation')) return true;
  if (/^(post|share|assign|publish|create|notify|escalate)\b/.test(t)) return true;
  if (t.includes('chat summarization') || t.includes('chat summary')) return true;
  return false;
}

function sanitizeLLMSummaryOutput(text, includeRecommendation = false) {
  let t = String(text || '').trim();
  if (!t) return '';
  t = t.replace(/\b[A-Za-z][A-Za-z0-9 _.-]{0,30}:\s*/g, '');
  t = t.replace(/\bnote\s*:\s*/gi, '');
  t = t.replace(/\r/g, '').trim();

  if (!includeRecommendation) {
    // Strip recommendation block for modes that should only return summary/topics.
    t = t.replace(/\n\s*recommendations?\s*:[\s\S]*$/i, '').trim();
  }
  return t;
}

function buildAnnouncementAnswer(messages, question) {
  const announcementLike = messages.filter((m) => {
    const text = String(m.content || '').toLowerCase();
    const type = String(m.message_type || '').toLowerCase();
    return (
      type === 'announcement' ||
      text.includes('announcement') ||
      text.includes('notice') ||
      text.includes('power cut') ||
      text.includes('maintenance notice')
    );
  });

  if (!announcementLike.length) {
    const dateFilter = getDateFilterConfig(question);
    if (dateFilter.mode === 'day' && dateFilter.daysAgo === 0) {
      return 'No announcement was posted today in this community.';
    }
    return 'No announcement was found for that requested time range.';
  }

  const count = getRequestedCount(question, 3, 8);
  const latest = [...announcementLike]
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .map((m) => normalizeIssueText(m.content))
    .filter(Boolean);
  const points = [...new Set(latest)].slice(0, count);
  const sentence =
    points.length === 1
      ? `Yes. The latest announcement is about: ${points[0]}.`
      : `Latest ${points.length} announcements:\n${points.map((p, i) => `${i + 1}. ${p}`).join('\n')}`;
  return sentence;
}

function buildAbuseAnswer(messages) {
  const flagged = messages
    .map((m) => ({ ...m, abusiveScore: detectAbusiveScore(m.content) }))
    .filter((m) => m.abusiveScore >= 0.55)
    .sort((a, b) => b.abusiveScore - a.abusiveScore);

  if (!flagged.length) {
    return 'No abusive messages were detected in the requested chat range.';
  }

  const lines = flagged.slice(0, 5).map((m, idx) => `${idx + 1}. ${normalizeIssueText(m.content)}`);
  return `Yes, some potentially abusive messages were detected:\n${lines.join('\n')}`;
}

function buildToxicityRatingAnswer(messages) {
  if (!messages.length) return 'No messages found for the requested time range.';

  const scored = messages.map((m) => detectAbusiveScore(m.content));
  const avg = scored.reduce((a, b) => a + b, 0) / scored.length;
  const percent = Math.round(avg * 100);
  const level = avg < 0.2 ? 'Low' : avg < 0.45 ? 'Moderate' : 'High';
  const abusiveCount = scored.filter((s) => s >= 0.55).length;

  return `Toxicity rating for the requested period: ${level} (${percent}/100).\nPotentially abusive messages: ${abusiveCount} of ${messages.length}.`;
}

function buildSentimentAnswer(question, messages) {
  const count = getRequestedCount(question, 3, 8);
  const scored = messages
    .map((m) => ({
      ...m,
      sentiment: detectSentimentScore(m.content),
      absSentiment: Math.abs(detectSentimentScore(m.content)),
      normalized: normalizeIssueText(m.content),
    }))
    .filter((m) => m.normalized && !isLowSignalMessage(m.normalized));

  if (!scored.length) {
    return 'No meaningful sentiment messages were found in the requested chat range.';
  }

  const q = String(question || '').toLowerCase();
  if (q.includes('top') || q.includes('most')) {
    const top = scored
      .sort((a, b) => b.absSentiment - a.absSentiment || new Date(b.created_at) - new Date(a.created_at))
      .filter((m, idx, arr) => arr.findIndex((x) => x.normalized === m.normalized) === idx)
      .slice(0, count);
    if (!top.length) return 'No high-sentiment messages were found in the requested chat range.';
    return `Top ${top.length} high-sentiment messages:\n${top
      .map((m, i) => {
        const label = m.sentiment >= 0 ? 'Positive' : 'Negative';
        const strength = Math.round(Math.abs(m.sentiment) * 100);
        return `${i + 1}. (${label} ${strength}/100) ${m.normalized}`;
      })
      .join('\n')}`;
  }

  const positive = scored
    .filter((m) => m.sentiment > 0.25)
    .filter((m, idx, arr) => arr.findIndex((x) => x.normalized === m.normalized) === idx)
    .slice(0, count);
  const negative = scored
    .filter((m) => m.sentiment < -0.25)
    .filter((m, idx, arr) => arr.findIndex((x) => x.normalized === m.normalized) === idx)
    .slice(0, count);

  if (!positive.length && !negative.length) {
    return 'No clearly positive or negative sentiment messages were found in the requested chat range.';
  }

  const parts = [];
  if (positive.length) {
    parts.push(`Positive messages:\n${positive.map((m, i) => `${i + 1}. ${m.normalized}`).join('\n')}`);
  }
  if (negative.length) {
    parts.push(`Negative messages:\n${negative.map((m, i) => `${i + 1}. ${m.normalized}`).join('\n')}`);
  }
  return parts.join('\n');
}

function buildDeterministicAnswer(question, messages) {
  if (isAnnouncementQuery(question)) return buildAnnouncementAnswer(messages, question);
  if (isAbuseQuery(question)) return buildAbuseAnswer(messages);
  if (isToxicityRatingQuery(question)) return buildToxicityRatingAnswer(messages);
  if (isSentimentQuery(question)) return buildSentimentAnswer(question, messages);

  const ranked = messages
    .map((m) => ({
      ...m,
      relevance: messageRelevanceScore(question, m.content),
    }))
    .sort((a, b) => b.relevance - a.relevance || new Date(b.created_at) - new Date(a.created_at));

  const relevant = ranked.filter((m) => m.relevance > 0).slice(0, 5);
  const chosen = relevant.length ? relevant : ranked.filter((m) => isImportantMessage(m.content)).slice(-5);

  if (!chosen.length) {
    return 'I could not find enough relevant discussion for that question in this community chat.';
  }

  const lines = chosen.map((m) => `- ${String(m.content).trim()}`);

  return `Based on community chat:\n${lines.join('\n')}`;
}

async function fetchCommunityChatMessages(communityId, question, limit = 120) {
  const hasChatMessages = await tableExists('chat_messages');
  if (!hasChatMessages) return [];

  const dateFilter = getDateFilterConfig(question);
  let sql = `
    SELECT cm.content, cm.created_at, cm.message_type, COALESCE(u.full_name, 'Unknown User') AS sender_name
    FROM chat_messages cm
    LEFT JOIN users u ON u.user_id = cm.sender_id
    WHERE cm.community_id = $1
      AND cm.content IS NOT NULL
      AND LENGTH(TRIM(cm.content)) > 0
  `;
  const params = [communityId];

  if (dateFilter.mode === 'day') {
    sql += ` AND DATE(cm.created_at) = CURRENT_DATE - $2::int`;
    params.push(dateFilter.daysAgo);
    sql += ` ORDER BY cm.created_at DESC LIMIT $3`;
    params.push(limit);
  } else if (dateFilter.mode === 'calendar_date') {
    sql += ` AND DATE(cm.created_at) = $2::date`;
    params.push(dateFilter.isoDate);
    sql += ` ORDER BY cm.created_at DESC LIMIT $3`;
    params.push(limit);
  } else if (dateFilter.mode === 'weekday') {
    // PostgreSQL EXTRACT(DOW): Sunday=0 ... Saturday=6
    sql += ` AND EXTRACT(DOW FROM cm.created_at) = $2`;
    params.push(dateFilter.weekday);
    sql += ` ORDER BY cm.created_at DESC LIMIT $3`;
    params.push(limit);
  } else if (dateFilter.mode === 'rolling_period') {
    sql += ` AND cm.created_at >= NOW() - ($2::int * ('1 ' || $3)::interval)`;
    params.push(dateFilter.amount);
    params.push(dateFilter.unit);
    sql += ` ORDER BY cm.created_at DESC LIMIT $4`;
    params.push(limit);
  } else if (dateFilter.mode === 'calendar_period') {
    const range = getCalendarPeriodRange(dateFilter.periodKind, dateFilter.periodOffset);
    sql += ` AND cm.created_at >= $2 AND cm.created_at < $3`;
    params.push(range.start.toISOString());
    params.push(range.end.toISOString());
    sql += ` ORDER BY cm.created_at DESC LIMIT $4`;
    params.push(limit);
  } else {
    const wideIntentWindow =
      isAnnouncementQuery(question) ||
      isSentimentQuery(question) ||
      isAbuseQuery(question) ||
      isToxicityRatingQuery(question);
    sql += wideIntentWindow
      ? ` AND cm.created_at >= NOW() - INTERVAL '90 days'`
      : ` AND cm.created_at >= NOW() - INTERVAL '24 hours'`;
    sql += ` ORDER BY cm.created_at DESC LIMIT $2`;
    params.push(limit);
  }

  const result = await query(sql, params);
  return result.rows
    .reverse()
    .filter((m) => !isLowSignalMessage(m.content));
}

async function generateLLMSolutions(issues, mode = 'solutions') {
  if (!issues.length) return null;

  const issuesList = issues.map((issue, i) => `${i + 1}. ${issue}`).join('\n');

  const prompt = mode === 'recommendations'
    ? `You are a practical community manager assistant helping resolve real community issues.

Below is a list of issues reported in a community (could be apartment, hostel, club, institution, company, or any group).

For each issue, provide structured recommendations in this format:
**[Issue title]**
- Immediate Action (next 24-48 hrs): [specific action]
- Short-term (1-4 weeks): [specific improvement]
- Long-term (1-6 months): [strategic fix]
- Prevention: [how to avoid recurrence]

Be specific, practical, and relevant to the actual issue. Do NOT give generic answers.

Issues:
${issuesList}

Recommendations:`
    : `You are a practical community manager assistant helping resolve real community issues.

Below is a list of issues reported in a community (could be apartment, hostel, club, institution, company, or any group).

For each issue, provide a clear and specific solution in this format:
**[Issue title]**
- Immediate Action: [what to do right now, specific to this issue]
- How to Implement: [step-by-step practical steps]
- Timeline: [realistic time estimate]
- Priority: [HIGH / MEDIUM / LOW with one line reason]

Be specific and practical. Tailor each solution to the actual issue described. Do NOT give the same generic answer for all issues.

Issues:
${issuesList}

Solutions:`;

  try {
    const result = await queryLLM(prompt, null, 0.4);
    const answer = String(result?.response || '').trim();
    if (answer && !isLimitMessage(answer)) return answer;
  } catch (error) {
    logger.error('LLM solutions generation failed', { error: error.message });
  }
  return null;
}

async function summarizeFromChatMessages(question, communityId) {
  // Handle translation queries FIRST — they fetch messages internally
  if (isTranslationQuery(question)) {
    return await handleTranslationQuery(question, communityId);
  }

  // Handle language-specific analysis queries FIRST
  if (isLanguageFilterQuery(question)) {
    return await handleLanguageFilterQuery(question, communityId);
  }
  // Fetch messages using existing function
  const messages = await fetchCommunityChatMessages(communityId, question);
  
  if (!messages.length) {
    // Handle no messages case
    const dateFilter = getDateFilterConfig(question);
    const noDataMessage =
      dateFilter.mode === 'calendar_date' && dateFilter.label
        ? `No chat messages found for ${dateFilter.label} in this community.`
        : dateFilter.mode === 'weekday' && dateFilter.label
        ? `No chat messages found for ${dateFilter.label} in this community.`
        : dateFilter.mode === 'rolling_period' && dateFilter.label
        ? `No chat messages found in the last ${dateFilter.label} in this community.`
        : dateFilter.mode === 'calendar_period' && dateFilter.label
        ? `No chat messages found for ${dateFilter.label} in this community.`
        : 'No chat messages found for the requested time range.';

    return {
      answer: noDataMessage,
      sources: [],
      confidence: 0,
      sourceCount: 0,
      status: 'no_chat_messages',
    };
  }


// Detect user intent
const intent = detectIntent(question);
  
  logger.info('Detected intent', { intent, question: question.substring(0, 100) });

  // Prepare data based on intent
  let promptData;
  let prompt;
  
  if (intent === 'solutions' || intent === 'recommendations') {
    // For solutions/recommendations, provide issues as a clean list
    const issuesList = messages
      .filter(m => !isLowSignalMessage(m.content))
      .filter(m => isImportantMessage(m.content) || m.content.length > 15)
      .map(m => `- ${normalizeIssueText(m.content)}`)
      .filter((v, i, a) => a.indexOf(v) === i) // Remove duplicates
      .join('\n');
    
    promptData = issuesList || '- No specific issues found';
    prompt = getPrompt(intent, promptData, question);
    
  } else if (intent === 'summary') {
    // For summary, provide full transcript with timestamps
    const transcript = formatMessagesAsTranscript(messages);
    const includeRecommendations = question.toLowerCase().includes('recommend');
    
    promptData = transcript;
    prompt = getPrompt(intent, promptData, question, { includeRecommendations });
    
  } else if (['sentiment', 'toxicity', 'abuse', 'categorization', 'topics', 'duplication', 'duplicates', 'announcement', 'announcements'].includes(intent)) {
    // For analysis tasks, provide messages as numbered list
    const messagesList = formatMessagesAsList(messages);
    
    promptData = messagesList;
    prompt = getPrompt(intent, promptData, question);
    
  } else {
    // For general questions, provide transcript
    const transcript = formatMessagesAsTranscript(messages);
    
    promptData = transcript;
    prompt = getPrompt('general', promptData, question);
  }

  // Query LLM with the constructed prompt
  let answer = '';
  let llmSuccess = false;
  
  try {
    logger.info('Querying LLM', { intent, promptLength: prompt.length });
    
    const llmResponse = await queryLLM(prompt, null, 0.3);
    answer = String(llmResponse?.response || '').trim();
    
    // Check if LLM returned a valid response
    if (answer && !isLimitMessage(answer)) {
      llmSuccess = true;
      answer = cleanLLMOutput(answer, intent);
      logger.info('LLM response received', { answerLength: answer.length, intent });
    } else {
      logger.warn('LLM returned empty or limit message', { intent });
    }
  } catch (error) {
    logger.error('LLM query failed', { error: error.message, intent });
  }

  // Fallback to deterministic answer if LLM failed
  if (!llmSuccess || !answer) {
    logger.info('Using deterministic fallback', { intent });
    answer = await buildDeterministicAnswer(intent, messages, question);
  }

  // Calculate confidence
  const importantCount = messages.filter(m => isImportantMessage(m.content)).length;
  const confidence = llmSuccess ? (importantCount > 0 ? 82 : 65) : (importantCount > 0 ? 68 : 45);

  return {
    answer,
    sources: messages.slice(-5).map((m, idx) => ({
      id: `chat-${idx}`,
      title: `Chat message (${new Date(m.created_at).toLocaleString('en-US')})`,
      similarity: null,
    })),
    confidence,
    sourceCount: messages.length,
    status: llmSuccess ? 'llm_success' : 'deterministic_fallback',
  };
}

/**
 * Clean LLM output based on intent
 */
function cleanLLMOutput(text, intent) {
  let cleaned = String(text || '').trim();
  
  // Remove common AI verbosity
  cleaned = cleaned.replace(/^(Here (is|are)|Here's|This is|Based on|According to)\s*/i, '');
  cleaned = cleaned.replace(/^(I understand|I analyzed|I reviewed|Let me provide)\s*[^.!?]*[.!?]\s*/i, '');
  
  // Remove sender name patterns
  cleaned = cleaned.replace(/^[A-Za-z][A-Za-z0-9 _.-]{0,30}:\s*/gm, '');
  
  // Remove "Note:" prefixes
  cleaned = cleaned.replace(/^note\s*:\s*/gim, '');
  
  // Clean up whitespace
  cleaned = cleaned.replace(/\r/g, '').replace(/\n{3,}/g, '\n\n').trim();
  
  // For summary, remove unwanted sections
  if (intent === 'summary') {
    // Remove "Query:" or "Title:" sections
    cleaned = cleaned.replace(/^(Query|Title|User Request)\s*:[\s\S]*?\n\n/im, '');
  }
  
  return cleaned;
}

/**
 * Build deterministic answer when LLM fails
 */
async function buildDeterministicAnswer(intent, messages, question) {
  switch (intent) {
    case 'solutions':
      return await buildDeterministicSolutions(messages);

    case 'recommendations':
      return await buildDeterministicRecommendations(messages);
    
    case 'summary':
      return buildDeterministicSummary(messages);
    
    case 'sentiment':
      return buildSentimentAnswer(question, messages);
    
    case 'toxicity':
    case 'abuse':
      return buildAbuseAnswer(messages);
    
    case 'categorization':
    case 'topics':
      return buildCategorizationAnswer(messages);
    
    case 'duplication':
    case 'duplicates':
      return buildDuplicationAnswer(messages);
    
    case 'announcement':
    case 'announcements':
      return buildAnnouncementAnswer(messages, question);
    
    default:
      return buildGeneralAnswer(messages, question);
  }
}

/**
 * Deterministic Solutions Builder
 */
async function buildDeterministicSolutions(messages) {
  const issues = extractUniqueIssues(messages);

  if (!issues.length) {
    return 'No specific issues found to provide solutions for.';
  }

  // Always try LLM first — templates are too generic
  const llmAnswer = await generateLLMSolutions(issues, 'solutions');
  if (llmAnswer) return `Solutions:\n\n${llmAnswer}`;

  // Hard fallback: at least show the issues with category-aware labels
  const solutions = issues.map((issue, idx) => {
    const category = categorizeIssue(issue);
    const label = getCategoryLabel(category);
    return `${idx + 1}. **${issue}**\n   Category: ${label}\n   Action: Review and address this issue with relevant stakeholders promptly.`;
  });

  return `Solutions:\n\n${solutions.join('\n\n')}`;
}

/**
 * Deterministic Recommendations Builder
 */
async function buildDeterministicRecommendations(messages) {
  const issues = extractUniqueIssues(messages);

  if (!issues.length) {
    return 'No specific issues found to provide recommendations for.';
  }

  // Always try LLM first
  const llmAnswer = await generateLLMSolutions(issues, 'recommendations');
  if (llmAnswer) return `Recommendations:\n\n${llmAnswer}`;

  // Hard fallback
  const lines = issues.map((issue, idx) => {
    const category = categorizeIssue(issue);
    const label = getCategoryLabel(category);
    return `${idx + 1}. **${issue}** (${label})\n   - Assess impact, consult affected members, and implement a targeted resolution plan.`;
  });

  return `Recommendations:\n\n${lines.join('\n\n')}`;
}
/**
 * Deterministic Summary Builder
 */
function buildDeterministicSummary(messages) {
  const issues = extractUniqueIssues(messages);
  
  if (!issues.length) {
    return 'Summary:\n\nNo significant discussion points found in the chat.';
  }

  const categorized = {};
  issues.forEach(issue => {
    const category = categorizeIssue(issue);
    if (!categorized[category]) categorized[category] = [];
    categorized[category].push(issue);
  });

  let output = 'Summary:\n\n';
  let idx = 1;
  
  for (const [category, items] of Object.entries(categorized)) {
    const categoryLabel = getCategoryLabel(category);
    items.forEach(item => {
      output += `${idx}. **${categoryLabel}:** ${item}\n`;
      idx++;
    });
  }

  return output.trim();
}

/**
 * Deterministic Categorization Builder
 */
function buildCategorizationAnswer(messages) {
  const issues = extractUniqueIssues(messages);
  
  if (!issues.length) {
    return 'Topics Discussed:\n\nNo specific topics identified in the chat.';
  }

  const categorized = {};
  issues.forEach(issue => {
    const category = categorizeIssue(issue);
    if (!categorized[category]) categorized[category] = [];
    categorized[category].push(issue);
  });

  let output = 'Topics Discussed:\n\n';
  let idx = 1;
  
  for (const [category, items] of Object.entries(categorized)) {
    const categoryLabel = getCategoryLabel(category);
    output += `${idx}. **${categoryLabel}** (${items.length} message${items.length > 1 ? 's' : ''})\n`;
    items.forEach(item => output += `   - ${item}\n`);
    output += '\n';
    idx++;
  }

  const priorities = Object.entries(categorized)
    .filter(([cat]) => ['safety', 'sanitation', 'water', 'electricity'].includes(cat))
    .map(([cat]) => getCategoryLabel(cat));
  
  if (priorities.length) {
    output += `**Priority Topics:** ${priorities.join(', ')}`;
  }

  return output.trim();
}

/**
 * Deterministic Duplication Builder
 */
function buildDuplicationAnswer(messages) {
  const contentMap = {};
  
  messages.forEach(m => {
    const normalized = normalizeIssueText(m.content).toLowerCase();
    if (normalized && normalized.length > 10) {
      if (!contentMap[normalized]) {
        contentMap[normalized] = [];
      }
      contentMap[normalized].push(m);
    }
  });

  const duplicates = Object.entries(contentMap)
    .filter(([_, msgs]) => msgs.length > 1)
    .sort((a, b) => b[1].length - a[1].length);

  if (!duplicates.length) {
    return 'Duplicate Issues Found:\n\nNo duplicate or repeated issues identified.';
  }

  let output = 'Duplicate Issues Found:\n\n';
  
  duplicates.slice(0, 5).forEach(([content, msgs], idx) => {
    const firstMsg = msgs[0];
    const senders = [...new Set(msgs.map(m => m.sender_name).filter(Boolean))];
    const pattern = senders.length > 1 ? 'Multiple reporters' : 
                   msgs.length > 2 ? 'Repeated mentions' : 'Follow-up';
    
    output += `${idx + 1}. **${normalizeIssueText(content)}** - Mentioned ${msgs.length} times\n`;
    output += `   - Pattern: ${pattern}\n`;
    if (senders.length > 1) {
      output += `   - Reported by: ${senders.slice(0, 3).join(', ')}${senders.length > 3 ? ', ...' : ''}\n`;
    }
    output += `   - Urgency: ${msgs.length >= 3 ? 'High' : 'Medium'}\n\n`;
  });

  return output.trim();
}

/**
 * Extract unique issues from messages
 */
function extractUniqueIssues(messages) {
  const issues = new Set();
  
  messages.forEach(m => {
    const content = normalizeIssueText(m.content);
    if (content && !isLowSignalMessage(content) && content.length > 10) {
      issues.add(content);
    }
  });

  return Array.from(issues).slice(0, 15);
}

/**
 * Categorize issue
 */
function categorizeIssue(issue) {
  const lower = issue.toLowerCase();
  
  if (lower.match(/\b(abuse|harass|attack|threat|safe|security|violence|assault|danger)\b/)) {
    return 'safety';
  }
  if (lower.match(/\b(garbage|trash|waste|clean|dirt|hygiene|sanitation)\b/)) {
    return 'sanitation';
  }
  if (lower.match(/\b(water|leak|pipe|plumb|tap|supply)\b/)) {
    return 'water';
  }
  if (lower.match(/\b(power|electric|light|outage|cut|blackout)\b/)) {
    return 'electricity';
  }
  if (lower.match(/\b(pool|gym|facility|amenity|equipment|playground)\b/)) {
    return 'facilities';
  }
  if (lower.match(/\b(noise|loud|disturb|party|music)\b/)) {
    return 'noise';
  }
  if (lower.match(/\b(maintenance|repair|fix|broken|damage)\b/)) {
    return 'maintenance';
  }
  if (lower.match(/\b(parking|vehicle|car|bike)\b/)) {
    return 'parking';
  }
  
  return 'general';
}

/**
 * Get category label
 */
function getCategoryLabel(category) {
  const labels = {
    safety: 'Safety & Security',
    sanitation: 'Sanitation & Cleanliness',
    water: 'Water Supply',
    electricity: 'Power & Electricity',
    facilities: 'Facilities & Amenities',
    noise: 'Noise & Disturbance',
    maintenance: 'Maintenance & Repairs',
    parking: 'Parking & Vehicles',
    general: 'General Discussion',
  };
  
  return labels[category] || 'General';
}

/**
 * Build general answer (existing function from rag.service.js)
 */
function buildGeneralAnswer(messages, question) {
  const ranked = messages
    .map((m) => ({
      ...m,
      relevance: messageRelevanceScore(question, m.content),
    }))
    .sort((a, b) => b.relevance - a.relevance || new Date(b.created_at) - new Date(a.created_at));

  const relevant = ranked.filter((m) => m.relevance > 0).slice(0, 5);
  const chosen = relevant.length ? relevant : ranked.filter((m) => isImportantMessage(m.content)).slice(-5);

  if (!chosen.length) {
    return 'I could not find relevant information to answer that question based on the community chat.';
  }

  const points = chosen.map(m => `- ${normalizeIssueText(m.content)}`).join('\n');
  return `Based on community chat:\n\n${points}`;
}

// Export the improved function
module.exports = {
  summarizeFromChatMessages,
};

async function ensureBotHistoryTable() {
  if (botHistoryTableReady) return;

  await query(`
    CREATE TABLE IF NOT EXISTS bot_chat_history (
      id BIGSERIAL PRIMARY KEY,
      user_id BIGINT NOT NULL,
      community_id BIGINT NOT NULL,
      question TEXT NOT NULL,
      answer TEXT NOT NULL,
      session_hash VARCHAR(64),
      confidence INTEGER,
      source_count INTEGER DEFAULT 0,
      status VARCHAR(32) NOT NULL DEFAULT 'success',
      error_message TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_bot_chat_history_community_created
    ON bot_chat_history(community_id, created_at DESC)
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_bot_chat_history_user_created
    ON bot_chat_history(user_id, created_at DESC)
  `);

  botHistoryTableReady = true;
}

async function saveBotHistory({
  userId,
  communityId,
  question,
  answer,
  sessionHash,
  confidence = 0,
  sourceCount = 0,
  status = 'success',
  errorMessage = null,
}) {
  try {
    await ensureBotHistoryTable();

    await query(
      `INSERT INTO bot_chat_history
       (user_id, community_id, question, answer, session_hash, confidence, source_count, status, error_message, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW())`,
      [
        userId,
        communityId,
        question,
        answer,
        sessionHash || null,
        confidence,
        sourceCount,
        status,
        errorMessage,
      ]
    );
  } catch (error) {
    logger.error('Failed to save bot chat history', { error: error.message });
  }
}

/**
 * Initialize embedding model
 */
async function initEmbeddingModel() {
  if (embeddingPipeline) return embeddingPipeline;
  
  const startTime = Date.now();
  logger.info('Loading embedding model...');
  
  try {
    const candidates = [
      { model: EMBEDDING_MODEL, quantized: false },
      { model: 'Xenova/all-MiniLM-L6-v2', quantized: false },
      { model: 'sentence-transformers/all-MiniLM-L6-v2', quantized: false },
    ];

    let lastError = null;
    for (const candidate of candidates) {
      try {
        embeddingPipeline = await pipeline(
          'feature-extraction',
          candidate.model,
          {
            quantized: candidate.quantized,
            progress_callback: (progress) => {
              if (progress.status === 'progress') {
                logger.debug('Embedding model download progress', {
                  model: candidate.model,
                  file: progress.file,
                  progress: `${progress.progress}%`,
                });
              }
            },
          }
        );
        logger.info('Embedding model initialized', {
          model: candidate.model,
          quantized: candidate.quantized,
        });
        break;
      } catch (candidateError) {
        lastError = candidateError;
        logger.warn('Embedding model candidate failed', {
          model: candidate.model,
          quantized: candidate.quantized,
          error: candidateError.message,
        });
      }
    }

    if (!embeddingPipeline) {
      throw lastError || new Error('No compatible embedding model could be loaded');
    }
    
    const duration = Date.now() - startTime;
    logPerformance('Embedding model initialization', duration);
    
    logger.info('✅ Embedding model loaded', { duration: `${duration}ms` });
    
    return embeddingPipeline;
  } catch (error) {
    logger.error('Failed to load embedding model', { error: error.message });
    throw error;
  }
}

/**
 * Generate embedding for text
 */
async function generateEmbedding(text) {
  const startTime = Date.now();
  
  try {
    const pipeline = await initEmbeddingModel();
    
    // Generate embedding
    const output = await pipeline(text, {
      pooling: 'mean',
      normalize: true,
    });
    
    // Convert to array
    const embedding = Array.from(output.data);
    
    const duration = Date.now() - startTime;
    logPerformance('Embedding generation', duration);
    
    return embedding;
  } catch (error) {
    logger.error('Embedding generation error', { error: error.message });
    throw error;
  }
}

/**
 * Add document to vector database
 */
async function addDocument(communityId, title, content, uploadedBy) {
  const startTime = Date.now();
  
  try {
    // Generate embedding
    const embedding = await generateEmbedding(content);
    
    // Insert into database
    const result = await query(
      `INSERT INTO community_docs 
       (community_id, title, content, embedding, uploaded_by, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       RETURNING id`,
      [communityId, title, content, JSON.stringify(embedding), uploadedBy]
    );
    
    const duration = Date.now() - startTime;
    logPerformance('Document addition', duration);
    
    logger.info('Document added to vector DB', {
      docId: result.rows[0].id,
      communityId,
      title,
      duration: `${duration}ms`,
    });
    
    return result.rows[0].id;
  } catch (error) {
    logger.error('Document addition error', { error: error.message });
    throw error;
  }
}

/**
 * Search for relevant documents
 */
async function searchDocuments(question, communityId, limit = 5) {
  const startTime = Date.now();
  
  try {
    // Generate embedding for question
    const questionEmbedding = await generateEmbedding(question);
    
    // Search similar documents
    const documents = await vectorSearch(questionEmbedding, communityId, limit);
    
    const duration = Date.now() - startTime;
    logPerformance('Document search', duration);
    
    logger.debug('Document search completed', {
      communityId,
      resultsFound: documents.length,
      duration: `${duration}ms`,
    });
    
    return documents;
  } catch (error) {
    if (isMissingRelation(error, 'community_docs')) {
      logger.warn('community_docs table missing during document search; returning empty result');
      return [];
    }
    logger.error('Document search error', { error: error.message });
    throw error;
  }
}
function sanitizePromptForOllama(prompt) {
  // Ensure the string is valid UTF-8 by re-encoding through Buffer
  // This fixes Ollama HTTP 500 on non-ASCII (Devanagari, Arabic, CJK, etc.)
  try {
    return Buffer.from(prompt, 'utf8').toString('utf8');
  } catch {
    return prompt;
  }
}
/**
 * Query Ollama LLM
 */
async function queryOllama(prompt, context = '', temperature = 0.7) {
  const startTime = Date.now();
  
  try {
    const payload = {
      model: OLLAMA_MODEL,
      prompt: sanitizePromptForOllama(prompt),
      temperature: temperature,
      stream: false,
    };

    // Ollama expects context as token array; sending wrong type causes HTTP 400.
    if (Array.isArray(context) && context.length > 0) {
      payload.context = context;
    }

    const response = await axios.post(
      `${OLLAMA_HOST}/api/generate`,
      payload,
      {
        timeout: OLLAMA_TIMEOUT_MS,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
        },
        transformRequest: [(data) => JSON.stringify(data)],
      }
    );
    
    const duration = Date.now() - startTime;
    logPerformance('Ollama query', duration);
    
    return {
      response: response.data.response,
      context: response.data.context,
    };
  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      logger.error('Ollama server not running', { host: OLLAMA_HOST });
      throw new Error('RAG service unavailable. Please ensure Ollama is running.');
    }
    // 404 = model not found in Ollama (e.g. not pulled in Docker)
    if (error.response && error.response.status === 404) {
      logger.warn('Ollama model not found (404). Pull the model in Docker: docker exec ollama-local ollama pull ' + OLLAMA_MODEL, {
        model: OLLAMA_MODEL,
        host: OLLAMA_HOST,
      });
      try {
        const tagsRes = await axios.get(`${OLLAMA_HOST}/api/tags`, { timeout: 5000 });
        const models = tagsRes.data?.models || [];
        if (models.length > 0) {
          const fallbackModel = models[0].name;
          logger.info('Retrying with first available model', { fallbackModel });
          const retryPayload = {
            model: fallbackModel,
            prompt: prompt,
            temperature: temperature,
            stream: false,
          };
          if (Array.isArray(context) && context.length > 0) retryPayload.context = context;
          const retryRes = await axios.post(`${OLLAMA_HOST}/api/generate`, retryPayload, { timeout: OLLAMA_TIMEOUT_MS });
          return {
            response: retryRes.data.response,
            context: retryRes.data.context,
          };
        }
      } catch (fallbackErr) {
        logger.warn('Fallback model attempt failed', { error: fallbackErr.message });
      }
      throw new Error(`Ollama model "${OLLAMA_MODEL}" not found. Pull it: docker exec ollama-local ollama pull ${OLLAMA_MODEL}`);
    }
    logger.error('Ollama query error', { error: error.message });
    throw error;
  }
}

async function queryOpenAI(prompt, context = '', temperature = 0.7) {
  if (!OPENAI_API_KEY) {
    throw new Error('OpenAI API key is missing');
  }

  const startTime = Date.now();

  try {
    const messages = [];
    const contextText = typeof context === 'string' ? context.trim() : '';

    if (contextText) {
      messages.push({
        role: 'system',
        content: `Conversation context:\n${contextText}`,
      });
    }
    messages.push({ role: 'user', content: prompt });

    const response = await axios.post(
      `${OPENAI_BASE_URL}/chat/completions`,
      {
        model: OPENAI_MODEL,
        messages,
        temperature,
      },
      {
        timeout: OPENAI_TIMEOUT_MS,
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const duration = Date.now() - startTime;
    logPerformance('OpenAI query', duration);

    const text = response?.data?.choices?.[0]?.message?.content || '';
    return {
      response: String(text).trim(),
      context: null,
    };
  } catch (error) {
    const status = error?.response?.status;
    const details = error?.response?.data || error.message;
    logger.error('OpenAI query error', { status, error: details });
    throw error;
  }
}

async function queryLLM(prompt, context = '', temperature = 0.7) {
  const res = await queryOllama(prompt, context, temperature);
  if (isLimitMessage(res?.response)) {
    return { response: '', context: res?.context || '' };
  }
  return res;
}

/**
 * Generate session hash for conversation tracking
 */
function generateSessionHash(userId, communityId) {
  const data = `${userId}-${communityId}-${Date.now()}`;
  return crypto.createHash('sha256').update(data).digest('hex').substring(0, 16);
}

/**
 * Format item context (petition or complaint) for prompt
 */
function formatItemContext(itemContext) {
  if (!itemContext || !itemContext.type || !itemContext.data) return '';
  const d = itemContext.data;
  if (itemContext.type === 'petition') {
    return `
Current Petition Details (use these to correct, summarize, or suggest solutions):
- ID: #${d.petition_id || 'N/A'}
- Title: ${d.title || 'N/A'}
- Summary: ${d.summary || 'N/A'}
- Problem Statement: ${d.problem_statement || 'N/A'}
- Proposed Action: ${d.proposed_action || 'N/A'}
- Goal Type: ${d.goal_type || 'N/A'}
- Impact Area: ${d.impact_area || 'N/A'}
- Status: ${d.status || 'N/A'}
- Author: ${d.author_name || 'N/A'}
- Community: ${d.community_name || 'N/A'}
- Priority: ${d.priority_level || 'N/A'}
`;
  }
  if (itemContext.type === 'complaint') {
    return `
Current Complaint Details (use these to correct, summarize, or suggest solutions):
- ID: #${d.complaint_id || 'N/A'}
- Title: ${d.title || 'N/A'}
- Description: ${d.description || 'N/A'}
- Category: ${d.category || 'N/A'}
- Severity: ${d.severity || 'N/A'}
- Status: ${d.status || 'N/A'}
- Author: ${d.author_name || 'N/A'}
- Community: ${d.community_name || 'N/A'}
- Urgent: ${d.is_urgent ? 'Yes' : 'No'}
`;
  }
  return '';
}

function extractItemReference(question) {
  const q = String(question || '');
  // Common patterns:
  // - "complaint with ID 22", "complaint id:22", "complaint #22", "complaint 22"
  // - "petition with ID 10", "petition #10", "petition 10"
  const complaintMatch =
    q.match(/\bcomplaint\b[\s:]*?(?:with\s*)?(?:id|#)\s*(\d+)\b/i) ||
    q.match(/\bcomplaint\b[\s:]+#?\s*(\d+)\b/i);
  if (complaintMatch && complaintMatch[1]) {
    const id = parseInt(complaintMatch[1], 10);
    if (Number.isFinite(id) && id > 0) return { type: 'complaint', id };
  }

  const petitionMatch =
    q.match(/\bpetition\b[\s:]*?(?:with\s*)?(?:id|#)\s*(\d+)\b/i) ||
    q.match(/\bpetition\b[\s:]+#?\s*(\d+)\b/i);
  if (petitionMatch && petitionMatch[1]) {
    const id = parseInt(petitionMatch[1], 10);
    if (Number.isFinite(id) && id > 0) return { type: 'petition', id };
  }

  return null;
}

async function fetchComplaintItemContextById(complaintId, communityId) {
  const res = await query(
    `SELECT 
       c.complaint_id,
       c.title,
       c.description,
       c.category,
       c.severity,
       c.status,
       c.is_urgent,
       c.created_at,
       COALESCE(u.full_name, 'Unknown') AS author_name,
       COALESCE(cm.name, 'Unknown') AS community_name
     FROM complaints c
     LEFT JOIN users u ON u.user_id = c.created_by
     LEFT JOIN communities cm ON cm.community_id = c.community_id
     WHERE c.complaint_id = $1 AND c.community_id = $2
     LIMIT 1`,
    [complaintId, communityId]
  );
  const row = res.rows?.[0];
  if (!row) return null;
  return {
    type: 'complaint',
    data: {
      complaint_id: row.complaint_id,
      title: row.title,
      description: row.description,
      category: row.category,
      severity: row.severity,
      status: row.status,
      is_urgent: row.is_urgent,
      author_name: row.author_name,
      community_name: row.community_name,
      created_at: row.created_at,
    },
  };
}

async function fetchPetitionItemContextById(petitionId, communityId) {
  const res = await query(
    `SELECT 
       p.petition_id,
       p.title,
       p.summary,
       p.problem_statement,
       p.proposed_action,
       p.goal_type,
       p.other_goal_type,
       p.impact_area,
       p.other_impact_area,
       p.status,
       p.priority_level,
       p.created_at,
       COALESCE(u.full_name, 'Unknown') AS author_name,
       COALESCE(cm.name, 'Unknown') AS community_name
     FROM petitions p
     LEFT JOIN users u ON u.user_id = p.author_id
     LEFT JOIN communities cm ON cm.community_id = p.community_id
     WHERE p.petition_id = $1 AND p.community_id = $2
     LIMIT 1`,
    [petitionId, communityId]
  );
  const row = res.rows?.[0];
  if (!row) return null;
  return {
    type: 'petition',
    data: {
      petition_id: row.petition_id,
      title: row.title,
      summary: row.summary,
      problem_statement: row.problem_statement,
      proposed_action: row.proposed_action,
      goal_type: row.goal_type === 'Other' ? row.other_goal_type || row.goal_type : row.goal_type,
      impact_area: row.impact_area === 'Other' ? row.other_impact_area || row.impact_area : row.impact_area,
      status: row.status,
      author_name: row.author_name,
      community_name: row.community_name,
      priority_level: row.priority_level,
      created_at: row.created_at,
    },
  };
}

async function fetchLatestComplaintItemContext(communityId) {
  const res = await query(
    `SELECT 
       c.complaint_id,
       c.title,
       c.description,
       c.category,
       c.severity,
       c.status,
       c.is_urgent,
       c.created_at,
       COALESCE(u.full_name, 'Unknown') AS author_name,
       COALESCE(cm.name, 'Unknown') AS community_name
     FROM complaints c
     LEFT JOIN users u ON u.user_id = c.created_by
     LEFT JOIN communities cm ON cm.community_id = c.community_id
     WHERE c.community_id = $1
     ORDER BY c.created_at DESC
     LIMIT 1`,
    [communityId]
  );
  const row = res.rows?.[0];
  if (!row) return null;
  return {
    type: 'complaint',
    data: {
      complaint_id: row.complaint_id,
      title: row.title,
      description: row.description,
      category: row.category,
      severity: row.severity,
      status: row.status,
      is_urgent: row.is_urgent,
      author_name: row.author_name,
      community_name: row.community_name,
      created_at: row.created_at,
    },
  };
}

async function fetchLatestPetitionItemContext(communityId) {
  const res = await query(
    `SELECT 
       p.petition_id,
       p.title,
       p.summary,
       p.problem_statement,
       p.proposed_action,
       p.goal_type,
       p.other_goal_type,
       p.impact_area,
       p.other_impact_area,
       p.status,
       p.priority_level,
       p.created_at,
       COALESCE(u.full_name, 'Unknown') AS author_name,
       COALESCE(cm.name, 'Unknown') AS community_name
     FROM petitions p
     LEFT JOIN users u ON u.user_id = p.author_id
     LEFT JOIN communities cm ON cm.community_id = p.community_id
     WHERE p.community_id = $1
     ORDER BY p.created_at DESC
     LIMIT 1`,
    [communityId]
  );
  const row = res.rows?.[0];
  if (!row) return null;
  return {
    type: 'petition',
    data: {
      petition_id: row.petition_id,
      title: row.title,
      summary: row.summary,
      problem_statement: row.problem_statement,
      proposed_action: row.proposed_action,
      goal_type: row.goal_type === 'Other' ? row.other_goal_type || row.goal_type : row.goal_type,
      impact_area: row.impact_area === 'Other' ? row.other_impact_area || row.impact_area : row.impact_area,
      status: row.status,
      author_name: row.author_name,
      community_name: row.community_name,
      priority_level: row.priority_level,
      created_at: row.created_at,
    },
  };
}

/**
 * Ask RAG chatbot with context
 */
async function askBot(question, communityId, userId, previousContext = null, itemContext = null) {
  const startTime = Date.now();
  
  try {
    // If itemContext wasn't provided by the client, try to infer from question (e.g. "complaint ID 22")
    let inferredRef = null;
    if (!itemContext) {
      const ref = extractItemReference(question);
      inferredRef = ref;
      if (ref?.type === 'complaint') {
        try {
          itemContext = await fetchComplaintItemContextById(ref.id, communityId);
        } catch (e) {
          logger.warn('Failed fetching complaint item context', { complaintId: ref.id, communityId, error: e?.message });
        }
      } else if (ref?.type === 'petition') {
        try {
          itemContext = await fetchPetitionItemContextById(ref.id, communityId);
        } catch (e) {
          logger.warn('Failed fetching petition item context', { petitionId: ref.id, communityId, error: e?.message });
        }
      }
    }
    let hasItemContext = !!(itemContext && itemContext.type && itemContext.data);
    if (inferredRef && !hasItemContext) {
      const sessionHash = generateSessionHash(userId, communityId);
      const answer =
        inferredRef.type === 'complaint'
          ? `Complaint #${inferredRef.id} was not found in this community.`
          : `Petition #${inferredRef.id} was not found in this community.`;
      await saveBotHistory({
        userId,
        communityId,
        question,
        answer,
        sessionHash,
        confidence: 0,
        sourceCount: 0,
        status: 'item_not_found',
      });
      return { answer, sources: [], confidence: 0, sessionHash };
    }

    // If user asked about complaint/petition without an ID, auto-pick the latest item in this community.
    if (!hasItemContext) {
      const q = String(question || '').toLowerCase();
      const mentionsComplaint = q.includes('complaint') || q.includes('complain');
      const mentionsPetition = q.includes('petition');

      if (mentionsComplaint || mentionsPetition) {
        try {
          if (mentionsComplaint && !mentionsPetition) {
            itemContext = await fetchLatestComplaintItemContext(communityId);
          } else if (mentionsPetition && !mentionsComplaint) {
            itemContext = await fetchLatestPetitionItemContext(communityId);
          } else if (mentionsComplaint && mentionsPetition) {
            const [latestC, latestP] = await Promise.all([
              fetchLatestComplaintItemContext(communityId),
              fetchLatestPetitionItemContext(communityId),
            ]);
            const cAt = latestC?.data?.created_at ? new Date(latestC.data.created_at).getTime() : -1;
            const pAt = latestP?.data?.created_at ? new Date(latestP.data.created_at).getTime() : -1;
            itemContext = cAt >= pAt ? latestC : latestP;
          }
        } catch (e) {
          logger.warn('Failed fetching latest item context', { communityId, error: e?.message });
        }
      }

      hasItemContext = !!(itemContext && itemContext.type && itemContext.data);
    }

    if (isSmallTalkQuery(question)) {
      const sessionHash = generateSessionHash(userId, communityId);
      const smallTalkAnswer = await generateGeneralAssistantAnswer(question);
      const answer =
        smallTalkAnswer ||
        "Hello! I'm here to help. You can ask me anything about your community or general questions.";

      await saveBotHistory({
        userId,
        communityId,
        question,
        answer,
        sessionHash,
        confidence: 72,
        sourceCount: 0,
        status: 'small_talk',
      });

      return {
        answer,
        sources: [],
        confidence: 72,
        sessionHash,
      };
    }

    const isIntentOrSummary =
      isSummaryQuery(question) ||
      isAnnouncementQuery(question) ||
      isAbuseQuery(question) ||
      isToxicityRatingQuery(question) ||
      isSentimentQuery(question) ||
      isTranslationQuery(question) ||
      isLanguageFilterQuery(question);

    if (isIntentOrSummary && !hasItemContext) {
      const fallbackSessionHash = generateSessionHash(userId, communityId);
      const chatSummary = await summarizeFromChatMessages(question, communityId);
      await saveBotHistory({
        userId,
        communityId,
        question,
        answer: chatSummary.answer,
        sessionHash: fallbackSessionHash,
        confidence: chatSummary.confidence,
        sourceCount: chatSummary.sourceCount,
        status: chatSummary.status,
      });
      return {
        answer: chatSummary.answer,
        sources: chatSummary.sources,
        confidence: chatSummary.confidence,
        sessionHash: fallbackSessionHash,
      };
    }

    const hasCommunityDocs = await tableExists('community_docs');

    if (!hasCommunityDocs) {
      const fallbackSessionHash = generateSessionHash(userId, communityId);
      const chatSummary = await summarizeFromChatMessages(question, communityId);

      await saveBotHistory({
        userId,
        communityId,
        question,
        answer: chatSummary.answer,
        sessionHash: fallbackSessionHash,
        confidence: chatSummary.confidence,
        sourceCount: chatSummary.sourceCount,
        status: chatSummary.status,
      });

      return {
        answer: chatSummary.answer,
        sources: chatSummary.sources,
        confidence: chatSummary.confidence,
        sessionHash: fallbackSessionHash,
      };
    }

    // Fast path: avoid expensive embedding/model work when no docs are available.
    const docCountResult = await query(
      'SELECT COUNT(*)::int AS count FROM community_docs WHERE community_id = $1',
      [communityId]
    );
    const docCount = docCountResult.rows?.[0]?.count || 0;
    if (docCount === 0) {
      // If itemContext provided, try answering from petition/complaint details
      if (itemContext && itemContext.type && itemContext.data) {
        const itemContextBlock = formatItemContext(itemContext);
        const itemPrompt = `You are a helpful assistant for petitions and complaints across ALL community types (hostels, societies, clubs, institutions, neighborhoods, etc.). Use the details below to answer. Correct errors, suggest solutions, or summarize as requested. Adapt solutions to the community context.

${itemContextBlock}

Question: ${question}

Answer:`;
        try {
          const llmResponse = await queryLLM(itemPrompt, null, 0.3);
          const answer = String(llmResponse?.response || '').trim();
          if (answer && !isLimitMessage(answer)) {
            const fallbackSessionHash = generateSessionHash(userId, communityId);
            await saveBotHistory({
              userId,
              communityId,
              question,
              answer,
              sessionHash: fallbackSessionHash,
              confidence: 85,
              sourceCount: 0,
              status: 'item_context_answer',
            });
            return {
              answer,
              sources: [],
              confidence: 85,
              sessionHash: fallbackSessionHash,
            };
          }
        } catch (err) {
          logger.warn('Item context answer failed (no docs)', { error: err?.message });
        }
      }
      const fallbackSessionHash = generateSessionHash(userId, communityId);
      const chatSummary = await summarizeFromChatMessages(question, communityId);
      await saveBotHistory({
        userId,
        communityId,
        question,
        answer: chatSummary.answer,
        sessionHash: fallbackSessionHash,
        confidence: chatSummary.confidence,
        sourceCount: chatSummary.sourceCount,
        status: chatSummary.status,
      });
      return {
        answer: chatSummary.answer,
        sources: chatSummary.sources,
        confidence: chatSummary.confidence,
        sessionHash: fallbackSessionHash,
      };
    }

    // Search for relevant documents
    const relevantDocs = await searchDocuments(question, communityId);
    
    // When itemContext (petition/complaint) is provided, answer using it even without docs
    if (relevantDocs.length === 0 && itemContext && itemContext.type && itemContext.data) {
      const itemContextBlock = formatItemContext(itemContext);
      const itemPrompt = `You are a helpful assistant for community petitions and complaints across ALL types of communities: hostels, residential societies, clubs, political groups, companies, educational institutions, neighborhoods, NGOs, and informal friend groups. The user is asking about a specific ${itemContext.type}. Use the details below to answer. Correct any errors in wording or structure, suggest improvements, summarize, or provide solution recommendations as requested.

${itemContextBlock}

Question: ${question}

Provide a helpful, accurate response based on the ${itemContext.type} details above. When suggesting solutions:
- For petitions: consider policy change, community action steps, stakeholder engagement, and implementation feasibility for the specific community type.
- For complaints: consider resolution steps, escalation paths, preventive measures, and follow-up actions appropriate to the community context.
- Adapt your language and recommendations to the community type (formal for institutions, practical for neighborhoods, etc.).`;
      try {
        const llmResponse = await queryLLM(itemPrompt, null, 0.3);
        const answer = String(llmResponse?.response || '').trim();
        if (answer && !isLimitMessage(answer)) {
          const noInfoSessionHash = generateSessionHash(userId, communityId);
          await saveBotHistory({
            userId,
            communityId,
            question,
            answer,
            sessionHash: noInfoSessionHash,
            confidence: 85,
            sourceCount: 0,
            status: 'item_context_answer',
          });
          return {
            answer,
            sources: [],
            confidence: 85,
            sessionHash: noInfoSessionHash,
          };
        }
      } catch (err) {
        logger.warn('Item context answer failed', { error: err?.message, communityId });
      }
    }
    
    if (relevantDocs.length === 0) {
      logger.info('No relevant documents found', { communityId, question });
      const noInfoSessionHash = generateSessionHash(userId, communityId);
      let noInfoAnswer =
        "I couldn't find related community documents. Please provide more community-specific context.";
      try {
        const general = await generateGeneralAssistantAnswer(question);
        if (general) {
          noInfoAnswer = `${general}\n\nNote: This answer is general because no related community documents were found.`;
        }
      } catch (error) {
        logger.warn('General answer fallback failed for no-relevant-docs path', {
          error: error.message,
          communityId,
        });
      }
      await saveBotHistory({
        userId,
        communityId,
        question,
        answer: noInfoAnswer,
        sessionHash: noInfoSessionHash,
        confidence: 0,
        sourceCount: 0,
        status: 'no_relevant_docs',
      });
      return {
        answer: noInfoAnswer,
        sources: [],
        confidence: 0,
        sessionHash: noInfoSessionHash,
      };
    }
    
    // Build context from documents
    const documentContext = relevantDocs
      .map((doc, idx) => `[Document ${idx + 1}] ${doc.title}\n${doc.content}`)
      .join('\n\n');
    
    const itemContextBlock = formatItemContext(itemContext);
    
    // Build prompt - include petition/complaint details when provided for correction, summarization, solution suggestions
    const prompt = `You are a helpful assistant for ALL types of communities: hostels, residential societies, clubs, political groups, companies, educational institutions, neighborhoods, NGOs, and informal friend groups. Answer the following question based on the provided context.
${itemContextBlock ? `\nIMPORTANT: The user is asking about a specific ${itemContext.type}. Use the details below to correct, improve, summarize, or suggest solutions. Adapt recommendations to the community type. For solution generation, consider best practices across formal and informal communities.` : ''}

Community Documents:
${documentContext}
${itemContextBlock}

Question: ${question}

Answer:`;
    
    // Query Ollama
    const llmResponse = await queryLLM(prompt, previousContext, 0.25);
    const llmAnswer = String(llmResponse.response || '').trim();
    if (isLimitMessage(llmAnswer)) {
      const fallbackSessionHash = generateSessionHash(userId, communityId);
      const chatSummary = await summarizeFromChatMessages(question, communityId);
      await saveBotHistory({
        userId,
        communityId,
        question,
        answer: chatSummary.answer,
        sessionHash: fallbackSessionHash,
        confidence: chatSummary.confidence,
        sourceCount: chatSummary.sourceCount,
        status: 'chat_fallback',
      });
      return {
        answer: chatSummary.answer,
        sources: chatSummary.sources,
        confidence: chatSummary.confidence,
        sessionHash: fallbackSessionHash,
      };
    }
    
    // Calculate confidence based on similarity scores
    const avgSimilarity = relevantDocs.reduce((sum, doc) => sum + doc.similarity, 0) / relevantDocs.length;
    const confidence = Math.round(avgSimilarity * 100);
    
    // Generate or retrieve session hash
    const sessionHash = previousContext 
      ? crypto.createHash('sha256').update(previousContext).digest('hex').substring(0, 16)
      : generateSessionHash(userId, communityId);
    
    // Store session context
    await setBotSession(sessionHash, {
      userId,
      communityId,
      context: llmResponse.context,
      lastQuestion: question,
      lastAnswer: llmResponse.response,
      timestamp: Date.now(),
    });
    
    const duration = Date.now() - startTime;
    logPerformance('Bot query (full)', duration);
    
    logger.info('Bot query completed', {
      communityId,
      userId,
      documentsUsed: relevantDocs.length,
      confidence,
      duration: `${duration}ms`,
    });

    await saveBotHistory({
      userId,
      communityId,
      question,
      answer: llmAnswer,
      sessionHash,
      confidence,
      sourceCount: relevantDocs.length,
      status: 'success',
    });
    
    return {
      answer: llmAnswer,
      sources: relevantDocs.map(doc => ({
        id: doc.id,
        title: doc.title,
        similarity: doc.similarity,
      })),
      confidence,
      sessionHash,
    };
  } catch (error) {
    if (isMissingRelation(error, 'community_docs')) {
      logger.warn('community_docs table missing; using graceful fallback response', {
        communityId,
        userId,
      });
      const fallbackSessionHash = generateSessionHash(userId, communityId);
      const chatSummary = await summarizeFromChatMessages(question, communityId);
      await saveBotHistory({
        userId,
        communityId,
        question,
        answer: chatSummary.answer,
        sessionHash: fallbackSessionHash,
        confidence: chatSummary.confidence,
        sourceCount: chatSummary.sourceCount,
        status: chatSummary.status,
        errorMessage: error.message,
      });
      return {
        answer: chatSummary.answer,
        sources: chatSummary.sources,
        confidence: chatSummary.confidence,
        sessionHash: fallbackSessionHash,
      };
    }
    if (String(error.message || '').includes('status code 400')) {
      const fallbackSessionHash = generateSessionHash(userId, communityId);
      const fallbackAnswer = 'AI model returned an invalid request error. Please try a shorter or clearer question.';
      await saveBotHistory({
        userId,
        communityId,
        question,
        answer: fallbackAnswer,
        sessionHash: fallbackSessionHash,
        confidence: 0,
        sourceCount: 0,
        status: 'llm_bad_request',
        errorMessage: error.message,
      });
      return {
        answer: fallbackAnswer,
        sources: [],
        confidence: 0,
        sessionHash: fallbackSessionHash,
      };
    }
    await saveBotHistory({
      userId,
      communityId,
      question,
      answer: 'Failed to process question',
      sessionHash: generateSessionHash(userId, communityId),
      confidence: 0,
      sourceCount: 0,
      status: 'error',
      errorMessage: error.message,
    });
    logger.error('Bot query error', { error: error.message, question, communityId });
    throw error;
  }
}

async function getBotHistory(communityId, userId, limit = 50) {
  try {
    await ensureBotHistoryTable();
    const boundedLimit = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 200);
    const result = await query(
      `SELECT id, user_id, community_id, question, answer, session_hash, confidence, source_count, status, created_at
       FROM bot_chat_history
       WHERE community_id = $1 AND user_id = $2
       ORDER BY created_at DESC
       LIMIT $3`,
      [communityId, userId, boundedLimit]
    );
    if (result.rows.length) return result.rows.reverse();

    // Fallback: show community history even if user_id changed between logins.
    const fallback = await query(
      `SELECT id, user_id, community_id, question, answer, session_hash, confidence, source_count, status, created_at
       FROM bot_chat_history
       WHERE community_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [communityId, boundedLimit]
    );
    return fallback.rows.reverse();
  } catch (error) {
    logger.error('Failed to fetch bot chat history', { error: error.message, communityId, userId });
    return [];
  }
}

async function deleteBotHistoryEntry(communityId, userId, historyId) {
  try {
    await ensureBotHistoryTable();
    const result = await query(
      `DELETE FROM bot_chat_history
       WHERE id = $1 AND community_id = $2 AND user_id = $3`,
      [historyId, communityId, userId]
    );
    return result.rowCount > 0;
  } catch (error) {
    logger.error('Failed to delete bot chat history entry', {
      error: error.message,
      communityId,
      userId,
      historyId,
    });
    throw error;
  }
}

async function clearBotHistory(communityId, userId) {
  try {
    await ensureBotHistoryTable();
    const result = await query(
      `DELETE FROM bot_chat_history
       WHERE community_id = $1 AND user_id = $2`,
      [communityId, userId]
    );
    return result.rowCount || 0;
  } catch (error) {
    logger.error('Failed to clear bot chat history', {
      error: error.message,
      communityId,
      userId,
    });
    throw error;
  }
}

/**
 * Continue conversation with context
 */
async function continueConversation(question, sessionHash, communityId, userId, itemContext = null) {
  try {
    // Retrieve previous session
    const session = await getBotSession(sessionHash);
    
    if (!session || session.communityId !== communityId) {
      logger.warn('Invalid or expired session', { sessionHash, communityId });
      return await askBot(question, communityId, userId, null, itemContext);
    }
    
    // Use previous context
    return await askBot(question, communityId, userId, session.context, itemContext);
  } catch (error) {
    logger.error('Conversation continuation error', { error: error.message });
    // Fallback to new conversation
    return await askBot(question, communityId, userId, null, itemContext);
  }
}

/**
 * Get document count for community
 */
async function getDocumentCount(communityId) {
  try {
    const hasCommunityDocs = await tableExists('community_docs');
    if (!hasCommunityDocs) return 0;

    const result = await query(
      'SELECT COUNT(*) as count FROM community_docs WHERE community_id = $1',
      [communityId]
    );
    
    return parseInt(result.rows[0].count);
  } catch (error) {
    logger.error('Document count error', { error: error.message });
    return 0;
  }
}

/**
 * Delete document
 */
async function deleteDocument(docId, communityId) {
  try {
    const result = await query(
      'DELETE FROM community_docs WHERE id = $1 AND community_id = $2 RETURNING id',
      [docId, communityId]
    );
    
    return result.rowCount > 0;
  } catch (error) {
    logger.error('Document deletion error', { error: error.message });
    throw error;
  }
}

/**
 * Check Ollama health
 */
async function checkOllamaHealth() {
  try {
    const response = await axios.get(`${OLLAMA_HOST}/api/tags`, {
      timeout: 5000,
    });
    
    return {
      available: true,
      models: response.data.models || [],
      provider: 'ollama',
    };
  } catch (error) {
    return {
      available: false,
      error: error.message,
      provider: 'ollama',
    };
  }
}

module.exports = {
  generateEmbedding,
  addDocument,
  searchDocuments,
  askBot,
  continueConversation,
  getDocumentCount,
  deleteDocument,
  checkOllamaHealth,
  queryLLM,
  queryOllama,
  getBotHistory,
  deleteBotHistoryEntry,
  clearBotHistory,
  translateText,
  detectLanguageOfText,
  detectLanguageOfMessages,
};