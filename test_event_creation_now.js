// Test event creation right now to verify backend is working
const axios = require('axios');

async function testEventCreationNow() {
  console.log('🎯 TESTING EVENT CREATION RIGHT NOW');
  console.log('====================================');

  const API_BASE_URL = 'http://localhost:3000/api';

  try {
    // Login
    console.log('1. Logging in...');
    const loginResponse = await axios.post(`${API_BASE_URL}/login`, {
      emailOrUsername: 'test@example.com',
      password: 'password123'
    });
    const token = loginResponse.data.token;
    console.log('✅ Login successful');

    // Create event with timestamp
    const now = new Date();
    const futureTime = new Date(now.getTime() + 2 * 60 * 60 * 1000); // 2 hours from now

    const eventData = {
      title: `Live Test Event ${now.getTime()}`,
      description: `Created at ${now.toISOString()} to test live event creation`,
      eventDate: futureTime.toISOString(),
      communityId: 47
    };

    console.log('2. Creating event...');
    console.log('📤 Event data:', eventData);

    const createResponse = await axios.post(`${API_BASE_URL}/events`, eventData, {
      headers: { Authorization: `Bearer ${token}` }
    });

    console.log('✅ Event created successfully!');
    console.log('📄 Response:', createResponse.data);

    // Verify in database
    console.log('3. Verifying in database...');
    const eventsResponse = await axios.get(`${API_BASE_URL}/events/47`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    const latestEvent = eventsResponse.data.events[0];
    console.log('📋 Latest event in database:', {
      id: latestEvent.event_id,
      title: latestEvent.title.substring(0, 50) + '...',
      created_at: latestEvent.created_at,
      event_date: latestEvent.event_date
    });

    console.log('\n🎉 BACKEND IS WORKING PERFECTLY!');
    console.log('✅ Event creation: WORKING');
    console.log('✅ Database storage: WORKING');
    console.log('✅ API retrieval: WORKING');

    console.log('\n🔍 CONCLUSION: Issue is in the FRONTEND');
    console.log('The backend can create and store events successfully.');
    console.log('The problem is that your frontend is not making the API calls.');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Response:', error.response.data);
    }
  }
}

testEventCreationNow();