/**
 * Comprehensive Prompt Templates for Community RAG System
 * Works like ChatGPT/Gemini - Natural, intelligent, context-aware
 * Handles ALL community types and all NLP tasks
 */

const SYSTEM_CONTEXT = `You are a concise community AI assistant.
Rules:
- Response ONLY in English.
- Identify all distinct issues separately.
- Summary: 2 lines max per point. Use Numbers (1. 2. 3.).
- Solutions: Actionable steps for each point. Use Numbers (1. 2. 3.).
- NO BOLDING. Plain text only. No asterisks (**).
- Maximum 200 words.`;

/**
 * SOLUTIONS PROMPT - Provides actionable, specific fixes
 */
function getSolutionsPrompt(issuesList, question) {
  return `${SYSTEM_CONTEXT}

**User's Request:** ${question}

**Community Issues Identified:**
${issuesList}

**Your Task:** Provide specific, actionable SOLUTIONS (not just recommendations) for each issue.

**Critical Instructions:**
1. For SAFETY issues (abuse, harassment, violence) → ALWAYS prioritize and provide immediate actions
2. For each issue, provide:
   - **Immediate Action** (what to do RIGHT NOW)
   - **How to Implement** (concrete steps)
   - **Timeline** (when to complete)
3. Be specific, not vague (e.g., "File police complaint" not "consider reporting")
4. Use professional, clear language
5. Number your solutions clearly

**Output Format:**

Solutions:

1. **[Issue Name]**
   - Immediate action: [Specific action to take now]
   - How to implement: [Step 1], [Step 2], [Step 3]
   - Timeline: [When to complete]
   - Priority: [High/Medium/Low]

2. **[Next Issue]**
   ...

**CRITICAL:** For safety issues involving abuse, harassment, or violence, ALWAYS include:
- Filing police complaint/security report
- Ensuring victim safety
- Installing security measures
- Creating prevention systems

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
 * SUMMARY PROMPT - Clean overview
 */
function getSummaryPrompt(transcript, question, includeRecommendations = false) {
  return `You are an intelligent multilingual AI assistant for analyzing chats, complaints, and petitions.

User's Request: ${question}

Transcript to analyze:
${transcript}

Task: Provide clear summary points and solutions in English.

Instructions:
1. List each distinct issue separately as a numbered Item.
2. For each Item, provide a brief Summary and a practical Solution.
3. No names. Respond ONLY in English.
4. Translate internally if needed, but do not show translations.
5. NO BOLDING. Use plain text only.

Output Format:

Item <number>:
Summary:
<Short and clear summary>

Solution:
<Practical and actionable solution>

Answer using ONLY this format:`;
}

/**
 * GENERAL QUESTION PROMPT - ChatGPT-style responses
 */
function getGeneralQuestionPrompt(transcript, question) {
  return `You are an intelligent multilingual AI assistant for analyzing chats, complaints, and petitions.

User's Question: ${question}

Context to analyze:
${transcript}

Task: Answer accurately in English.

Instructions:
1. Provide a concise summary and practical solutions as a numbered Item.
2. Respond ONLY in English.
3. Translate internally if needed, but do not show translations.
4. NO BOLDING. Use plain text only.

Output Format:

Item 1:
Summary:
<Concise answer summary in English>

Solution:
<Practical solutions or actionable suggestions in English>`;
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

  return 'general';
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
      const time = m.created_at ? new Date(m.created_at).toLocaleString('en-US') : '';
      const sender = m.sender_name || 'User';
      const content = m.content || m;
      return time ? `[${time}] ${sender}: ${content}` : `${sender}: ${content}`;
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
- Be natural and fluent in the target language

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
const PROMPT_MULTILINGUAL_ANALYSIS = (message) => `You are an intelligent multilingual AI assistant for analyzing chats, complaints, and petitions.

Your tasks:

1. Input Handling:
- The input may contain multiple messages from a specific day or based on a user request.
- The content may be in any language (English, Tamil, Tanglish, Hindi, etc.).
- You must understand all languages correctly.

2. Filtering:
- If a date or specific request is mentioned, process ONLY the provided relevant messages.
- Treat each message/complaint/petition as a separate item.

3. Processing:
For EACH item:
- Understand the issue clearly.
- Translate internally if needed.
- Do NOT show translation in output.

4. Output Requirements:
- ALWAYS respond in English only.
- For EACH item, provide it in the format:

Item <number>:
Summary:
<Short and clear summary>

Solution:
<Practical and actionable solution>

5. Rules:
- Do NOT provide any overall summary.
- Do NOT combine items.
- Do NOT skip any item.
- Always include both Summary and Solution.
- Keep responses clear and structured.
- Avoid unnecessary details.
- Do not mention names unless required.

6. If input is a general question:
- Answer clearly in English.

Important:
- Output must be ONLY in English.
- Must handle mixed-language input correctly.
- Must work for chat, complaint, and petition data.

Input to analyze:
${message}`;

const PROMPT_NOTIFICATION_SUMMARY = (postContent) => `You are a notification summarization system.
Your task is to summarize the following post content in maximum 12 words (clear English).
Output ONLY the summary text, nothing else. No quotes, no preamble.

Post Content:
${postContent}

Summary:`;

module.exports = {
  getPrompt,
  detectIntent,
  formatMessagesAsList,
  formatMessagesAsTranscript,
  getSolutionsPrompt,
  getRecommendationsPrompt,
  getSummaryPrompt,
  getGeneralQuestionPrompt,
  getSentimentPrompt,
  getToxicityPrompt,
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
  PROMPT_NOTIFICATION_SUMMARY,
};