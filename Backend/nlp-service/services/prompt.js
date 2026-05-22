/**
 * Comprehensive Prompt Templates for Community RAG System
 * Works like ChatGPT/Gemini - Natural, intelligent, context-aware
 * Handles ALL community types and all NLP tasks
 */

const SYSTEM_CONTEXT = `You are an intelligent community assistant.
Rules:
1. Response ONLY in perfect, grammatical English for the main answer. Avoid broken English or literal translations. If any input or context contains Tamil/Tanglish text, automatically translate and answer in English.
2. Use explicit labels for Summary and Solution.
3. Use this format for each item:
   <number>. [Short English Title]
   Summary: [Provide a clear, detailed yet concise summary in natural English]
   Solution: [Provide a practical, actionable solution in natural English]
4. Identify all distinct issues separately. GROUP identical issues together. Do NOT repeat the same issue multiple times.
5. Do NOT mention sender names.
6. Ensure the tone is professional and helpful.
7. Output ONLY the numbered list. No preamble, no "Sure", no "Here is the summary".
8. For each issue, use this exact compact format:
   1. [Short English Title]
   Summary: [Detailed English summary]
   Solution: [Actionable English fix]
   (Repeat for all issues, with one blank line between items)
9. If any input is in Tamil/Tanglish, translate and incorporate it into the English summary. Do NOT omit any details.`;

/**
 * SOLUTIONS PROMPT - Provides actionable, specific fixes
 */
function getSolutionsPrompt(issuesList, question) {
  return `${SYSTEM_CONTEXT}

**User's Request:** ${question}

**Community Issues Identified:**
${issuesList}

**Your Task:** Provide direct, authoritative, and actionable SOLUTIONS (not just recommendations) for each issue.

**Critical Instructions:**
1. Use strong command verbs (e.g., "Repair", "Deploy", "Install", "Replace", "Terminate").
2. AVOID passive or suggestive language like "should", "could", "can", "residents may", or "please consider".
3. For SAFETY issues (abuse, harassment, violence) → ALWAYS prioritize and provide immediate, forceful actions.
4. For each issue, provide:
   - **Immediate Forceful Action** (what to do RIGHT NOW)
   - **Technical Implementation** (concrete steps)
   - **Deadline** (when to complete)
5. Be extremely specific. Instead of "talk to management", use "Lodge formal notice to [Specific Dept] with 24h deadline".

**Output Format:**

Solutions:

1. **[Issue Name]**
   - Immediate action: [Specific command verb action]
   - How to implement: [Step 1], [Step 2], [Step 3]
   - Deadline: [Specific timeframe]
   - Priority: [High/Medium/Low]

2. **[Next Issue]**
   ...

**CRITICAL:** For safety issues, ALWAYS include:
- Reporting to authorities immediately
- Physical security deployment
- Immediate suspension/banning if applicable

Answer with ONLY the solutions in the format above:`;
}

/**
 * RECOMMENDATIONS PROMPT - Strategic guidance
 */
function getRecommendationsPrompt(issuesList, question) {
  return `${SYSTEM_CONTEXT}

**User's Request:** ${question}

**Community Issues:**
${issuesList}

**Your Task:** Provide strategic RECOMMENDATIONS to address these issues systematically.

**Instructions:**
1. Think about root causes, not just symptoms
2. Organize by timeframe: immediate, short-term, long-term
3. Consider sustainability and prevention
4. Balance cost, effort, and impact
5. Be specific and actionable

**Output Format:**

Recommendations:

**Immediate Actions (Next 24-48 hours):**
1. [Action] - [Why this is critical]
2. [Action] - [Why this is critical]

**Short-term Improvements (1-4 weeks):**
1. [System/Process improvement] - [Expected outcome]
2. [System/Process improvement] - [Expected outcome]

**Long-term Strategy (1-6 months):**
1. [Structural change] - [Long-term benefit]
2. [Structural change] - [Long-term benefit]

**Prevention Measures:**
1. [How to prevent recurrence]
2. [How to prevent recurrence]

Answer with ONLY the recommendations in the format above:`;
}

