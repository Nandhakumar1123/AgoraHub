const axios = require('axios');
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'db_mini',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'nandha102',
});

async function makeUserHead(email) {
    console.log(`Upgrading ${email} to HEAD role...`);
    await pool.query(`
        UPDATE memberships m
        SET role = 'HEAD'
        FROM users u
        WHERE m.user_id = u.user_id AND u.email = $1
    `, [email]);
}

async function testPeriodicSummaries() {
    try {
        console.log('Testing Periodic Summaries API...');

        // Upgrade user to HEAD for testing
        const testEmail = 'test@example.com';
        await makeUserHead(testEmail);

        // First login
        const loginResponse = await axios.post('http://localhost:3002/api/login', {
            emailOrUsername: testEmail,
            password: 'password123'
        });

        if (loginResponse.data.token) {
            console.log('Login successful');
            const token = loginResponse.data.token;
            // Assuming user belongs to community 1 or 46 (based on earlier logs)
            const communityId = loginResponse.data.user?.memberships?.[0]?.community_id || 1;

            console.log(`Using Community ID: ${communityId}`);

            // Test Complaints Summary
            console.log('\n--- Testing Complaints Summary ---');
            try {
                const complaintsRes = await axios.post(
                    'http://localhost:3002/api/bot/ask/complaints',
                    { question: 'What were the complaints today?', community_id: communityId },
                    { headers: { Authorization: `Bearer ${token}` } }
                );
                console.log('Status (Complaints):', complaintsRes.data.data.status);
                console.log('Answer (Complaints):', complaintsRes.data.data.answer.substring(0, 300) + '...');
            } catch (e) {
                console.error('Complaints query failed:', e.message);
                if (e.response) console.error(e.response.data);
            }

            // Test Petitions Summary
            console.log('\n--- Testing Petitions Summary ---');
            try {
                const petitionsRes = await axios.post(
                    'http://localhost:3002/api/bot/ask/petitions',
                    { question: 'Summarize petitions from this month', community_id: communityId },
                    { headers: { Authorization: `Bearer ${token}` } }
                );
                console.log('Status (Petitions):', petitionsRes.data.data.status);
                console.log('Answer (Petitions):', petitionsRes.data.data.answer.substring(0, 300) + '...');
            } catch (e) {
                console.error('Petitions query failed:', e.message);
                if (e.response) console.error(e.response.data);
            }

            // Test History
            console.log('\n--- Testing History Fetch ---');
            try {
                const historyRes = await axios.get(
                    `http://localhost:3002/api/bot/history/${communityId}?type=complaints`,
                    { headers: { Authorization: `Bearer ${token}` } }
                );
                console.log('History fetched successfully. Count:', historyRes.data.data.history.length);
                if (historyRes.data.data.history.length > 0) {
                    console.log('Latest history item:', historyRes.data.data.history[0].question);
                }
            } catch (e) {
                console.error('History query failed:', e.message);
                if (e.response) console.error(e.response.data);
            }

        } else {
            console.log('Login failed: Token not found');
        }

    } catch (error) {
        console.error('Test failed:', error.message);
        if (error.response) {
            console.error('Data:', error.response.data);
        }
    } finally {
        await pool.end();
    }
}

testPeriodicSummaries();
