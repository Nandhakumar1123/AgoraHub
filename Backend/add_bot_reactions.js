const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:nandha102@localhost:5432/db_mini',
});

async function migrate() {
  try {
    console.log('🚀 Starting bot history reactions migration...');

    // 1. Add reaction_count to bot_chat_history
    await pool.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bot_chat_history' AND column_name='reaction_count') THEN
          ALTER TABLE bot_chat_history ADD COLUMN reaction_count JSONB DEFAULT '{}'::JSONB;
          RAISE NOTICE 'Added reaction_count to bot_chat_history';
        END IF;
      END $$;
    `);

    // 2. Create bot_history_reactions table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS bot_history_reactions (
        reaction_id SERIAL PRIMARY KEY,
        history_id BIGINT NOT NULL REFERENCES bot_chat_history(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
        emoji VARCHAR(10) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(history_id, user_id)
      );
    `);
    console.log('✅ bot_history_reactions table created or already exists.');

    console.log('🎉 Migration completed successfully!');
  } catch (err) {
    console.error('❌ Migration failed:', err);
  } finally {
    await pool.end();
  }
}

migrate();