/**
 * SUMMARY PROMPT — concise English; preserves numbering and **Summary:** / **Solution:**
 */
function getSummaryPrompt(transcript, question, includeRecommendations = false) {
  return `You are an intelligent multilingual community chat analyst. Reply in English ONLY for the main answer.

User request: ${question}

Transcript:
${transcript}

Instructions:
1. List each distinct issue as a numbered Item (1., 2., ...). GROUP identical or similar issues together. Do NOT repeat the same issue multiple times. Cover EVERY substantive issue in the transcript, especially those discussed in Tamil or Tanglish.
2. For specific issues, you MUST provide exactly one 'Summary:' label AND exactly one 'Solution:' label. However, if the user's request is just asking for a count or a general question (e.g., "how many chats"), just provide the summary/answer alone WITHOUT splitting into 'Summary:' and 'Solution:'.
3. For the title/label of each item, provide a short descriptive title in English (translate to English if the message was in Tamil).
4. Summary: Provide a clear, detailed explanation of the issue in natural English. DO NOT omit details from Tamil messages.
5. Solution: You MUST provide a direct, authoritative, and concrete fix. Use command verbs (e.g., "Deploy", "Repair", "Fix", "Install"). Avoid "should", "could", "can", or "recommend". Tell the user exactly WHAT MUST BE DONE.
6. Keep each section tight (2-4 short sentences). No sender names. If any text is in Tamil or Tanglish, translate it and answer in English. Ensure ALL Tamil input context is represented in the English output.
7. Output ONLY the numbered list. No extra text before or after.

1. [Short English Title]
Summary: [Clear, detailed English summary representing all inputs including Tamil/Tanglish]
Solution: [Direct, authoritative, command-based fix in English]

2. [Next English Title]
Summary: ...
Solution: ...

Rules:
- NO blank lines between Summary and Solution.
- Provide a descriptive title for each item.
- Answer ONLY in English.
- Translate all Tamil/Tanglish inputs accurately into the English summary.
- COVER EVERY substantive issue.
- If the user asks a general question or count, provide the answer directly without Summary/Solution labels.`;
}

/**
 * Strict translation-only: English summary → Tamil. No summarization, no new ideas.
 */
const PROMPT_SUMMARY_TRANSLATE_ENGLISH_TO_TAMIL = (text) => `You are a mechanical translator. Your ONLY job is to convert the English below into Tamil.

FORBIDDEN:
- Do NOT add sentences, examples, warnings, or advice that are not in the English.
- Do NOT summarize, expand, explain, or "improve" the content.
- Do NOT output anything except the Tamil translation of this exact text.

REQUIRED:
- Preserve every numbered line (1., 2., …), line breaks, and markdown.
- Map Summary: → சுருக்கம்: and Solution: → தீர்வு: exactly as many times as in the source.
- Use natural spoken Tamil but keep the same points as the English; same order.
- Temperature is zero: translate meaning faithfully and concisely.

English text to translate (translate ALL of it, nothing else):
${text}`;

const PROMPT_SUMMARY_TRANSLATE_ENGLISH_TO_TAMIL_RETRY = (text) => `${PROMPT_SUMMARY_TRANSLATE_ENGLISH_TO_TAMIL(text)}

CRITICAL RETRY: Your previous output may have added content not in the English above. 
Translate again. Same number of numbered items as the English. No extra paragraphs. Tamil only.`;

/**
 * GENERAL QUESTION PROMPT - ChatGPT-style responses
 */
