const { Pool } = require("pg");

const pool = new Pool({
  user: "postgres",
  host: "localhost",
  database: "db_mini",
  password: "nandha102",
  port: 5432,
});

async function migrate() {
  try {
    console.log("Checking columns of communities table...");
    const res = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'communities' AND column_name = 'events_enabled';
    `);

    if (res.rows.length === 0) {
      console.log("Adding events_enabled column to communities table...");
      await pool.query(`
        ALTER TABLE communities ADD COLUMN events_enabled BOOLEAN DEFAULT TRUE;
      `);
      console.log("events_enabled column added successfully!");
    } else {
      console.log("events_enabled column already exists in communities table.");
    }
  } catch (error) {
    console.error("Migration failed:", error);
  } finally {
    await pool.end();
  }
}

migrate();
