const path = require('path');
// Manually load dotenv from the nlp-service directory
require(path.join(__dirname, 'Backend', 'nlp-service', 'node_modules', 'dotenv')).config({
    path: path.join(__dirname, 'Backend', 'nlp-service', '.env')
});

const ragService = require('./Backend/nlp-service/services/rag.service');
const axios = require('axios');

async function verify() {
    console.log('--- Environment Check ---');
    console.log('OLLAMA_HOST (from process.env):', process.env.OLLAMA_HOST);
    console.log('OLLAMA_MODEL (from process.env):', process.env.OLLAMA_MODEL);

    console.log('\n--- Connectivity Check (to 127.0.0.1) ---');
    try {
        const res = await axios.get('http://127.0.0.1:11434/api/tags');
        console.log('API at 127.0.0.1 tags:', res.data.models.map(m => m.name));
    } catch (err) {
        console.log('API at 127.0.0.1 failed:', err.message);
    }

    console.log('\n--- Connectivity Check (to localhost) ---');
    try {
        const res = await axios.get('http://localhost:11434/api/tags');
        console.log('API at localhost tags:', res.data.models.map(m => m.name));
    } catch (err) {
        console.log('API at localhost failed:', err.message);
    }
}

verify();