function getGeneralQuestionPrompt(transcript, question) {
  return `You are an intelligent multilingual AI assistant for analyzing chats, complaints, and petitions.

User's Question: ${question}

Context to analyze:
${transcript}

Task: Answer accurately in perfect English. If any text or context is in Tamil, translate it and provide the answer in English.

Instructions:
1. Provide a clear, direct answer to the user's question.
2. For general questions or counts (e.g., "how many chats"), provide the summary or answer ALONE. Do NOT split the answer into 'Summary:' and 'Solution:'.
3. Respond ONLY in high-quality, grammatical English.
4. Keep your answer concise and helpful.
5. If no specific records are found, still provide a general response based on the user's intent.

Output Format:
Provide a clear, direct answer to the user's question in plain text.`;
}

/**
 * SENTIMENT ANALYSIS PROMPT
 */
function getSentimentPrompt(messagesList, question) {
  return `${SYSTEM_CONTEXT}

**User's Request:** ${question}

**Messages to Analyze:**
${messagesList}

**Your Task:** Analyze sentiment in these messages.

**Instructions:**
1. Identify messages with clear emotional tone
2. Ignore neutral/factual statements
3. Categorize by positive/negative
4. Provide brief context

**Output Format:**

${question.toLowerCase().includes('top') || question.toLowerCase().includes('most') ? `
High-Sentiment Messages:

**Positive:**
1. [Message text] - Strength: [X]/100
2. [Message text] - Strength: [X]/100

**Negative:**
1. [Message text] - Strength: [X]/100
2. [Message text] - Strength: [X]/100
` : `
Sentiment Analysis:

**Positive Messages:**
1. [Message text]
2. [Message text]

**Negative Messages:**
1. [Message text]
2. [Message text]

**Overall Mood:** [Positive/Neutral/Negative]
`}

Answer with ONLY the sentiment analysis:`;
}

/**
 * TOXICITY ANALYSIS PROMPT
 */
function getToxicityPrompt(messagesList, question) {
  return `${SYSTEM_CONTEXT}

**User's Request:** ${question}

**Messages to Review:**
${messagesList}

**Your Task:** Identify toxic, abusive, or offensive content.

**Look for:**
- Abusive language, insults, name-calling
- Harassment, threats, intimidation
- Hate speech, discrimination
- Aggressive/hostile tone
- Excessive profanity in inappropriate context

**Context Matters:** Some strong language may be acceptable in informal groups. Focus on actual abuse.

**Output Format:**

${question.toLowerCase().includes('rate') || question.toLowerCase().includes('score') ? `
Toxicity Assessment:

**Overall Rating:** [Low/Moderate/High]
**Toxicity Score:** [X]/100

**Analysis:**
- Total messages reviewed: [N]
- Potentially toxic messages: [N]
- Severity level: [Description]

**Flagged Messages:**
1. [Message] - Reason: [Why toxic]
2. [Message] - Reason: [Why toxic]

**Pattern:** [One-time incident / Ongoing issue / Multiple users involved]
` : `
Potentially Toxic Messages:

1. [Message text] - Concern: [Harassment/Abuse/Aggression]
2. [Message text] - Concern: [Specific issue]

**Overall Assessment:** [Brief analysis]
`}

Answer with ONLY the toxicity analysis:`;
}

/**
 * CATEGORIZATION PROMPT
 */
function getCategorizationPrompt(messagesList, question) {
  return `${SYSTEM_CONTEXT}

**User's Request:** ${question}

**Messages to Categorize:**
${messagesList}

**Your Task:** Organize messages by topic/category.

**Common Categories:**
- Safety & Security
- Maintenance & Repairs
- Facilities & Amenities
- Rules & Policies
- Finance & Fees
- Events & Activities
- Complaints & Issues
- Announcements & Notices
- General Discussion

**Output Format:**

Topics Discussed:

1. **[Category Name]** ([X] messages)
   - [Key point 1]
   - [Key point 2]
   - [Key point 3]

2. **[Category Name]** ([X] messages)
   - [Key point 1]
   - [Key point 2]

**Priority Topics:** [Which topics need immediate attention]

Answer with ONLY the categorization:`;
}

