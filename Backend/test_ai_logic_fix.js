const { detectIntent } = require('./nlp-service/services/prompt');
const { getPrompt } = require('./nlp-service/services/prompt');

console.log('--- Testing Intent Detection ---');
const summaryQueries = [
  "give me a summary",
  "what is the overview of this chat",
  "can you recap the messages",
  "brief about the chat",
  "tell me the key points"
];

summaryQueries.forEach(q => {
  const intent = detectIntent(q);
  console.log(`Query: "${q}" -> Intent: ${intent} ${intent === 'summary' ? '✅' : '❌'}`);
});

console.log('\n--- Testing General Fallback Intent ---');
const generalQueries = [
  "what is the capital of france?",
  "how tall is mt everest",
  "who wrote hamlet"
];

generalQueries.forEach(q => {
  const intent = detectIntent(q);
  console.log(`Query: "${q}" -> Intent: ${intent} ${intent === 'general' ? '✅' : '❌'}`);
});

console.log('\n--- Testing Summary Prompt Formatting (No Names/Length) ---');
const fakeTranscript = "- [safety] Broken light: The light in hallway is broken.\n- [water] Leaking tap: Tap is leaking in kitchen.";

const summaryPromptStr = `You are a helpful community assistant. Provide a SHORT summary (2-5 lines max) of the following community complaints.
Focus ONLY on the issues and content. Do NOT include any names of people. 
Highlight recurring categories and urgent issues, then give brief suggested next steps.

Complaints:
${fakeTranscript}

Question: give summary

Output Format:
Summary:
- [Key point 1]
- [Key point 2]
(Max 5 lines total for summary)

Solutions:
- [Practical solution 1]
- [Practical solution 2]

Result:`;
console.log(summaryPromptStr.includes('SHORT summary (2-5 lines max)') ? 'Prompt includes length rule: ✅' : 'Prompt length rule missing: ❌');
console.log(summaryPromptStr.includes('Do NOT include any names of people') ? 'Prompt includes no names rule: ✅' : 'Prompt no names rule missing: ❌');

console.log('\n--- Tests Complete ---');
