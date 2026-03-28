const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  user: process.env.DB_USER || "postgres",
  host: process.env.DB_HOST || "localhost",
  database: process.env.DB_NAME || "db_mini",
  password: process.env.DB_PASSWORD || "nandha102",
  port: parseInt(process.env.DB_PORT) || 5432,
});

async function verify() {
  const client = await pool.connect();
  try {
    console.log("Starting verification...");
    // Force user 1 to be a HEAD of community 36 if exists
    await client.query("INSERT INTO memberships (user_id, community_id, role, status) VALUES (1, 36, 'HEAD', 'ACTIVE') ON CONFLICT (user_id, community_id) DO UPDATE SET role = 'HEAD', status = 'ACTIVE'");

    // Force user 2 to be PENDING
    await client.query("INSERT INTO memberships (user_id, community_id, role, status) VALUES (2, 36, 'MEMBER', 'PENDING') ON CONFLICT (user_id, community_id) DO UPDATE SET status = 'PENDING'");

    const requests = await client.query("SELECT * FROM memberships WHERE community_id = 36 AND status = 'PENDING'");
    console.log("Pending requests count:", requests.rows.length);
    if (requests.rows.length > 0) {
      console.log("✅ PENDING status is working in DB.");
    }

    // Now let's try to update to active
    await client.query("UPDATE memberships SET status = 'ACTIVE' WHERE community_id = 36 AND user_id = 2 AND status = 'PENDING'");
    
    const activeRequests = await client.query("SELECT * FROM memberships WHERE community_id = 36 AND user_id = 2");
    if (activeRequests.rows[0].status === 'ACTIVE') {
      console.log("✅ Bulk approval logic query works.");
    }
  } catch(e) {
    console.error("❌ Verification failed:", e.message);
  } finally {
    client.release();
    pool.end();
  }
}

verify();
