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
    console.log(`Ensuring ${email} is HEAD...`);
    await pool.query(`
        UPDATE memberships m
        SET role = 'HEAD'
        FROM users u
        WHERE m.user_id = u.user_id AND u.email = $1
    `, [email]);
}

async function testEventCreation() {
    try {
        console.log('Testing Event Creation API...');

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
            const communityId = loginResponse.data.user?.memberships?.[0]?.community_id || 1;

            console.log(`Using Community ID: ${communityId} for Event creation test`);

            // Test Event Creation
            try {
                const eventRes = await axios.post(
                    `http://localhost:3002/api/communities/${communityId}/events`,
                    {
                        title: 'Test AI Event',
                        content: 'This is a test event created by the automated validation script.'
                    },
                    { headers: { Authorization: `Bearer ${token}` } }
                );
                console.log('Event Status:', eventRes.status);
                console.log('Event Created:', eventRes.data.title);
                console.log('✅ Event Creation Successful! Schema fix confirmed.');
            } catch (e) {
                console.error('Event creation failed:', e.message);
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

testEventCreation();
