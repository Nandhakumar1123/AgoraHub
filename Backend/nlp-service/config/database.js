const { Pool } = require('pg');
const { toSql } = require('pgvector/pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'db_mini',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'root',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Test connection
pool.on('connect', () => {
  console.log('✅ PostgreSQL connected');
});

pool.on('error', (err) => {
  console.error('❌ PostgreSQL connection error:', err);
  process.exit(-1);
});

// Helper functions
const query = async (text, params) => {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    
    if (duration > 100) {
      console.warn(`⚠️  Slow query (${duration}ms):`, text.substring(0, 100));
    }
    
    return res;
  } catch (error) {
    console.error('Database query error:', error);
    throw error;
  }
};

// Transaction helper
const transaction = async (callback) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

// Vector similarity search helper
const vectorSearch = async (embedding, communityId, limit = 5) => {
  const embeddingStr = toSql(embedding);
  
  const result = await query(
    `SELECT id, title, content, 
            1 - (embedding <=> $1::vector) as similarity
     FROM community_docs 
     WHERE community_id = $2
     ORDER BY embedding <=> $1::vector
     LIMIT $3`,
    [embeddingStr, communityId, limit]
  );
  
  return result.rows;
};

module.exports = {
  pool,
  query,
  transaction,
  vectorSearch,
};
