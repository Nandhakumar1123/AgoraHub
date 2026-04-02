const { Pool } = require('pg');

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'db_mini',
  user: 'postgres',
  password: 'nandha102',
});

async function checkUsers() {
  try {
    const res = await pool.query("SELECT user_id, full_name, email FROM users WHERE full_name ILIKE '%nn%' OR full_name ILIKE '%nadhan%'");
    console.log('Users found:', res.rows);
    
    if (res.rows.length > 0) {
      const userIds = res.rows.map(u => u.user_id);
      const memberships = await pool.query(
        "SELECT m.*, c.name as community_name FROM memberships m JOIN communities c ON m.community_id = c.community_id WHERE m.user_id = ANY($1)",
        [userIds]
      );
      console.log('Memberships:', JSON.stringify(memberships.rows, null, 2));
    } else {
      console.log('No users with name like "nn" or "nadhan" found.');
      // Let's just list all users to be sure
      const allUsers = await pool.query("SELECT user_id, full_name FROM users LIMIT 10");
      console.log('Sample users:', allUsers.rows);
    }
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

checkUsers();
