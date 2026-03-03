// Test if mobile device can reach backend
const axios = require('axios');

async function testMobileConnectivity() {
  console.log('📱 TESTING MOBILE CONNECTIVITY');
  console.log('==============================');

  const MOBILE_API_URL = 'http://10.216.115.57:3000/api';

  try {
    console.log('Testing connection to:', MOBILE_API_URL);

    // Test 1: Basic connectivity
    console.log('\n1. Testing basic endpoint...');
    const response = await axios.get(`${MOBILE_API_URL}/test`, { timeout: 5000 });
    console.log('✅ Mobile device can reach backend!');
    console.log('Response:', response.data);

    // Test 2: Test with auth (like the app does)
    console.log('\n2. Testing with authentication flow...');
    const loginResponse = await axios.post(`${MOBILE_API_URL}/login`, {
      emailOrUsername: 'test@example.com',
      password: 'password123'
    });

    const token = loginResponse.data.token;
    console.log('✅ Authentication works from mobile');

    // Test 3: Test events endpoint
    const eventsResponse = await axios.get(`${MOBILE_API_URL}/events/47`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log('✅ Events fetching works from mobile');

    console.log('\n🎉 MOBILE CONNECTIVITY TEST PASSED!');
    console.log('The mobile device can reach the backend successfully.');

  } catch (error) {
    console.error('❌ MOBILE CONNECTIVITY TEST FAILED');
    console.error('Error:', error.message);

    if (error.code === 'ECONNREFUSED') {
      console.error('\n🔍 DIAGNOSIS: Connection refused');
      console.error('This means the mobile device cannot reach the backend server.');
      console.error('Possible causes:');
      console.error('1. Wrong IP address in API_BASE_URL');
      console.error('2. Firewall blocking the connection');
      console.error('3. Backend server not running');
      console.error('4. Mobile device on different network than computer');
    } else if (error.code === 'ENOTFOUND') {
      console.error('\n🔍 DIAGNOSIS: Host not found');
      console.error('The IP address 10.216.115.57 cannot be resolved.');
    } else if (error.code === 'ETIMEDOUT') {
      console.error('\n🔍 DIAGNOSIS: Connection timeout');
      console.error('The request timed out. This could mean:');
      console.error('1. Network connectivity issues');
      console.error('2. Firewall blocking the port');
      console.error('3. Wrong IP address');
    }

    console.error('\n💡 SOLUTIONS:');
    console.error('1. Run this test on the mobile device itself (not computer)');
    console.error('2. Check if both devices are on the same WiFi network');
    console.error('3. Temporarily disable firewall on computer');
    console.error('4. Try using the computer\'s IP address instead of 10.216.115.57');
    console.error('5. For web testing, use localhost instead of IP address');
  }
}

testMobileConnectivity();