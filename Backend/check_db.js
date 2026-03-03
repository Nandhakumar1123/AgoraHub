const { Pool } = require("pg");

const pool = new Pool({
  user: "postgres",
  host: "localhost",
  database: "db_mini",
  password: "nandha102",
  port: 5432,
});

async function checkDatabase() {
  try {
    console.log('=== CHECKING DATABASE ===');

    // Check users
    console.log('1. Users:');
    const users = await pool.query('SELECT user_id, full_name, email FROM users LIMIT 5;');
    console.log(users.rows);

    // Check communities
    console.log('2. Communities:');
    const communities = await pool.query('SELECT * FROM communities LIMIT 5;');
    console.log(communities.rows);

    // Check memberships
    console.log('3. Memberships:');
    const memberships = await pool.query('SELECT * FROM memberships LIMIT 10;');
    console.log(memberships.rows);

    // Check events
    console.log('4. Events:');
    const events = await pool.query('SELECT * FROM events ORDER BY created_at DESC LIMIT 10;');
    console.log(events.rows);

    // Check if test user exists and their memberships
    console.log('5. Test user details:');
    const testUser = await pool.query("SELECT * FROM users WHERE email = 'test@example.com';");
    if (testUser.rows.length > 0) {
      const userId = testUser.rows[0].user_id;
      console.log('Test user:', testUser.rows[0]);

      const userMemberships = await pool.query('SELECT * FROM memberships WHERE user_id = $1;', [userId]);
      console.log('Test user memberships:', userMemberships.rows);
    } else {
      console.log('Test user not found');
    }

  } catch (error) {
    console.error('Database check failed:', error);
  } finally {
    await pool.end();
  }
}

checkDatabase();