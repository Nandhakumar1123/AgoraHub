/**
 * Migration: Add nlp_analysis JSONB to petitions and complaints
 * Run: node Backend/scripts/add-nlp-analysis-columns.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME || 'db_mini',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD||nandha102,
});

async function run() {
  console.log('Adding nlp_analysis columns to petitions and complaints...');
  try {
    await pool.query(`
      ALTER TABLE petitions 
      ADD COLUMN IF NOT EXISTS nlp_analysis JSONB DEFAULT NULL;
    `);
    console.log('  petitions.nlp_analysis');

    await pool.query(`
      ALTER TABLE complaints 
      ADD COLUMN IF NOT EXISTS nlp_analysis JSONB DEFAULT NULL;
    `);
    console.log('  complaints.nlp_analysis');

    console.log('Done.');
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

run();
