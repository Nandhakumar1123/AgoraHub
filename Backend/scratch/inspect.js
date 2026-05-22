const { pool } = require("../db");

async function inspect() {
  try {
    console.log("Checking database for records today...");
    
    // Check chat messages from today
    const chats = await pool.query(
      `SELECT * FROM chat_messages WHERE created_at >= CURRENT_DATE`
    );
    console.log(`\nChat Messages today: ${chats.rows.length}`);
    chats.rows.forEach(r => {
      console.log(`- Chat: [${r.message_id}] ${r.content} (${r.created_at})`);
    });

    // Check complaints from today
    const complaints = await pool.query(
      `SELECT * FROM complaints WHERE created_at >= CURRENT_DATE`
    );
    console.log(`\nComplaints today: ${complaints.rows.length}`);
    complaints.rows.forEach(r => {
      console.log(`- Complaint: [${r.complaint_id}] community_id: ${r.community_id}, ${r.title}: ${r.description} (${r.created_at})`);
    });

    // Check petitions from today
    const petitions = await pool.query(
      `SELECT * FROM petitions WHERE created_at >= CURRENT_DATE`
    );
    console.log(`\nPetitions today: ${petitions.rows.length}`);
    petitions.rows.forEach(r => {
      console.log(`- Petition: [${r.petition_id}] community_id: ${r.community_id}, ${r.title}: ${r.problem_statement} (${r.created_at})`);
    });

  } catch (error) {
    console.error("Error inspecting DB:", error);
  } finally {
    await pool.end();
  }
}

inspect();