/**
 * DUPLICATION DETECTION PROMPT
 */
function getDuplicationPrompt(messagesList, question) {
  return `${SYSTEM_CONTEXT}

**User's Request:** ${question}

**Messages to Analyze:**
${messagesList}

**Your Task:** Find duplicate, repeated, or recurring issues.

**Instructions:**
1. Identify messages discussing the same issue
2. Distinguish between:
   - Same person repeating (follow-up)
   - Multiple people reporting (widespread issue)
   - Recurring problem over time (systemic issue)
3. Highlight most urgent duplicates

**Output Format:**

Duplicate Issues Found:

1. **[Issue Name]** - Reported [X] times
   - First mentioned: [When/by whom]
   - Also mentioned by: [Others]
   - Pattern: [Recurring problem / Multiple reporters / Follow-ups]
   - Urgency: [High/Medium/Low]

2. **[Issue Name]** - Reported [X] times
   ...

**Priority:** [Which duplicates indicate urgent problems]

Answer with ONLY the duplication analysis:`;
}

/**
 * ANNOUNCEMENT EXTRACTION PROMPT
 */
function getAnnouncementPrompt(messagesList, question) {
  return `${SYSTEM_CONTEXT}

**User's Request:** ${question}

**Messages to Review:**
${messagesList}

**Your Task:** Extract and summarize official announcements or important notices.

**Instructions:**
1. Identify announcement-type messages
2. Extract key information: What, When, Who, Why, Action Required
3. Prioritize by importance/urgency
4. Use clear, concise language

**Output Format:**

Recent Announcements:

1. **[Announcement Title/Topic]**
   - What: [Description]
   - When: [Date/Time]
   - Who: [Sender/Department if relevant]
   - Action Required: [What members need to do, if anything]
   - Urgency: [High/Medium/Low]

2. **[Next Announcement]**
   ...

Answer with ONLY the announcements:`;
}

/**
 * APPROVAL SUGGESTION PROMPT
 */
function getApprovalSuggestionPrompt(item, type) {
  const isPetition = type === 'petition';
  const itemSummary = isPetition
    ? `Title: ${item.title}\nSummary: ${item.summary}\nProposed Action: ${item.proposed_action}\nPriority: ${item.priority_level}`
    : `Title: ${item.title}\nDescription: ${item.description}\nCategory: ${item.category}\nSeverity: ${item.severity}\nUrgent: ${item.is_urgent ? 'Yes' : 'No'}`;

  return `${SYSTEM_CONTEXT}

**Item Type:** ${isPetition ? 'Petition' : 'Complaint'}
**Content:**
${itemSummary}

**Your Task:** Review this ${isPetition ? 'petition' : 'complaint'} and provide a recommendation for its status.

**Instructions:**
1. Analyze if the request is reasonable, clear, and follows community guidelines.
2. Recommend a status: "Approved" or "Rejected".
3. Provide a short, 1-2 sentence justification for your recommendation.
4. If "Approved", suggest any immediate next steps.
5. If "Rejected", explain what's missing or why it cannot be approved.

**Output Format:**

Recommendation: [Approved/Rejected]
Justification: [Your reasoning]
Suggested Remarks: [A polite message for the user]

Answer with ONLY the recommendation in the format above:`;
}

/**
 * Main function to get appropriate prompt
 */
function getPrompt(intentType, data, question, options = {}) {
  // Determine intent if not provided
  const intent = intentType || detectIntent(question);

  switch (intent) {
    case 'solutions':
      return getSolutionsPrompt(data, question);

    case 'recommendations':
      return getRecommendationsPrompt(data, question);

    case 'summary':
      return getSummaryPrompt(data, question, options.includeRecommendations || false);

    case 'sentiment':
      return getSentimentPrompt(data, question);

    case 'toxicity':
    case 'abuse':
      return getToxicityPrompt(data, question);

    case 'categorization':
    case 'topics':
      return getCategorizationPrompt(data, question);

    case 'duplication':
    case 'duplicates':
      return getDuplicationPrompt(data, question);

    case 'announcement':
    case 'announcements':
      return getAnnouncementPrompt(data, question);

    case 'suggest_action':
      return getApprovalSuggestionPrompt(data, options.itemType);

    case 'list':
      return getListRecordsPrompt(data, question, options.showName || false);

    case 'general':
    default:
      return getGeneralQuestionPrompt(data, question);
  }
}

