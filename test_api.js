const axios = require('axios');

async function testAPI() {
  try {
    console.log('Testing API connectivity...');

    // Test 1: Basic connectivity
    console.log('1. Testing basic connectivity to /api/test');
    const testResponse = await axios.get('http://localhost:3000/api/test');
    console.log('✅ Basic connectivity works:', testResponse.data);

    // Test 2: Check if events endpoint is accessible (without auth first)
    console.log('2. Testing events endpoint without auth');
    try {
      await axios.get('http://localhost:3000/api/events/47');
    } catch (error) {
      if (error.response && error.response.status === 401) {
        console.log('✅ Auth check working - endpoint requires authentication');
      } else {
        console.log('❌ Unexpected error:', error.message);
      }
    }

    // Test 3: Try to login and get a token
    console.log('3. Testing login');
    const loginData = {
      emailOrUsername: 'test@example.com',
      password: 'password123'
    };

    const loginResponse = await axios.post('http://localhost:3000/api/login', loginData);
    console.log('✅ Login successful');
    const token = loginResponse.data.token;

    // Test 4: Get events with valid token
    console.log('4. Testing events fetch with valid token');
    const eventsResponse = await axios.get('http://localhost:3000/api/events/47', {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log('✅ Events fetch successful, found', eventsResponse.data.events.length, 'events');

    // Test 5: Try to create an event
    console.log('5. Testing event creation');
    const eventData = {
      title: 'API Test Event ' + Date.now(),
      description: 'This event was created by the API test script',
      eventDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // Tomorrow
      communityId: 47
    };

    const createResponse = await axios.post('http://localhost:3000/api/events', eventData, {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log('✅ Event creation successful:', createResponse.data);

    console.log('🎉 All API tests passed!');

  } catch (error) {
    console.error('❌ API test failed:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  }
}

testAPI();