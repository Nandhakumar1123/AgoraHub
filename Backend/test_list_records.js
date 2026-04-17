const { detectIntent, getPrompt } = require('./nlp-service/services/prompt');

console.log('--- Testing List Intent Detection ---');
const listQueries = [
  "list all complaints",
  "show me the petitions from today",
  "fetch previous chat messages",
  "view records of complaints",
  "get all chat messages",
  "show name of petitions"
];

listQueries.forEach(q => {
  const intent = detectIntent(q);
  console.log(`Query: "${q}" -> Intent: ${intent} ${intent === 'list' ? '✅' : '❌'}`);
});

console.log('\n--- Testing List Prompt Generation ---');
const mockData = "1. Content: Broken light | Status: OPEN | Priority: high\n2. Content: Leaking pipe | Status: IN_PROGRESS | Priority: medium";
const listPrompt = getPrompt('list', mockData, "list all complaints", { showName: false });

console.log('Prompt Generated:');
console.log(listPrompt);

const hasNoSolutions = !listPrompt.includes('Solutions:');
const hasNoSuggestions = !listPrompt.includes('Suggestions:');
const hasContentStatusPriority = listPrompt.includes('Content') && listPrompt.includes('Status') && listPrompt.includes('Priority');

console.log(`\nValidation:`);
console.log(`- No Solutions Rule: ${hasNoSolutions ? '✅' : '❌'}`);
console.log(`- No Suggestions Rule: ${hasNoSuggestions ? '✅' : '❌'}`);
console.log(`- Includes Content, Status, Priority: ${hasContentStatusPriority ? '✅' : '❌'}`);

console.log('\n--- Testing Name Inclusion ---');
const listPromptWithName = getPrompt('list', mockData, "show name of complaints", { showName: true });
console.log(`- Includes Name instruction: ${listPromptWithName.includes('Include the Name/Author') ? '✅' : '❌'}`);

console.log('\n--- Tests Complete ---');
