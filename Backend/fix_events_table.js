const { Pool } = require('pg');
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
        console.log('Adding posted_by column to events table...');

        // Check if column exists first
        const checkRes = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name='events' and column_name='posted_by'
    `);

        if (checkRes.rows.length === 0) {
            await pool.query(`
          ALTER TABLE events 
          ADD COLUMN posted_by INTEGER REFERENCES users(user_id) ON DELETE SET NULL;
        `);
            console.log('✅ Column posted_by added successfully');
        } else {
            console.log('✅ Column posted_by already exists');
        }

    } catch (err) {
        console.error('❌ Error executing SQL:', err);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

runSQL();
