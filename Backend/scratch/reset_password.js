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

async function resetPassword() {
  const email = 'crazynandha.nk@gmail.com';
  const newPassword = 'Nandha102.';
  
  try {
    const passwordHash = await bcrypt.hash(newPassword, 10);
    const result = await pool.query(
      'UPDATE users SET password_hash = $1 WHERE email = $2 RETURNING user_id, full_name',
      [passwordHash, email]
    );
    
    if (result.rowCount > 0) {
      console.log(`✅ Success! Password for ${result.rows[0].full_name} (${email}) has been reset to "${newPassword}"`);
    } else {
      console.log(`❌ Error: User with email ${email} not found.`);
    }
  } catch (err) {
    console.error('❌ Error resetting password:', err);
  } finally {
    await pool.end();
  }
}

resetPassword();
