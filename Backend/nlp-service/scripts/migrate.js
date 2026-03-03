const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'db_mini',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD||'root',
});

const migrations = [
  {
    name: 'Enable pgvector extension',
    sql: `CREATE EXTENSION IF NOT EXISTS vector;`,
    optional: true, // Skip if pgvector not installed (needs separate install)
  },
  {
    name: 'Create nlp_audit table',
    sql: `
      CREATE TABLE IF NOT EXISTS nlp_audit (
        id SERIAL PRIMARY KEY,
        user_id INT NOT NULL,
        community_id INT NOT NULL,
        text_hash TEXT NOT NULL,
        raw_text TEXT,
        sentiment JSONB,
        toxicity JSONB,
        action VARCHAR(20) CHECK (action IN ('approved', 'quarantined', 'blocked', 'error')),
        created_at TIMESTAMP DEFAULT NOW()
      );
      
      CREATE INDEX IF NOT EXISTS idx_nlp_audit_user ON nlp_audit(user_id);
      CREATE INDEX IF NOT EXISTS idx_nlp_audit_community ON nlp_audit(community_id);
      CREATE INDEX IF NOT EXISTS idx_nlp_audit_created ON nlp_audit(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_nlp_audit_action ON nlp_audit(action);
    `,
  },
  {
    name: 'Create community_docs table',
    optional: true, // Requires pgvector
    sql: `
      CREATE TABLE IF NOT EXISTS community_docs (
        id SERIAL PRIMARY KEY,
        community_id INT NOT NULL,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        embedding VECTOR(384),
        uploaded_by INT,
        created_at TIMESTAMP DEFAULT NOW()
      );
      
      CREATE INDEX IF NOT EXISTS idx_community_docs_community ON community_docs(community_id);
      CREATE INDEX IF NOT EXISTS idx_community_docs_embedding ON community_docs 
        USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
    `,
  },
  {
    name: 'Create bot_sessions table',
    sql: `
      CREATE TABLE IF NOT EXISTS bot_sessions (
        id SERIAL PRIMARY KEY,
        community_id INT NOT NULL,
        user_id INT NOT NULL,
        session_hash TEXT UNIQUE NOT NULL,
        context JSONB,
        created_at TIMESTAMP DEFAULT NOW()
      );
      
      CREATE INDEX IF NOT EXISTS idx_bot_sessions_hash ON bot_sessions(session_hash);
      CREATE INDEX IF NOT EXISTS idx_bot_sessions_user ON bot_sessions(user_id);
    `,
  },
  {
    name: 'Create content_quarantine table',
    sql: `
      CREATE TABLE IF NOT EXISTS content_quarantine (
        id SERIAL PRIMARY KEY,
        user_id INT NOT NULL,
        community_id INT NOT NULL,
        content TEXT NOT NULL,
        message_type VARCHAR(50),
        toxicity_score FLOAT,
        status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'deleted')),
        reviewed_by INT,
        reviewed_at TIMESTAMP,
        review_notes TEXT,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      );
      
      CREATE INDEX IF NOT EXISTS idx_quarantine_community ON content_quarantine(community_id);
      CREATE INDEX IF NOT EXISTS idx_quarantine_status ON content_quarantine(status);
      CREATE INDEX IF NOT EXISTS idx_quarantine_expires ON content_quarantine(expires_at);
    `,
  },
  {
    name: 'Add nlp_analysis columns to petitions and complaints',
    sql: `
      ALTER TABLE petitions
      ADD COLUMN IF NOT EXISTS nlp_analysis TEXT;
      
      ALTER TABLE complaints
      ADD COLUMN IF NOT EXISTS nlp_analysis TEXT;
    `,
  },
  {
    name: 'Align petitions status check with app (Review, Pending, InProgress, Approved, Rejected)',
    sql: `
      ALTER TABLE petitions DROP CONSTRAINT IF EXISTS petitions_status_check;
      ALTER TABLE petitions ADD CONSTRAINT petitions_status_check
        CHECK (status IN ('Review', 'Pending', 'InProgress', 'Approved', 'Rejected'));
    `,
  },
];

async function runMigrations() {
  console.log('🔄 Starting database migrations...\n');
  
  try {
    for (const migration of migrations) {
      console.log(`Running: ${migration.name}`);
      
      try {
        await pool.query(migration.sql);
        console.log(`✅ ${migration.name} - Success\n`);
      } catch (error) {
        if (migration.optional) {
          console.log(`⚠️ ${migration.name} - Skipped (optional): ${error.message}\n`);
        } else {
          console.error(`❌ ${migration.name} - Failed`);
          console.error(`Error: ${error.message}\n`);
          throw error;
        }
      }
    }
    
    console.log('✅ All migrations completed successfully!');
    
  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run migrations
runMigrations();