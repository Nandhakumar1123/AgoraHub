require('dotenv').config({ path: 'Backend/.env' });
const { OLLAMA_MODEL, OLLAMA_HOST } = require('./Backend/nlp-service/services/rag.service');
const axios = require('axios');

async function test() {
    console.log('--- Config Test ---');
    console.log('OLLAMA_MODEL:', OLLAMA_MODEL);
    console.log('OLLAMA_HOST:', OLLAMA_HOST);
    console.log('--- API Test ---');
    try {
        const resp = await axios.get(`${OLLAMA_HOST}/api/tags`);
        console.log('Available models:', resp.data.models.map(m => m.name));
    } catch (e) {
        console.log('Failed to fetch tags:', e.message);
    }
}

test();
