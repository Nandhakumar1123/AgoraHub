// Simulate exactly what the frontend EventsScreen does
const axios = require('axios');

async function simulateFrontendEventCreation() {
  console.log('🎯 SIMULATING FRONTEND EVENT CREATION');
  console.log('=====================================');

  const API_BASE_URL = 'http://10.216.115.57:3000/api'; // Same as frontend

  try {
    // Step 1: Login to get token (same as frontend)
    console.log('\n1. Logging in...');
    const loginResponse = await axios.post(`${API_BASE_URL}/login`, {
      emailOrUsername: 'test@example.com',
      password: 'password123'
    });
    const token = loginResponse.data.token;
    console.log('✅ Got token:', token.substring(0, 20) + '...');

    // Step 2: Get community ID (simulate frontend logic)
    console.log('\n2. Getting community membership...');
    const membershipsResponse = await axios.get(`${API_BASE_URL}/joined_communities/20`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const communityId = membershipsResponse.data[0]?.id || 47; // Use first community or default
    console.log('✅ Using community ID:', communityId);

    // Step 3: Create event data (exactly like frontend)
    console.log('\n3. Preparing event data...');
    const title = 'Frontend Simulation Event ' + Date.now();
    const description = 'Created to test frontend event creation flow';
    const selectedDate = new Date().toISOString().split('T')[0]; // Today
    const futureTime = new Date(Date.now() + 60 * 60 * 1000); // Add 1 hour like frontend
    const hour = futureTime.getHours();
    const minute = futureTime.getMinutes();

    const combineDateTime = () => {
      const d = new Date(selectedDate);
      d.setHours(hour);
      d.setMinutes(minute);
      d.setSeconds(0);
      return d;
    };

    const eventDateTime = combineDateTime();
    console.log('Event date/time:', eventDateTime.toISOString());

    const eventData = {
      title: title.trim(),
      description: description.trim(),
      eventDate: eventDateTime.toISOString(),
      communityId: communityId
    };

    console.log('📝 Event data to send:', eventData);

    // Step 4: Create event (exactly like frontend)
    console.log('\n4. Creating event...');
    const createResponse = await axios.post(`${API_BASE_URL}/events`, eventData, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    console.log('✅ Event created successfully!');
    console.log('Response:', createResponse.data);

    // Step 5: Verify event was created by fetching events
    console.log('\n5. Verifying event creation...');
    const eventsResponse = await axios.get(`${API_BASE_URL}/events/${communityId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    const latestEvent = eventsResponse.data.events[0];
    console.log('Latest event in database:', {
      title: latestEvent.title,
      description: latestEvent.description.substring(0, 50) + '...',
      event_date: latestEvent.event_date,
      user_id: latestEvent.user_id,
      community_id: latestEvent.community_id
    });

    console.log('\n🎉 FRONTEND SIMULATION SUCCESSFUL!');
    console.log('The backend is working correctly. If frontend still fails:');
    console.log('1. Check AsyncStorage token retrieval');
    console.log('2. Verify community ID from route params');
    console.log('3. Check network connectivity on mobile device');
    console.log('4. Ensure mobile device can reach 10.216.115.57:3000');

  } catch (error) {
    console.error('❌ SIMULATION FAILED:', error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Response:', error.response.data);
    }
  }
}

simulateFrontendEventCreation();