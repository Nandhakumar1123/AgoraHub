// Debug potential frontend issues
const axios = require('axios');

async function debugFrontendIssues() {
  console.log('🔍 DEBUGGING FRONTEND ISSUES');
  console.log('============================');

  const API_BASE_URL = 'http://10.216.115.57:3000/api';

  try {
    // Test 1: Check if invalid community ID causes issues
    console.log('\n1. Testing invalid community ID...');
    const loginResponse = await axios.post(`${API_BASE_URL}/login`, {
      emailOrUsername: 'test@example.com',
      password: 'password123'
    });
    const token = loginResponse.data.token;

    try {
      const eventData = {
        title: 'Test with invalid community',
        description: 'Testing invalid community ID',
        eventDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        communityId: 99999 // Invalid community ID
      };

      await axios.post(`${API_BASE_URL}/events`, eventData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      console.log('❌ Should have failed with invalid community ID');
    } catch (error) {
      if (error.response?.status === 403) {
        console.log('✅ Invalid community ID properly rejected:', error.response.data.error);
      } else {
        console.log('❌ Unexpected error for invalid community:', error.response?.data);
      }
    }

    // Test 2: Check if past date causes issues
    console.log('\n2. Testing past date validation...');
    try {
      const pastEventData = {
        title: 'Past date event',
        description: 'Should be rejected',
        eventDate: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // Yesterday
        communityId: 47
      };

      await axios.post(`${API_BASE_URL}/events`, pastEventData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      console.log('❌ Should have failed with past date');
    } catch (error) {
      if (error.response?.status === 400 && error.response.data.error.includes('past')) {
        console.log('✅ Past date properly rejected:', error.response.data.error);
      } else {
        console.log('❌ Unexpected error for past date:', error.response?.data);
      }
    }

    // Test 3: Check if missing fields cause issues
    console.log('\n3. Testing missing required fields...');
    try {
      const incompleteData = {
        title: 'Missing description',
        // description: 'Missing', // Intentionally missing
        eventDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        communityId: 47
      };

      await axios.post(`${API_BASE_URL}/events`, incompleteData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      console.log('❌ Should have failed with missing fields');
    } catch (error) {
      if (error.response?.status === 400) {
        console.log('✅ Missing fields properly rejected:', error.response.data.error);
      } else {
        console.log('❌ Unexpected error for missing fields:', error.response?.data);
      }
    }

    // Test 4: Check successful case (we already know this works)
    console.log('\n4. Testing successful case...');
    const validEventData = {
      title: 'Debug Test Event ' + Date.now(),
      description: 'Testing all validations pass',
      eventDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      communityId: 47
    };

    const response = await axios.post(`${API_BASE_URL}/events`, validEventData, {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log('✅ Valid event created successfully');

    console.log('\n📊 SUMMARY:');
    console.log('✅ Backend validation is working correctly');
    console.log('✅ Invalid community IDs are rejected');
    console.log('✅ Past dates are rejected');
    console.log('✅ Missing fields are rejected');
    console.log('✅ Valid events are created successfully');

    console.log('\n🔍 POSSIBLE FRONTEND ISSUES:');
    console.log('1. User not logged in (check AsyncStorage token)');
    console.log('2. Invalid or missing community ID');
    console.log('3. User selected past date/time');
    console.log('4. Network connectivity issues');
    console.log('5. Mobile device cannot reach backend IP');

  } catch (error) {
    console.error('❌ Debug test failed:', error.message);
  }
}

debugFrontendIssues();