/**
 * Detect user intent from question
 */
function detectIntent(question) {
  const q = question.toLowerCase();

  // Solutions (actionable fixes)
  if (q.match(/\b(solution|solve|fix|how to fix|how do i fix|resolve|address)/)) {
    return 'solutions';
  }

  // Recommendations (strategic suggestions)
  if (q.match(/\b(recommend|suggestion|suggest|advice|what should|what can|next step)/)) {
    return 'recommendations';
  }

  // Summary
  if (q.match(/\b(summar|sumar|overview|recap|highlight|key point|brief|short summary)/)) {
    return 'summary';
  }

  // Sentiment
  if (q.match(/\b(sentiment|feeling|mood|emotion|tone|positive|negative)/)) {
    return 'sentiment';
  }

  // Toxicity/Abuse
  if (q.match(/\b(toxic|abuse|abusive|offensive|inappropriate|bad word|harsh|rude)/)) {
    return 'toxicity';
  }

  // Categorization
  if (q.match(/\b(categor|topic|theme|group by|classify|organize)/)) {
    return 'categorization';
  }

  // Duplication
  if (q.match(/\b(duplicate|repeated|recurring|same issue|multiple time)/)) {
    return 'duplication';
  }

  // Announcements
  if (q.match(/\b(announcement|notice|notification|official message)/)) {
    return 'announcement';
  }

  // List/Show records
  if (
    (q.match(/\b(list|show|fetch|search|view|get)\b/)) &&
    q.match(/\b(record|message|complaint|petition|chat|entries|entry|detail|item|history)s?\b/)
  ) {
    return 'list';
  }

  return 'general';
}

/**
 * LIST RECORDS PROMPT - Only display records, no suggestions or solutions
 */
function getListRecordsPrompt(data, question, showName = false) {
  return `You are an intelligent community assistant.
User's Request: ${question}

Records to display:
${data}

Task: Display the records as a clean list.
Rules:
1. Show only the requested details.
2. For each item, show: Content, Status, and Priority (unless specific fields were asked).
3. ${showName ? 'Include the Name/Author of each record.' : 'Do NOT include names/authors unless specifically asked.'}
4. Respond ONLY in English.
5. NO BOLDING. Use plain text.
6. ABSOLUTELY NO SUGGESTIONS AND NO SOLUTIONS.
7. If no records are found, state clearly that no records match the criteria.

Format:
1. Content: [Content] | Status: [Status] | Priority: [Priority] ${showName ? '| Name: [Name]' : ''}
2. Content: [Content] | Status: [Status] | Priority: [Priority] ${showName ? '| Name: [Name]' : ''}

Output ONLY the list:`;
}

/**
 * Format messages for prompt (as list)
 */
function formatMessagesAsList(messages) {
  return messages
    .map((m, i) => `${i + 1}. ${m.content || m}`)
    .join('\n');
}

/**
 * Format messages for prompt (as transcript with timestamps)
 */
function formatMessagesAsTranscript(messages) {
  return messages
    .map((m) => {
      const sender = m.sender_name || 'User';
      const content = m.content || m;
      // Simpler format for model: "Sender: Content"
      return `${sender}: ${content}`;
    })
    .join('\n');
}


