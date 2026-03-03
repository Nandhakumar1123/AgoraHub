const axios = require('axios');

async function testMembersAPI() {
  try {
    console.log('Testing community members API...');

    // First login
    const loginResponse = await axios.post('http://localhost:3000/api/login', {
      emailOrUsername: 'test@example.com',
      password: 'password123'
    });

    if (loginResponse.data.token) {
      console.log('Login successful');

      // Test members API for community 1
      const membersResponse = await axios.get('http://localhost:3000/api/community_members/1', {
        headers: {
          'Authorization': `Bearer ${loginResponse.data.token}`,
          'Content-Type': 'application/json'
        }
      });

      console.log('Members API response status:', membersResponse.status);
      console.log('Number of members:', membersResponse.data.members?.length || 0);
      console.log('Members:', membersResponse.data.members?.map(m => ({name: m.full_name, role: m.role})));

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

testMembersAPI();