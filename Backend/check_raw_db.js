const { Pool } = require('pg');

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'db_mini',
  user: 'postgres',
  password: 'nandha102',
});

async function checkRaw() {
  try {
    const res = await pool.query("SELECT * FROM memberships");
    console.log('Raw Memberships:', JSON.stringify(res.rows, null, 2));
    
    const users = await pool.query("SELECT user_id, full_name FROM users");
    console.log('All Users:', JSON.stringify(users.rows, null, 2));
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

checkRaw();
