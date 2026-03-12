const { summarizeFromChatMessages } = require('./nlp-service/services/rag.service');
const { Pool } = require('pg');
require('dotenv').config();

// Use the same DB config
const pool = new Pool({
    user: process.env.DB_USER || "postgres",
    host: process.env.DB_HOST || "localhost",
    database: process.env.DB_NAME || "db_mini",
    password: process.env.DB_PASSWORD || "nandha102",
    port: parseInt(process.env.DB_PORT) || 5432,
});

async function testFallback() {
    const communityId = 36;
    const question = "today chat summarization";

    console.log('Testing summarizeFromChatMessages with question:', question);

    try {
        const result = await summarizeFromChatMessages(question, communityId);
        console.log('--- RESULT STATUS ---');
        console.log(result.status);
        console.log('--- RESULT ANSWER ---');
        console.log(result.answer);
    } catch (err) {
        console.error('Error during test:', err);
    } finally {
        await pool.end();
    }
}

testFallback();
