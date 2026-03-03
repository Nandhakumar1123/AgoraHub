const axios = require('axios');

async function testComplaintsAPI() {
  try {
    const loginResponse = await axios.post('http://localhost:3000/api/login', {
      emailOrUsername: 'test@example.com',
      password: 'password123'
    });

    if (loginResponse.data.token) {
      const complaintsResponse = await axios.get('http://localhost:3000/api/complaints/1', {
        headers: {
          'Authorization': `Bearer ${loginResponse.data.token}`,
          'Content-Type': 'application/json'
        }
      });

      console.log('Number of complaints:', complaintsResponse.data.complaints?.length || 0);
      console.log('Latest complaints:', complaintsResponse.data.complaints?.slice(0, 3).map(c => ({id: c.complaint_id, title: c.title, created_by: c.created_by_name})));
    }
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
  }
}

testComplaintsAPI();