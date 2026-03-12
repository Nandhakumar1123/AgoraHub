const { Pool } = require('pg');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env') });

const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
});

async function migrate() {
    try {
        console.log('🚀 Starting database migration...');

        // Add columns to anonymous_messages if they don't exist
        await pool.query(`
      ALTER TABLE anonymous_messages 
      ADD COLUMN IF NOT EXISTS parent_id INTEGER REFERENCES anonymous_messages(message_id) ON DELETE CASCADE,
      ADD COLUMN IF NOT EXISTS is_from_head BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'unread';
    `);
        console.log('✅ Added parent_id, is_from_head, and status to anonymous_messages');

        // Add index for performance
        await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_anonymous_messages_parent_id ON anonymous_messages(parent_id);
    `);
        console.log('✅ Created index on parent_id');

        console.log('✨ Migration completed successfully!');
    } catch (err) {
        console.error('❌ Migration failed:', err);
    } finally {
        await pool.end();
    }
}

migrate();
