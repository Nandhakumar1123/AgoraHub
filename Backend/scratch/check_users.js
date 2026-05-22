const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  user: process.env.DB_USER || "postgres",
  host: process.env.DB_HOST || "localhost",
  database: process.env.DB_NAME || "db_mini",
  password: process.env.DB_PASSWORD || "nandha102",
  port: parseInt(process.env.DB_PORT) || 5432,
});

async function checkUsers() {
  try {
    const result = await pool.query('SELECT user_id, full_name, email FROM users');
    console.log('Users in DB:', JSON.stringify(result.rows, null, 2));
  } catch (err) {
    console.error('Error checking users:', err);
  } finally {
    await pool.end();
  }
}

checkUsers();
