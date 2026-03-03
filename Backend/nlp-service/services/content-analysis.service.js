/**
 * NLP + LLM content analysis for complaints and petitions
 * Produces sentiment, toxicity, and LLM summary/verdict
 */
const { analyzeText } = require('./nlp.service');
const { queryOllama } = require('./rag.service');
const { logger } = require('../config/logger');

const OLLAMA_AVAILABLE_CHECK_INTERVAL = 60000; // 1 min
let ollamaAvailable = null;
let lastOllamaCheck = 0;

async function isOllamaAvailable() {
  if (Date.now() - lastOllamaCheck < OLLAMA_AVAILABLE_CHECK_INTERVAL) {
    return ollamaAvailable;
  }
  try {
    const { checkOllamaHealth } = require('./rag.service');
    const health = await checkOllamaHealth();
    ollamaAvailable = health.available;
    lastOllamaCheck = Date.now();
    return ollamaAvailable;
  } catch {
    ollamaAvailable = false;
    return false;
  }
}

/**
 * Analyze content with NLP (sentiment + toxicity) and LLM (summary + verdict)
 * @param {string} text - Content to analyze
 * @param {string} type - 'complaint' | 'petition'
 * @returns {Promise<{sentiment, toxicity, llmSummary, llmVerdict, safe}>}
 */
async function analyzeContentWithLLM(text, type = 'complaint') {
  const startTime = Date.now();

  try {
    // 1️⃣ NLP Analysis (sentiment + toxicity)
    const nlpResult = await analyzeText(text);

    const sentiment = {
      label: nlpResult.sentiment?.label || 'NEUTRAL',
      score: nlpResult.sentiment?.score ?? 0,
    };

    const toxicity = {
      label: nlpResult.toxicity?.isToxic ? 'toxic' : 'non-toxic',
      score: nlpResult.toxicity?.score ?? 0,
      isToxic: nlpResult.toxicity?.isToxic ?? false,
    };

    let llmSummary = null;
    let llmVerdict = null;

    // 2️⃣ LLM Analysis (if Ollama available)
    const useOllama = await isOllamaAvailable();
    if (useOllama && text && text.trim().length > 20) {
      try {
        const prompt = `You are an analyst. Analyze this ${type} text and respond in exactly 2 short lines:
Line 1 - SUMMARY: One sentence summary of the main issue (max 30 words).
Line 2 - VERDICT: One word - POSITIVE, NEGATIVE, NEUTRAL, or URGENT based on tone and urgency.

Text:
${text.slice(0, 1500)}

Respond with only the 2 lines, nothing else.`;

        const llmResult = await queryOllama(prompt, '', 0.3);
        const response = (llmResult?.response || '').trim();

        if (response) {
          const lines = response.split('\n').map((l) => l.trim()).filter(Boolean);
          if (lines.length >= 2) {
            llmSummary = lines[0].replace(/^(SUMMARY|summary):\s*/i, '').trim();
            llmVerdict = lines[1].replace(/^(VERDICT|verdict):\s*/i, '').trim().toUpperCase();
            if (!['POSITIVE', 'NEGATIVE', 'NEUTRAL', 'URGENT'].includes(llmVerdict)) {
              llmVerdict = 'NEUTRAL';
            }
          } else {
            llmSummary = lines[0] || response.slice(0, 150);
          }
        }
      } catch (llmErr) {
        logger.warn('LLM analysis skipped for content', {
          type,
          error: llmErr.message,
        });
      }
    }

    const duration = Date.now() - startTime;
    logger.info('Content analysis completed', {
      type,
      sentiment: sentiment.label,
      toxicity: toxicity.label,
      hasLlm: !!llmSummary,
      duration: `${duration}ms`,
    });

    return {
      sentiment,
      toxicity,
      llmSummary,
      llmVerdict,
      safe: !toxicity.isToxic,
      processingTime: duration,
    };
  } catch (error) {
    logger.error('Content analysis error', { error: error.message, type });
    throw error;
  }
}

module.exports = {
  analyzeContentWithLLM,
  isOllamaAvailable,
};
