const { translateText } = require('../nlp-service/services/rag.service');
const { logger } = require('../nlp-service/config/logger');

// Mock OLLAMA environment if needed, but the service should read from its own process.env
// We already verified OLLAMA_HOST and OLLAMA_MODEL in the previous test.

async function testSafeTranslate() {
  console.log('Testing safeTranslateText with new logic...');
  
  const text = 'Food taste is not good. Summary: The user expresses dissatisfaction with the food they had. Solution: We recommend you contact customer service.';
  try {
    const translated = await translateText(text, 'English', 'Tamil');
    console.log('Original:', text);
    console.log('Translated:', translated);
    
    if (translated && translated !== text && /[\u0B80-\u0BFF]/.test(translated)) {
       console.log('SUCCESS: Tamil characters detected in translation.');
    } else {
       console.log('FAILURE: Translation did not return Tamil text or was same as original.');
    }
  } catch (error) {
    console.error('Error during translation test:', error);
  }
}

testSafeTranslate();