const PROMPT_DETECT_LANGUAGE = (text) => `You are a language detection expert.
Detect the language of the following text and respond with ONLY the language name in English (e.g., "Tamil", "Hindi", "Spanish", "French", "Arabic", etc.).
Do not include any explanation, punctuation, or extra text. Just the language name.

Text:
${text}

Language:`;

// Translate text to a target language
const PROMPT_TRANSLATE = (text, sourceLang, targetLang) => `You are a professional translator.
Translate the following ${sourceLang} text to ${targetLang}.

Rules:
- Output ONLY the translated text
- Do not add any explanation, preamble, or notes
- Preserve formatting (bullet points, numbers, line breaks)
- Keep proper nouns as-is unless they have a well-known translation
- Be natural, fluent, and grammatically correct in the target language.
- If the target language is English, ensure it sounds native and professional.

Text to translate:
${text}

${targetLang} translation:`;

// Translate and analyse messages in a specific language
const PROMPT_TRANSLATE_AND_ANALYSE = (messagesList, sourceLang, targetLang, question) => `You are a multilingual community chat analyst.

The following community messages are in ${sourceLang}. 
First translate each message to ${targetLang}, then analyse them to answer the question.

Messages:
${messagesList}

Question: ${question}

Respond in ${targetLang} with:
1. A brief translated summary of each message (numbered)
2. Your analysis/answer to the question based on the translated content

Format:
### Translated Messages:
[numbered list of translated messages]

### Analysis:
[your answer to the question]`;

// Summarise in target language
const PROMPT_SUMMARISE_IN_LANGUAGE = (transcript, targetLang, question) => `You are a multilingual community assistant.
Analyse the following community chat and answer the question. 
Respond entirely in ${targetLang}.

Chat:
${transcript}

Question: ${question}

Answer (in ${targetLang}):`;

// Analyse a multilingual user message
const PROMPT_MULTILINGUAL_ANALYSIS = (message, question = '') => `You are an intelligent multilingual AI assistant for analyzing chats, complaints, and petitions.

${question ? `User request: ${question}` : ''}

Strict Rules:
1. ALWAYS respond in perfect, grammatical English only for the main answer. Ensure natural phrasing. If any input is in Tamil/Tanglish, translate and answer in English. Ensure NO content from Tamil messages is omitted.
2. If the user asks a general question or asks for a count (e.g., "how many chats"), just provide the summary/answer alone. Do NOT split it into 'Summary:' and 'Solution:'.
3. If the user asks for a "summary" (or "summarize" / "overview" / "recap" / "key points"), or for specific issues/petitions/complaints, you MUST format each item with exactly one 'Summary:' label AND exactly one 'Solution:' label:
   <number>. [Short English Title for the issue]
   Summary: [Detailed summary in high-quality English representing all input context]
   Solution: [Direct, authoritative, and command-based fix in English]
7. Output ONLY the numbered list. No preamble, no "Sure", no "Here is the summary".
8. For each item, use this exact compact format with sequential numbering (1., 2., 3...):
   1. Petition #1. [Short English Title]
   Summary: [Detailed English summary]
   Solution: [Direct, authoritative fix in English]

   2. Petition #2. [Short English Title]
   Summary: [Detailed English summary]
   Solution: [Direct, authoritative fix in English]
   (One blank line between items. If complaints, use "Complaint #X")

9. If (and ONLY if) no records or data are found in the input, respond exactly with: "I couldn't find any specific records for your request, but I'm here to help with general questions."

Analyze this input:
${message}`;

