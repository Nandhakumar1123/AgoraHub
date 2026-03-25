const { PROMPT_MULTILINGUAL_ANALYSIS } = require('../services/prompt');

const testMessage = "வணக்கம், தண்ணீர் பிரச்சனை உள்ளது"; // Tamil: "Hello, there is a water problem"
const prompt = PROMPT_MULTILINGUAL_ANALYSIS(testMessage);

console.log("--- PROMPT START ---");
console.log(prompt);
console.log("--- PROMPT END ---");

if (prompt.includes("Summary:") && prompt.includes("Solution:") && prompt.includes(testMessage)) {
  console.log("✅ Prompt structure is correct.");
} else {
  console.log("❌ Prompt structure is incorrect.");
  process.exit(1);
}
