const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'db_mini',
    password: process.env.DB_PASSWORD || 'nandha102',
    port: parseInt(process.env.DB_PORT) || 5432,
});

async function migrate() {
    try {
        console.log('🚀 Starting migration: Dropping problem_statement column from petitions table...');

        // Check if column exists first
        const checkResult = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'petitions' AND column_name = 'problem_statement';
    `);

        if (checkResult.rows.length > 0) {
            await pool.query('ALTER TABLE petitions DROP COLUMN problem_statement;');
            console.log('✅ Successfully dropped problem_statement column.');
        } else {
            console.log('ℹ️ Column problem_statement does not exist or was already dropped.');
        }

        process.exit(0);
    } catch (error) {
        console.error('❌ Migration failed:', error.message);
        process.exit(1);
    }
}

migrate();
