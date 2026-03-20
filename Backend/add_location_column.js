const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  user: process.env.DB_USER || "postgres",
  host: process.env.DB_HOST || "localhost",
  database: process.env.DB_NAME || "db_mini",
  password: process.env.DB_PASSWORD || "nandha102",
  port: parseInt(process.env.DB_PORT) || 5432,
});

async function addLocationColumn() {
  try {
    console.log('Adding location column to user_profiles...');
    await pool.query('ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS location TEXT');
    console.log('✅ Column added successfully (or already exists)');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error adding column:', err);
    process.exit(1);
  }
}

addLocationColumn();
