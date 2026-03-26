const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'db_mini',
    password: process.env.DB_PASSWORD || 'nandha102',
    port: parseInt(process.env.DB_PORT) || 5432,
});

async function run() {
    try {
        const userRes = await pool.query("SELECT user_id FROM users WHERE email = 'test@example.com'");
        if (userRes.rows.length === 0) {
            console.log('User test@example.com not found');
            process.exit(1);
        }
        const userId = userRes.rows[0].user_id;

        const commRes = await pool.query("SELECT community_id FROM communities LIMIT 1");
        if (commRes.rows.length === 0) {
            console.log('No communities found');
            process.exit(1);
        }
        const communityId = commRes.rows[0].community_id;

        await pool.query(`
            INSERT INTO memberships (user_id, community_id, role, status) 
            VALUES ($1, $2, 'MEMBER', 'ACTIVE') 
            ON CONFLICT (user_id, community_id) DO UPDATE SET status = 'ACTIVE'
        `, [userId, communityId]);

        console.log(`User ${userId} (test@example.com) is now an ACTIVE member of community ${communityId}`);
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

run();
