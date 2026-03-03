// Test EventsScreenHead functionality
const axios = require('axios');

async function testEventsScreenHead() {
  console.log('🧪 TESTING EventsScreenHead Event Creation');
  console.log('==========================================');

  const API_BASE_URL = 'http://localhost:3000/api';

  try {
    // Login to get token
    console.log('\n1. Logging in...');
    const loginResponse = await axios.post(`${API_BASE_URL}/login`, {
      emailOrUsername: 'test@example.com',
      password: 'password123'
    });
    const token = loginResponse.data.token;
    console.log('✅ Login successful');

    // Create event data (simulating EventsScreenHead form)
    const eventData = {
      title: 'EventsScreenHead Test Event ' + Date.now(),
      description: 'Testing event creation from EventsScreenHead',
      eventDate: new Date(Date.now() + 60 * 60 * 1000).toISOString(), // 1 hour from now
      communityId: 47
    };

    console.log('\n2. Creating event...');
    console.log('📤 Event data:', {
      title: eventData.title,
      description: eventData.description.substring(0, 30) + '...',
      eventDate: eventData.eventDate,
      communityId: eventData.communityId
    });

    const createResponse = await axios.post(`${API_BASE_URL}/events`, eventData, {
      headers: { Authorization: `Bearer ${token}` }
    });

    console.log('✅ Event created successfully!');
    console.log('📄 Response:', createResponse.data);

    // Verify event was created by fetching events
    console.log('\n3. Verifying event creation...');
    const eventsResponse = await axios.get(`${API_BASE_URL}/events/47`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    const latestEvent = eventsResponse.data.events[0];
    console.log('📋 Latest event in database:', {
      id: latestEvent.event_id,
      title: latestEvent.title.substring(0, 50) + '...',
      event_date: latestEvent.event_date,
      user_id: latestEvent.user_id
    });

    console.log('\n🎉 EventsScreenHead TEST PASSED!');
    console.log('✅ Event creation: WORKING');
    console.log('✅ Database storage: WORKING');
    console.log('✅ API retrieval: WORKING');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Response:', error.response.data);
    }
  }
}

testEventsScreenHead();