// Detailed test of EventsScreenHead event creation
const axios = require('axios');

async function testEventsScreenHeadDetailed() {
  console.log('🧪 DETAILED EventsScreenHead Event Creation Test');
  console.log('================================================');

  // Use the same API_BASE_URL as EventsScreenHead
  const API_BASE_URL = "http://localhost:3000/api"; // Since we're testing on web

  try {
    console.log('\n1. Testing login...');
    const loginResponse = await axios.post(`${API_BASE_URL}/login`, {
      emailOrUsername: 'test@example.com',
      password: 'password123'
    });
    const token = loginResponse.data.token;
    console.log('✅ Login successful, token length:', token.length);

    console.log('\n2. Getting user role in community...');
    const communityId = 47; // Same as used in EventsScreenHead test
    const membersResponse = await axios.get(`${API_BASE_URL}/community_members/${communityId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    console.log('✅ Community members fetched');
    const tokenPayload = JSON.parse(atob(token.split('.')[1]));
    const currentUser = membersResponse.data.members.find(member => member.user_id === tokenPayload.user_id);

    if (!currentUser) {
      console.log('❌ Current user not found in community members');
      return;
    }

    console.log('✅ User role in community:', currentUser.role);

    if (currentUser.role !== 'HEAD') {
      console.log('❌ User is not HEAD, cannot create events');
      return;
    }

    console.log('\n3. Simulating EventsScreenHead form data...');
    const title = 'EventsScreenHead Test ' + Date.now();
    const description = 'Testing event creation from EventsScreenHead form';
    const selectedDate = new Date().toISOString().split('T')[0]; // Today
    const hour = 15; // 3 PM
    const minute = 30; // 30 minutes

    console.log('Form data:', { title, description, selectedDate, hour, minute, communityId });

    // Simulate combineDateTime function
    console.log('\n4. Simulating combineDateTime...');
    const eventDateTime = new Date(selectedDate);
    eventDateTime.setHours(hour);
    eventDateTime.setMinutes(minute);
    eventDateTime.setSeconds(0);

    console.log('Combined date/time:', eventDateTime.toISOString());

    // Validate date (same as frontend)
    const current = new Date();
    console.log('Current time:', current.toISOString());
    console.log('Event time:', eventDateTime.toISOString());

    if (eventDateTime.getTime() <= current.getTime()) {
      console.log('❌ Validation would fail - past date/time');
      return;
    }

    console.log('✅ Date validation passed');

    console.log('\n5. Preparing event data (same as frontend)...');
    const eventData = {
      title: title.trim(),
      description: description.trim(),
      eventDate: eventDateTime.toISOString(),
      communityId: communityId
    };

    console.log('Event data to send:', eventData);

    console.log('\n6. Creating event (same API call as EventsScreenHead)...');
    const createResponse = await axios.post(`${API_BASE_URL}/events`, eventData, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    console.log('✅ Event created successfully!');
    console.log('📄 Response:', createResponse.data);

    console.log('\n7. Verifying event was created...');
    const eventsResponse = await axios.get(`${API_BASE_URL}/events/${communityId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    const latestEvent = eventsResponse.data.events[0];
    console.log('📋 Latest event in database:', {
      id: latestEvent.event_id,
      title: latestEvent.title.substring(0, 50) + '...',
      event_date: latestEvent.event_date,
      user_id: latestEvent.user_id
    });

    console.log('\n🎉 EventsScreenHead SIMULATION SUCCESSFUL!');
    console.log('✅ If this works but frontend doesn\'t, the issue is in:');
    console.log('   - AsyncStorage token retrieval');
    console.log('   - Form data preparation');
    console.log('   - Network connectivity');
    console.log('   - Platform-specific API_BASE_URL');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Response:', error.response.data);
      console.error('Config:', error.config);
    } else if (error.request) {
      console.error('No response received');
    }
  }
}

testEventsScreenHeadDetailed();