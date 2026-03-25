const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { generateNotificationSummary } = require('../nlp-service/services/rag.service');

async function runTest() {
    console.log('--- Testing AI Notification Summary ---');
    
    const testPosts = [
        {
            name: "Short Post",
            content: "We are having a community meeting tomorrow at 6 PM in the central park to discuss new security measures."
        },
        {
            name: "Long Post",
            content: "URGENT: There has been a reported water leakage in Block B. The maintenance team is currently investigating the issue. Residents are advised to store some water for personal use as we might need to shut down the main valve for approximately 2 hours starting from 11 AM today. We apologize for any inconvenience caused and will keep you updated on the progress. Thank you for your cooperation."
        },
        {
            name: "Empty Post",
            content: ""
        }
    ];

    for (const post of testPosts) {
        console.log(`\nTesting: ${post.name}`);
        console.log(`Original: "${post.content}"`);
        try {
            const summary = await generateNotificationSummary(post.content);
            const wordCount = summary.split(/\s+/).filter(Boolean).length;
            console.log(`Summary: "${summary}"`);
            console.log(`Word Count: ${wordCount}`);
            
            if (wordCount <= 12) {
                console.log('✅ Pass: Word count is within limit.');
            } else {
                console.log('❌ Fail: Word count exceeds 12 words.');
            }
        } catch (err) {
            console.error(`Error:`, err.message);
        }
    }
}

runTest().then(() => console.log('\nTest completed.'));
