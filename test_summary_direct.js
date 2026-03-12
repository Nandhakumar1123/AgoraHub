const path = require('path');
require('dotenv').config({ path: path.join(__dirname, 'Backend', '.env') });

// Mock dependencies if needed, or just import
const { summarizeFromChatMessages } = require('./Backend/nlp-service/services/rag.service');

async function test() {
    console.log('--- Testing summarizeFromChatMessages ---');
    // Use a community ID that likely exists, or mock messages
    // We'll use a sample question
    const question = "Can you summarize the recent issues and give recommendations?";
    const communityId = 1; // Sample ID

    try {
        const result = await summarizeFromChatMessages(question, communityId);
        console.log('Result:\n', result);
    } catch (err) {
        console.error('Error during test:', err);
    }
}

test();
