const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { askBot } = require('../nlp-service/services/rag.service');

async function runTest() {
    console.log('--- Testing Multilingual Analysis ---');
    
    const queries = [
        { lang: 'English', text: 'I need help with a leaking tap in my apartment.' },
        { lang: 'Tamil', text: 'எனது அடுக்குமாடி குடியிருப்பில் குழாய் கசிவு உள்ளது, உதவி தேவை.' },
        { lang: 'Hindi', text: 'मेरे अपार्टमेंट में नल टपक रहा है, मुझे मदद चाहिए।' }
    ];

    for (const q of queries) {
        console.log(`\nTesting ${q.lang}: "${q.text}"`);
        try {
            // We use a dummy communityId (1) and userId (1)
            const result = await askBot(q.text, 1, 1);
            console.log('Response:');
            console.log(result.answer);
            console.log('Status:', result.status);
            console.log('-----------------------------------');
        } catch (err) {
            console.error(`Error testing ${q.lang}:`, err.message);
        }
    }
}

runTest();
