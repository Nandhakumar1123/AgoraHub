const { Pool } = require('pg');

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'db_mini',
  user: 'postgres',
  password: 'nandha102',
});

async function checkPending() {
  try {
    const res = await pool.query("SELECT m.user_id, u.full_name, m.community_id, c.name as community_name, m.status FROM memberships m JOIN users u ON m.user_id = u.user_id JOIN communities c ON m.community_id = c.community_id");
    console.log('All Memberships (including PENDING):', JSON.stringify(res.rows, null, 2));
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

checkPending();
