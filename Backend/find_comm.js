const axios = require('axios');

async function findCommunity() {
    const BASE_URL = 'http://localhost:3002/api';
    try {
        const loginRes = await axios.post(`${BASE_URL}/login`, {
            emailOrUsername: 'test@example.com',
            password: 'password123'
        });
        const token = loginRes.data.token;

        // There might be a "my communities" endpoint
        // Looking at common names: /my_communities, /user/communities, /memberships
        const endpoints = ['/my_communities', '/my-communities', '/communities'];

        for (const ep of endpoints) {
            try {
                console.log(`Trying ${ep}...`);
                const res = await axios.get(`${BASE_URL}${ep}`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                console.log(`Success on ${ep}:`, res.data);
            } catch (e) {
                console.log(`Failed on ${ep}`);
            }
        }
    } catch (err) {
        console.error('Login failed');
    }
}

findCommunity();