// Analyse a multilingual complaint user message (NO mentions of "petition" / "petitions")
const PROMPT_MULTILINGUAL_COMPLAINT_ANALYSIS = (message, question = '') => `You are an intelligent multilingual AI assistant for analyzing community chats and complaints.

${question ? `User request: ${question}` : ''}

Strict Rules:
1. ALWAYS respond in perfect, grammatical English only for the main answer. Ensure natural phrasing. If any input is in Tamil/Tanglish, translate and answer in English. Ensure NO content from Tamil messages is omitted.
2. If the user asks a general question or asks for a count (e.g., "how many chats"), just provide the summary/answer alone. Do NOT split it into 'Summary:' and 'Solution:'.
3. If the user asks for a "summary" (or "summarize" / "overview" / "recap" / "key points"), or for specific issues/complaints, you MUST format each item with exactly one 'Summary:' label AND exactly one 'Solution:' label:
   <number>. [Short English Title for the issue]
   Summary: [Detailed summary in high-quality English representing all input context]
   Solution: [Direct, authoritative, and command-based fix in English]
7. Output ONLY the numbered list. No preamble, no "Sure", no "Here is the summary".
8. For each item, use this exact compact format with sequential numbering (1., 2., 3...):
   1. Complaint #1. [Short English Title]
   Summary: [Detailed English summary]
   Solution: [Direct, authoritative fix in English]

   2. Complaint #2. [Short English Title]
   Summary: [Detailed English summary]
   Solution: [Direct, authoritative fix in English]
   (One blank line between items)

9. If (and ONLY if) no records or data are found in the input, respond exactly with: "I couldn't find any specific records for your request, but I'm here to help with general questions."

Analyze this input:
${message}`;

const PROMPT_NOTIFICATION_SUMMARY = (postContent) => `You are a notification summarization system.
Your task is to summarize the following post content in maximum 12 words (clear English).
Output ONLY the summary text, nothing else. No quotes, no preamble.

Post Content:
${postContent}

Summary:`;

const PROMPT_NORMALIZE_ENGLISH_FOR_TAMIL = (text) => `You are an English clarification layer for Tamil translation.

Your job is to improve readability WITHOUT changing meaning.

Rules:
1. Rewrite only grammar, readability, and clarity issues.
2. Preserve original meaning exactly.
3. Do NOT replace nouns, entities, device names, or technical terms unless confidence is very high.
4. If a word is ambiguous, preserve the original word instead of guessing.
5. Resolve ambiguous words from surrounding context only when strongly supported.
   - Example: "current" may mean electricity/power only in electrical contexts.
6. Fix awkward phrasing into natural English.
7. Avoid word-by-word rewriting; prefer sentence-level clarification.
8. Do NOT add, remove, summarize, or invent content.
9. Preserve formatting exactly:
   - Summary
   - Solution
   - numbering
   - markdown
   - line breaks
10. Preserve proper nouns, identifiers, model names, and technical labels exactly.
11. Output ONLY the clarified English text.

Text:
${text}`;

const PROMPT_TRANSLATE_ENGLISH_TO_TAMIL = (text) => `You are a professional English-to-Tamil translator.

Before translating:
- Detect unclear, awkward, or ambiguous English.
- Rewrite internally into clear natural English.
- Understand technical context correctly.

Examples:
- "current" may mean electricity/power or currently used.
- "setup" may mean environment/system configuration.

Translation Rules:
- Do NOT translate word-by-word.
- Do NOT invent content.
- Preserve exact meaning.
- Use simple natural spoken Tamil.
- Preserve numbering, markdown, and formatting.
- Translate labels: "**Summary:**" becomes "**சுருக்கம்:**" and "**Solution:**" becomes "**தீர்வு:**".
- Output only Tamil.

Text:
${text}`;

