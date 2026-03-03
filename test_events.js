const axios = require('axios');

async function testEventsAPI() {
  try {
    console.log('Testing events API...');

    // First login
    const loginResponse = await axios.post('http://localhost:3000/api/login', {
      emailOrUsername: 'test@example.com',
      password: 'password123'
    });

    if (loginResponse.data.token) {
      console.log('✅ Login successful');

      const token = loginResponse.data.token;

      // Check existing events first
      console.log('Checking existing events...');
      try {
        const existingEventsResponse = await axios.get('http://localhost:3000/api/events/47', {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
        console.log('Existing events count:', existingEventsResponse.data.events?.length || 0);
      } catch (error) {
        console.log('Error checking existing events:', error.response?.data || error.message);
      }

      // Create a test event
      console.log('Creating test event...');
      const eventData = {
        title: 'Frontend Test Event ' + Date.now(),
        description: 'Test event created from frontend troubleshooting',
        eventDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // Tomorrow
        communityId: 47
      };

      console.log('Event data:', eventData);

      const createResponse = await axios.post('http://localhost:3000/api/events', eventData, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      console.log('✅ Event created successfully:', createResponse.data);

      // Check events again after creation
      console.log('Checking events after creation...');
      const afterEventsResponse = await axios.get('http://localhost:3000/api/events/47', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      console.log('Events count after creation:', afterEventsResponse.data.events?.length || 0);
      console.log('Latest events:', afterEventsResponse.data.events?.slice(-3));

    } else {
      console.log('❌ Login failed');
    }
  } catch (error) {
    console.error('❌ Test failed:');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    } else {
      console.error('Error:', error.message);
    }
  }
}

testEventsAPI();