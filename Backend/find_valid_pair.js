const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'db_mini',
    password: process.env.DB_PASSWORD || 'nandha102',
    port: parseInt(process.env.DB_PORT) || 5432,
});

async function findValidPair() {
    try {
        const result = await pool.query(`
            SELECT u.email, u.password_hash, m.community_id, c.name as community_name
            FROM memberships m
            JOIN users u ON m.user_id = u.user_id
            JOIN communities c ON m.community_id = c.community_id
            WHERE m.status = 'ACTIVE'
            LIMIT 5;
        `);
        console.log('VALID_PAIRS_START');
        console.log(JSON.stringify(result.rows, null, 2));
        console.log('VALID_PAIRS_END');
        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

findValidPair();
