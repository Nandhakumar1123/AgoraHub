const axios = require('axios');
const API = 'http://localhost:3002/api';

async function setup() {
    try {
        console.log('--- Starting verification script ---');
        // 1. Register
        const email = `polltest${Date.now()}@example.com`;
        const reg = await axios.post(`${API}/register`, {
            fullName: 'Poll Tester',
            email: email,
            password: 'password123',
            profileType: 'transparent',
            acceptTerms: true
        });
        const token = reg.data.token;
        console.log('Registered as:', email);

        // 2. Create Community
        const comm = await axios.post(`${API}/create_community`, {
            name: 'Poll Test Comm',
            community_type: 'Residential'
        }, {
            headers: { Authorization: `Bearer ${token}` }
        });
        const cid = comm.data.community.community_id;
        console.log('Community created. ID:', cid);

        // 3. Create Poll
        const poll = await axios.post(`${API}/communities/${cid}/polls`, {
            title: 'Test Poll',
            options: ['Yes', 'No'],
            result_visibility: 'immediate'
        }, {
            headers: { Authorization: `Bearer ${token}` }
        });
        const pid = poll.data.poll.poll_id;
        console.log('Poll created. ID:', pid);

        // 4. Vote
        const vote = await axios.post(`${API}/communities/${cid}/polls/${pid}/vote`, {
            option_ids: [poll.data.options[0].option_id]
        }, {
            headers: { Authorization: `Bearer ${token}` }
        });
        console.log('Vote cast result:', vote.data.message);

        // 5. Register a Member
        console.log('--- Registering a Member ---');
        const memberEmail = `member${Date.now()}@example.com`;
        const mReg = await axios.post(`${API}/register`, {
            fullName: 'Member One',
            email: memberEmail,
            password: 'password123',
            profileType: 'transparent',
            acceptTerms: true
        });
        const mToken = mReg.data.token;

        console.log('Joining community...');
        await axios.post(`${API}/join_community`, {
            community_id: cid
        }, {
            headers: { Authorization: `Bearer ${mToken}` }
        });

        console.log('Voting as member...');
        const mVote = await axios.post(`${API}/communities/${cid}/polls/${pid}/vote`, {
            option_ids: [poll.data.options[0].option_id]
        }, {
            headers: { Authorization: `Bearer ${mToken}` }
        });
        console.log('Member Vote result:', mVote.data.message);

        // 6. Check if poll status is closed
        const status = await axios.get(`${API}/communities/${cid}/polls/${pid}`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        console.log('Poll Is Active:', status.data.is_active);
        console.log('Poll Effectively Active:', status.data.effectively_active);

        if (status.data.is_active === false) {
            console.log('SUCCESS: Poll automatically closed after the only member voted.');
        } else {
            console.log('FAILURE: Poll did not auto-close.');
        }

    } catch (e) {
        console.error('Error during setup:', e.response ? e.response.data : e.message);
    }
}

setup();