function getComplaintSummaryPrompt(transcript, question) {
  return `You are an intelligent multilingual community complaint analyst. Reply in English ONLY for the main answer.

User request: ${question}

Complaints Transcript:
${transcript}

Instructions:
1. List each distinct complaint as a numbered Item (1., 2., ...). GROUP identical or similar complaints together. Cover EVERY complaint in the transcript, especially those discussed in Tamil or Tanglish.
2. For each complaint, you MUST provide exactly one 'Summary:' label AND exactly one 'Solution:' label.
3. For the title/label of each item, provide a short descriptive title in English (translate to English if the complaint was in Tamil).
4. Summary: Provide a clear, detailed explanation of the complaint in natural English. DO NOT omit details from Tamil messages.
5. Solution: You MUST provide a direct, authoritative, and concrete fix. Use command verbs (e.g., "Repair", "Replace", "Fix", "Resolve", "Deploy"). Tell the user exactly WHAT MUST BE DONE.
6. Keep each section tight (2-4 short sentences). No resident names. Ensure all Tamil input context is represented in the English output.
7. Output ONLY the numbered list. No extra text before or after.

Format:
1. Complaint #1: [Short English Title]
Summary: [Detailed English summary representing all input context]
Solution: [Direct, authoritative fix in English]

2. Complaint #2: [Short English Title]
Summary: ...
Solution: ...

Rules:
- NO blank lines between Summary and Solution.
- Provide a descriptive title for each item.
- Answer ONLY in English.
- Translate all Tamil/Tanglish inputs accurately.`;
}

function getPetitionSummaryPrompt(transcript, question) {
  return `You are an intelligent multilingual community petition analyst. Reply in English ONLY for the main answer.

User request: ${question}

Petitions Transcript:
${transcript}

Instructions:
1. List each distinct petition as a numbered Item (1., 2., ...). GROUP identical or similar petitions together. Cover EVERY petition in the transcript, especially those discussed in Tamil or Tanglish.
2. For each petition, you MUST provide exactly one 'Summary:' label AND exactly one 'Solution:' label.
3. For the title/label of each item, provide a short descriptive title in English (translate to English if the petition was in Tamil).
4. Summary: Provide a clear, detailed explanation of the petition in natural English. DO NOT omit details from Tamil messages.
5. Solution: You MUST provide a direct, authoritative, and concrete suggested action or fix. Use command verbs (e.g., "Approve", "Review", "Extend", "Provide"). Tell the user exactly WHAT MUST BE DONE.
6. Keep each section tight (2-4 short sentences). No resident names. Ensure all Tamil input context is represented in the English output.
7. Output ONLY the numbered list. No extra text before or after.

Format:
1. Petition #1: [Short English Title]
Summary: [Detailed English summary representing all input context]
Solution: [Direct, authoritative suggested action in English]

2. Petition #2: [Short English Title]
Summary: ...
Solution: ...

Rules:
- NO blank lines between Summary and Solution.
- Provide a descriptive title for each item.
- Answer ONLY in English.
- Translate all Tamil/Tanglish inputs accurately.`;
}

module.exports = {
  getPrompt,
  detectIntent,
  formatMessagesAsList,
  formatMessagesAsTranscript,
  getSolutionsPrompt,
  getRecommendationsPrompt,
  getSummaryPrompt,
  getComplaintSummaryPrompt,
  getPetitionSummaryPrompt,
  PROMPT_SUMMARY_TRANSLATE_ENGLISH_TO_TAMIL,
  PROMPT_SUMMARY_TRANSLATE_ENGLISH_TO_TAMIL_RETRY,
  getGeneralQuestionPrompt,
  getSentimentPrompt,
  getToxicityPrompt,
  getParaphrasePrompt: null, // Keep placeholder if any
  getCategorizationPrompt,
  getDuplicationPrompt,
  getAnnouncementPrompt,
  getApprovalSuggestionPrompt,
  SYSTEM_CONTEXT,
  PROMPT_DETECT_LANGUAGE,
  PROMPT_TRANSLATE,
  PROMPT_TRANSLATE_AND_ANALYSE,
  PROMPT_SUMMARISE_IN_LANGUAGE,
  PROMPT_MULTILINGUAL_ANALYSIS,
  PROMPT_MULTILINGUAL_COMPLAINT_ANALYSIS,
  PROMPT_NOTIFICATION_SUMMARY,
  PROMPT_NORMALIZE_ENGLISH_FOR_TAMIL,
  PROMPT_TRANSLATE_ENGLISH_TO_TAMIL,
};