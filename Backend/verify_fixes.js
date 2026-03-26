const axios = require('axios');

const BASE_URL = 'http://localhost:3000/api';
let token = '';

async function runTests() {
  console.log('🚀 Starting Backend Verification Tests...');

  try {
    // 1. Login (assuming the user exists from previous context or generic credentials)
    // For verification, we might need a valid token. 
    // Since I don't have a specific user password, I'll check if the endpoints are at least reachable and returning 401.
    
    console.log('\n--- Testing Authentication Requirement ---');
    try {
      await axios.get(`${BASE_URL}/created_communities/1`);
    } catch (err) {
      if (err.response && err.response.status === 401) {
        console.log('✅ Auth requirement verified (Returned 401 as expected)');
      } else {
        console.log('❌ Auth test failed:', err.message);
      }
    }

    console.log('\n--- Testing Community Listing Route ---');
    // We expect 401 without token, or 200 with token.
    // Let's check if the route is defined (not 404)
    try {
      await axios.get(`${BASE_URL}/created_communities/1`);
    } catch (err) {
      if (err.response && err.response.status !== 404) {
        console.log('✅ Route /api/created_communities/:userId is defined');
      } else {
        console.log('❌ Route /api/created_communities/:userId returned 404');
      }
    }

    console.log('\n--- Testing Chat Messages Route ---');
    try {
      await axios.get(`${BASE_URL}/communities/1/messages`);
    } catch (err) {
      if (err.response && err.response.status !== 404) {
        console.log('✅ Route /api/communities/:id/messages is defined');
      } else {
        console.log('❌ Route /api/communities/:id/messages returned 404');
      }
    }

    console.log('\n--- Testing Socket.io Endpoint ---');
    try {
       const resp = await axios.get('http://localhost:3000/socket.io/?EIO=4&transport=polling');
       if (resp.status === 200) {
         console.log('✅ Socket.io is active and responding');
       }
    } catch (err) {
       console.log('❌ Socket.io health check failed:', err.message);
    }

    console.log('\n🎉 Verification complete.');
  } catch (error) {
    console.error('❌ Unexpected error during testing:', error.message);
  }
}

runTests();
