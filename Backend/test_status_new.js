const axios = require('axios');

async function verifyStatusUpdate() {
    const BASE_URL = 'http://localhost:3002/api';
    try {
        console.log('--- Verifying Status Support ---');

        // 1. Login as Head
        const loginRes = await axios.post(`${BASE_URL}/login`, {
            emailOrUsername: 'test@example.com',
            password: 'password123'
        });
        const token = loginRes.data.token;
        console.log('✅ Logged in');

        // 2. Create a test community to ensure we are HEAD
        console.log('Creating test community...');
        let communityId;
        try {
            const commRes = await axios.post(`${BASE_URL}/create_community`, {
                name: 'Status Verification Community',
                description: 'Temporary community for testing',
                community_type: 'private'
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            communityId = commRes.data.community.community_id;
            console.log(`✅ Created test community #${communityId}`);
        } catch (e) {
            console.log('Community creation failed, trying community #1 as fallback...');
            communityId = 1;
        }

        // 3. Create a test complaint
        console.log('Creating test complaint...');
        const createRes = await axios.post(`${BASE_URL}/complaints`, {
            community_id: communityId,
            title: 'Verification Test Complaint',
            description: 'Testing new status support',
            category: 'other',
            severity: 'low'
        }, {
            headers: { Authorization: `Bearer ${token}` }
        });

        const targetId = createRes.data.complaint_id;
        console.log(`✅ Created test complaint #${targetId}`);

        // 3. Test InProgress
        console.log(`Testing update to InProgress for complaint #${targetId}...`);
        const statusUrl = `${BASE_URL}/complaints/${targetId}/status`;
        console.log(`PUT URL: ${statusUrl}`);

        try {
            const inProgressRes = await axios.put(statusUrl,
                { status: 'InProgress', remarks: 'Started working on it' },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            console.log('✅ Response status:', inProgressRes.status);
            console.log('✅ Updated status:', inProgressRes.data.status);
        } catch (e) {
            console.log('❌ InProgress update failed');
            if (e.response) {
                console.log('Status:', e.response.status);
                console.log('Data:', JSON.stringify(e.response.data));
            } else {
                console.log('Error:', e.message);
            }
        }

        // 4. Test Approved
        console.log('Testing update to Approved...');
        try {
            const approvedRes = await axios.put(statusUrl,
                { status: 'Approved', remarks: 'Looks valid' },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            console.log('✅ Response status:', approvedRes.status);
            console.log('✅ Updated status:', approvedRes.data.status);
        } catch (e) {
            console.log('❌ Approved update failed');
        }

        // 5. Test Rejected
        console.log('Testing update to Rejected...');
        try {
            const rejectedRes = await axios.put(statusUrl,
                { status: 'Rejected', remarks: 'Not feasible' },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            console.log('✅ Response status:', rejectedRes.status);
            console.log('✅ Updated status:', rejectedRes.data.status);
        } catch (e) {
            console.log('❌ Rejected update failed');
        }

        console.log('✅ Status verification completed!');

    } catch (error) {
        console.error('❌ Verification failed:');
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Data:', error.response.data);
        } else {
            console.error('Error:', error.message);
        }
    }
}

verifyStatusUpdate();
