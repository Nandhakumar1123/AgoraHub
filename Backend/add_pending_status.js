const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  user: process.env.DB_USER || "postgres",
  host: process.env.DB_HOST || "localhost",
  database: process.env.DB_NAME || "db_mini",
  password: process.env.DB_PASSWORD || "nandha102",
  port: parseInt(process.env.DB_PORT) || 5432,
});

async function runMigration() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // First query to check if constraint exists and drop it
    await client.query(`ALTER TABLE memberships DROP CONSTRAINT IF EXISTS memberships_status_check;`);
    
    // Add new constraint including PENDING
    await client.query(`ALTER TABLE memberships ADD CONSTRAINT memberships_status_check CHECK (status IN ('ACTIVE', 'PENDING', 'INACTIVE', 'BANNED', 'LEFT'));`);
    
    await client.query('COMMIT');
    console.log("✅ Successfully added 'PENDING' to memberships status constraint.");
  } catch (error) {
    await client.query('ROLLBACK');
    console.error("❌ Migration failed:", error);
  } finally {
    client.release();
    pool.end();
  }
}

runMigration();
