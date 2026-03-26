const axios = require('axios');

async function testSubmitComplaint() {
    try {
        console.log('Logging in...');
        // We'll try to find a user in the database to login with, or just try a likely login
        // For testing, I'll use the credentials from test_petition_submit.js if they work
        const loginRes = await axios.post('http://localhost:3002/api/login', {
            emailOrUsername: 'test@example.com',
            password: 'password123'
        });
        
        const token = loginRes.data.token;
        console.log('Logged in. Token retrieved.');

        console.log('Submitting complaint...');
        const complaintData = {
            community_id: 36, // Using HostelA community
            title: 'Test Complaint from Debug Script',
            description: 'This is a test description for debugging.',
            category: 'other',
            severity: 'low',
            is_urgent: false,
            visibility: 'public'
        };

        const response = await axios.post('http://localhost:3002/api/complaints', complaintData, {
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

testSubmitComplaint();
