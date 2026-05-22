const { Pool } = require('pg');
const bcrypt = require('bcrypt');
require('dotenv').config();

const pool = new Pool({
  user: process.env.DB_USER || "postgres",
  host: process.env.DB_HOST || "localhost",
  database: process.env.DB_NAME || "db_mini",
  password: process.env.DB_PASSWORD || "nandha102",
  port: parseInt(process.env.DB_PORT) || 5432,
});

async function checkPasswords() {
  try {
    const result = await pool.query('SELECT user_id, full_name, email, password_hash FROM users WHERE full_name = $1', ['Nandhu']);
    console.log('Nandhu users found:', result.rows.length);
    
    const testPassword = "Nandha102.";
    
    for (const user of result.rows) {
      const match = await bcrypt.compare(testPassword, user.password_hash);
      console.log(`User ID: ${user.user_id}, Email: ${user.email}, Match for "${testPassword}": ${match}`);
    }
  } catch (err) {
    console.error('Error checking passwords:', err);
  } finally {
    await pool.end();
  }
}

checkPasswords();
