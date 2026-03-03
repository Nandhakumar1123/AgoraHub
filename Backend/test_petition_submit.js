const axios = require('axios');

async function testPetitionSubmission() {
  try {
    console.log('Testing petition submission...');

    // Login first
    const loginResponse = await axios.post('http://localhost:3000/api/login', {
      emailOrUsername: 'test@example.com',
      password: 'password123'
    });

    if (loginResponse.data.token) {
      console.log('Login successful');

      // Submit petition
      const petitionResponse = await axios.post('http://localhost:3000/api/petitions', {
        title: 'Test Petition from API',
        problemStatement: 'This is a test problem',
        proposedAction: 'This is a test solution',
        goalType: 'Policy Change',
        impactArea: 'All Community Members',
        communityId: 1,
        visibility: 'public'
      }, {
        headers: {
          'Authorization': `Bearer ${loginResponse.data.token}`,
          'Content-Type': 'application/json'
        }
      });

      console.log('Petition submission status:', petitionResponse.status);
      console.log('Response:', petitionResponse.data);
    }
  } catch (error) {
    console.error('Test failed:');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    } else {
      console.error('Error:', error.message);
    }
  }
}

testPetitionSubmission();