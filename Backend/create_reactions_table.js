const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:nandha102@localhost:5432/db_mini',
});

async function createTable() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS message_reactions (
        reaction_id SERIAL PRIMARY KEY,
        message_id INTEGER NOT NULL REFERENCES chat_messages(message_id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
        emoji VARCHAR(10) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(message_id, user_id, emoji)
      );
    `);
    console.log('✅ message_reactions table created or already exists.');
    
    // Also update chat_messages to ensure reaction_count exists (it should, but just in case)
    await pool.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='chat_messages' AND column_name='reaction_count') THEN
          ALTER TABLE chat_messages ADD COLUMN reaction_count JSONB DEFAULT '{}'::JSONB;
        END IF;
      END $$;
    `);
    console.log('✅ chat_messages.reaction_count column verified.');
    
  } catch (err) {
    console.error('❌ Error creating table:', err);
  } finally {
    await pool.end();
  }
}

createTable();
