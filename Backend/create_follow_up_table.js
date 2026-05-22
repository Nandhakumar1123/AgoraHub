const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:nandha102@localhost:5432/db_mini',
});

async function createTable() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS follow_up_messages (
        id SERIAL PRIMARY KEY,
        complaint_id INTEGER REFERENCES complaints(complaint_id) ON DELETE CASCADE,
        petition_id INTEGER REFERENCES petitions(petition_id) ON DELETE CASCADE,
        sender_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
        receiver_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
        message TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ follow_up_messages table created or already exists.');
  } catch (err) {
    console.error('❌ Error creating table:', err);
  } finally {
    await pool.end();
  }
}

createTable();
