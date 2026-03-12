const path = require('path');
require('dotenv').config({ path: path.join(__dirname, 'Backend', '.env') });
const { queryOllama } = require('./Backend/nlp-service/services/rag.service');

async function test() {
    const start = Date.now();
    console.log('--- Testing llama3.2:1b Performance ---');
    try {
        const result = await queryOllama("Summarize: User1: Hi, User2: Hello, User3: How are you?");
        const duration = Date.now() - start;
        console.log('Result:', result.response);
        console.log(`\n✅ Total Duration: ${duration}ms`);
    } catch (err) {
        console.error('❌ Test failed:', err.message);
    }
}

test();
