const axios = require('axios');
require('dotenv').config({ path: './nlp-service/.env' });

const OLLAMA_HOST = process.env.OLLAMA_HOST || 'http://127.0.0.1:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3.2:1b';

async function testOllama() {
  console.log('Testing Ollama connectivity...');
  console.log('Host:', OLLAMA_HOST);
  console.log('Model:', OLLAMA_MODEL);

  try {
    const tagsRes = await axios.get(`${OLLAMA_HOST}/api/tags`);
    console.log('Available models:', tagsRes.data.models.map(m => m.name));

    const generateRes = await axios.post(`${OLLAMA_HOST}/api/generate`, {
      model: OLLAMA_MODEL,
      prompt: 'Translate "Hello" to Tamil. Output only the translation.',
      stream: false
    });
    console.log('Response:', generateRes.data.response);
  } catch (error) {
    if (error.response) {
      console.error('Error Response:', error.response.status, error.response.data);
    } else {
      console.error('Error:', error.message);
    }
  }
}

testOllama();
