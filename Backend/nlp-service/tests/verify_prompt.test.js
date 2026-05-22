const { 
  PROMPT_MULTILINGUAL_ANALYSIS,
  PROMPT_MULTILINGUAL_COMPLAINT_ANALYSIS,
  getSummaryPrompt, 
  getGeneralQuestionPrompt 
} = require('../services/prompt');

function verify(name, prompt) {
  console.log(`\nTesting: ${name}`);
  const hasItem = prompt.toLowerCase().includes("item") || prompt.toLowerCase().includes("complaint") || prompt.toLowerCase().includes("petition");
  const hasSummary = prompt.includes("Summary:");
  const hasSolution = prompt.includes("Solution:");
  const hasEnglishOnly = prompt.toLowerCase().includes("english");
  
  if (hasItem && hasSummary && hasSolution && hasEnglishOnly) {
    console.log(`✅ ${name} structure is correct.`);
  } else {
    console.log(`❌ ${name} structure is incorrect.`);
    if (!hasItem) console.log("   - Missing 'Item', 'complaint', or 'petition'");
    if (!hasSummary) console.log("   - Missing 'Summary:'");
    if (!hasSolution) console.log("   - Missing 'Solution:'");
    if (!hasEnglishOnly) console.log("   - Missing 'English' instruction");
    process.exit(1);
  }
}

const testMsg = "தண்ணீர் பிரச்சனை"; // Water problem

verify("PROMPT_MULTILINGUAL_ANALYSIS", PROMPT_MULTILINGUAL_ANALYSIS(testMsg));
verify("PROMPT_MULTILINGUAL_COMPLAINT_ANALYSIS", PROMPT_MULTILINGUAL_COMPLAINT_ANALYSIS(testMsg));
verify("getSummaryPrompt", getSummaryPrompt(testMsg, "summarize this"));
verify("getGeneralQuestionPrompt", getGeneralQuestionPrompt(testMsg, "what is this?"));

console.log("\nAll prompts verified successfully! ✅");
