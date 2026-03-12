const { Pool } = require('pg');
const pool = new Pool({
    host: 'localhost',
    port: 5432,
    database: 'db_mini',
    user: 'postgres',
    password: 'nandha102'
});

async function setupBotHistoryTables() {
    try {
        // Create complaint_bot_history table with all required columns
        await pool.query(`
      CREATE TABLE IF NOT EXISTS complaint_bot_history (
        id SERIAL PRIMARY KEY,
        user_id INTEGER,
        community_id INTEGER NOT NULL,
        question TEXT NOT NULL,
        answer TEXT,
        status VARCHAR(50) DEFAULT 'answered',
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
        console.log('✅ complaint_bot_history table ready');

        // Create petition_bot_history table with all required columns
        await pool.query(`
      CREATE TABLE IF NOT EXISTS petition_bot_history (
        id SERIAL PRIMARY KEY,
        user_id INTEGER,
        community_id INTEGER NOT NULL,
        question TEXT NOT NULL,
        answer TEXT,
        status VARCHAR(50) DEFAULT 'answered',
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
        console.log('✅ petition_bot_history table ready');

        // Check current data in both tables
        const c = await pool.query('SELECT COUNT(*) FROM complaint_bot_history');
        const p = await pool.query('SELECT COUNT(*) FROM petition_bot_history');
        console.log(`📊 Records in complaint_bot_history: ${c.rows[0].count}`);
        console.log(`📊 Records in petition_bot_history: ${p.rows[0].count}`);

        // Show table columns
        const cols = await pool.query(`
      SELECT table_name, column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name IN ('complaint_bot_history','petition_bot_history')
      ORDER BY table_name, ordinal_position
    `);
        console.log('\n📋 Table columns:');
        cols.rows.forEach(r => console.log(`  ${r.table_name}.${r.column_name} (${r.data_type})`));

    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        await pool.end();
    }
}

setupBotHistoryTables();
