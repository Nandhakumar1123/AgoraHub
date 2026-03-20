const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  user: process.env.DB_USER || "postgres",
  host: process.env.DB_HOST || "localhost",
  database: process.env.DB_NAME || "db_mini",
  password: process.env.DB_PASSWORD || "nandha102",
  port: parseInt(process.env.DB_PORT) || 5432,
});

async function checkSchema() {
  try {
    console.log('Columns in user_profiles:');
    const resProfiles = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'user_profiles'
    `);
    resProfiles.rows.forEach(row => {
      console.log(`${row.column_name}: ${row.data_type}`);
    });

    console.log('\nColumns in users:');
    const resUsers = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'users'
    `);
    resUsers.rows.forEach(row => {
      console.log(`${row.column_name}: ${row.data_type}`);
    });
    process.exit(0);
  } catch (err) {
    console.error('Error checking schema:', err);
    process.exit(1);
  }
}

checkSchema();
