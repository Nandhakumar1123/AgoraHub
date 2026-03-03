const axios = require('axios');

async function testComplaintsAPI() {
  try {
    console.log('Testing complaints API...');

    // First login
    const loginResponse = await axios.post('http://localhost:3000/api/login', {
      emailOrUsername: 'test@example.com',
      password: 'password123'
    });

    if (loginResponse.data.token) {
      console.log('Login successful');

      // Test complaints API for community 1
      const complaintsResponse = await axios.get('http://localhost:3000/api/complaints/1', {
        headers: {
          'Authorization': `Bearer ${loginResponse.data.token}`,
          'Content-Type': 'application/json'
        }
      });

      console.log('Complaints API response status:', complaintsResponse.status);
      console.log('Number of complaints:', complaintsResponse.data.complaints?.length || 0);
      console.log('Complaints sample:', complaintsResponse.data.complaints?.slice(0, 3));

    } else {
      console.log('Login failed');
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

testComplaintsAPI();