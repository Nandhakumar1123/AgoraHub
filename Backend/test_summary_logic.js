const { Pool } = require('pg');
const { queryOllama } = require('./nlp-service/services/rag.service');
require('dotenv').config();

const pool = new Pool({
    user: process.env.DB_USER || "postgres",
    host: process.env.DB_HOST || "localhost",
    database: process.env.DB_NAME || "db_mini",
    password: process.env.DB_PASSWORD || "nandha102",
    port: parseInt(process.env.DB_PORT) || 5432,
});

async function test() {
    const communityId = 36;
    const userId = 10;

    console.log('Inserting test messages...');
    await pool.query(`
    INSERT INTO chat_messages (community_id, sender_id, content) VALUES
    ($1, $2, 'In our ground water is leaking more'),
    ($1, $2, 'Water was leaking'),
    ($1, $2, 'Bell is not ring at 4th floor 3rd room')
  `, [communityId, userId]);

    console.log('Fetching today\'s messages...');
    const messagesResult = await pool.query(
        `SELECT content FROM chat_messages 
     WHERE community_id = $1 AND created_at >= CURRENT_DATE
     ORDER BY created_at ASC`,
        [communityId]
    );

    console.log(`Found ${messagesResult.rows.length} messages.`);
    const chatText = messagesResult.rows.map(m => m.content).join('\n');

    console.log('Calling Ollama for summary...');
    try {
        const summaryPrompt = `Summarize the following community chat messages in a concise paragraph (max 4 sentences):\n\n${chatText}`;
        const summaryRes = await queryOllama(summaryPrompt);
        console.log('--- SUMMARY ---');
        console.log(summaryRes.response);

        console.log('Calling Ollama for recommendations...');
        const recommendationsPrompt = `Based on the following community chat summary, provide 2-3 actionable recommendations or solutions for the community heads. Keep it brief and constructive:\n\nSummary: ${summaryRes.response}`;
        const recommendationsRes = await queryOllama(recommendationsPrompt);
        console.log('--- RECOMMENDATIONS ---');
        console.log(recommendationsRes.response);
    } catch (err) {
        console.error('Ollama Error:', err.message);
    }

    await pool.end();
}

test();
