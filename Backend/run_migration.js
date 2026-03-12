const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'db_mini',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'nandha102',
});

async function runSQL() {
    try {
        const sqlPath = path.join(__dirname, 'scripts', 'add_specialized_bot_history.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');

        console.log('Executing SQL to create specialized bot history tables...');
        await pool.query(sql);
        console.log('✅ Tables created successfully');

    } catch (err) {
        console.error('❌ Error executing SQL:', err);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

runSQL();
