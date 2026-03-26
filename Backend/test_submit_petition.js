const axios = require('axios');

async function testSubmitPetition() {
    try {
        console.log('Logging in...');
        const loginRes = await axios.post('http://localhost:3002/api/login', {
            emailOrUsername: 'test@example.com',
            password: 'password123'
        });
        
        const token = loginRes.data.token;
        console.log('Logged in.');

        console.log('Submitting petition...');
        const petitionData = {
            community_id: 36,
            title: 'Test Petition from Debug Script',
            summary: 'Summary of the test petition.',
            proposed_action: 'Action to be taken.',
            goal_type: 'Policy Change',
            impact_area: 'All Community Members',
            visibility: 'public'
        };

        const response = await axios.post('http://localhost:3002/api/petitions', petitionData, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        console.log('Response Status:', response.status);
        console.log('Response Data:', response.data);
    } catch (error) {
        console.error('Submission failed:');
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Data:', JSON.stringify(error.response.data, null, 2));
        } else {
            console.error('Error:', error.message);
        }
    }
}

testSubmitPetition();
