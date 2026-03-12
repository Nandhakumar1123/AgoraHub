const axios = require('axios');

const API_BASE_URL = 'http://localhost:3002/api';
let token = '';
let communityId = 0;
let pollId = 0;

async function runTest() {
    try {
        console.log('--- Starting Poll Voting Test ---');

        // 1. Login (assuming credentials from previous context or generic ones)
        const loginRes = await axios.post(`${API_BASE_URL}/login`, {
            emailOrUsername: 'nandhakumar1123@gmail.com', // Replace with a valid test user if needed
            password: 'password123'
        });
        token = loginRes.data.token;
        const userId = loginRes.data.user.user_id;
        console.log(`LoggedIn as User ID: ${userId}`);

        // 2. Get a community where the user is HEAD
        const communitiesRes = await axios.get(`${API_BASE_URL}/created_communities/${userId}`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        if (communitiesRes.data.length === 0) {
            console.error('No created communities found for test user.');
            return;
        }
        communityId = communitiesRes.data[0].id;
        console.log(`Using Community ID: ${communityId}`);

        // 3. Create a test poll
        const createPollRes = await axios.post(`${API_BASE_URL}/communities/${communityId}/polls`, {
            title: 'Test Auto Close Poll',
            description: 'Testing if this poll closes automatically',
            options: ['Option A', 'Option B'],
            allow_multiple_answers: false,
            result_visibility: 'immediate'
        }, {
            headers: { Authorization: `Bearer ${token}` }
        });
        pollId = createPollRes.data.poll_id;
        console.log(`Created Poll ID: ${pollId}`);

        // 4. Vote
        const voteRes = await axios.post(`${API_BASE_URL}/communities/${communityId}/polls/${pollId}/vote`, {
            option_ids: [createPollRes.data.options[0].option_id]
        }, {
            headers: { Authorization: `Bearer ${token}` }
        });
        console.log('Vote Response:', voteRes.data.message);

        // 5. Verify Poll Status
        const pollStatusRes = await axios.get(`${API_BASE_URL}/communities/${communityId}/polls/${pollId}`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        console.log('Poll Status - effectively_active:', pollStatusRes.data.effectively_active);
        console.log('Voter Count:', pollStatusRes.data.total_voters);

        console.log('--- Test Finished ---');
    } catch (error) {
        console.error('Test failed:', error.response ? error.response.data : error.message);
    }
}

runTest();
