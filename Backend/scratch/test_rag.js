const { summarizeFromComplaints, summarizeFromPetitions } = require("../nlp-service/services/rag.service");

async function run() {
  try {
    console.log("=== Testing summarizeFromComplaints ===");
    const resComplaints = await summarizeFromComplaints("Today complaint summary", 58);
    console.log("Answer:");
    console.log(resComplaints.answer);
    console.log("Tamil Summary:");
    console.log(resComplaints.tamilSummary);

    console.log("\n=== Testing summarizeFromPetitions ===");
    const resPetitions = await summarizeFromPetitions("Today petition summary", 58);
    console.log("Answer:");
    console.log(resPetitions.answer);
    console.log("Tamil Summary:");
    console.log(resPetitions.tamilSummary);

  } catch (error) {
    console.error("Error running test:", error);
  }
}

run();
