const { Pool } = require('pg');
const axios = require('axios');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'db_mini',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'nandha102'
});

const API_URL = 'http://localhost:3002/api';
const VALID_REASON = 'Our apartment residents need a shared space to coordinate maintenance and meetings.';

async function runVerification() {
  console.log('🚀 Starting end-to-end Community Creation Verification...');
  
  const testEmail = `community_test_${Date.now()}@example.com`;
  const testPassword = 'Password123!';
  const testName = 'Community Tester';
  let token = null;
  let userId = null;

  try {
    console.log('1. Registering a new test user...');
    const registerResponse = await axios.post(`${API_URL}/register`, {
      fullName: testName,
      email: testEmail,
      mobileNumber: '1234567890',
      password: testPassword,
      acceptTerms: true
    });
    
    token = registerResponse.data.token;
    userId = registerResponse.data.user?.user_id || registerResponse.data.user_id;
    console.log(`✅ Registered test user (ID: ${userId})`);

    console.log('2. Testing validation: Missing reason...');
    try {
      await axios.post(`${API_URL}/create_community`, {
        name: 'Unauthorized Club',
        description: '',
        community_type: 'Club'
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      throw new Error('❌ Allowed community creation without a reason!');
    } catch (err) {
      if (err.response && err.response.status === 400) {
        console.log(`✅ Correctly rejected with status 400. Message: "${err.response.data.error}"`);
      } else {
        throw new Error(`Expected status 400, got ${err.response ? err.response.status : err.message}`);
      }
    }

    console.log('3. Testing validation: Invalid community type...');
    try {
      await axios.post(`${API_URL}/create_community`, {
        name: 'Valid Name',
        description: VALID_REASON,
        community_type: 'InvalidType'
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      throw new Error('❌ Allowed invalid community type!');
    } catch (err) {
      if (err.response && err.response.status === 400) {
        console.log(`✅ Correctly rejected with status 400. Message: "${err.response.data.error}"`);
      } else {
        throw new Error(`Expected status 400, got ${err.response ? err.response.status : err.message}`);
      }
    }

    console.log('4. Testing validation: Community name too long...');
    try {
      await axios.post(`${API_URL}/create_community`, {
        name: 'a'.repeat(256),
        description: VALID_REASON,
        community_type: 'Club'
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      throw new Error('❌ Allowed name longer than 255 characters!');
    } catch (err) {
      if (err.response && err.response.status === 400) {
        console.log(`✅ Correctly rejected with status 400. Message: "${err.response.data.error}"`);
      } else {
        throw new Error(`Expected status 400, got ${err.response ? err.response.status : err.message}`);
      }
    }

    console.log('5. Testing successful community creation for a regular member...');
    const createResponse = await axios.post(`${API_URL}/create_community`, {
      name: 'Superb Tech Club',
      description: VALID_REASON,
      community_type: 'Club'
    }, {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    if (createResponse.status === 201) {
      console.log(`✅ Successfully created community! Code: "${createResponse.data.community.code}"`);
    } else {
      throw new Error(`Expected status 201, got ${createResponse.status}`);
    }

    console.log('6. Testing duplicate name prevention per user...');
    try {
      await axios.post(`${API_URL}/create_community`, {
        name: 'Superb Tech Club',
        description: VALID_REASON,
        community_type: 'Club'
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      throw new Error('❌ Allowed creation of duplicate community name!');
    } catch (err) {
      if (err.response && err.response.status === 400) {
        console.log(`✅ Correctly rejected with status 400. Message: "${err.response.data.error}"`);
      } else {
        throw new Error(`Expected status 400, got ${err.response ? err.response.status : err.message}`);
      }
    }

    console.log('\n⭐ ALL VERIFICATION CHECKS PASSED SUCCESSFULLY! ⭐\n');

  } catch (error) {
    console.error('❌ Verification failed:', error.message);
    if (error.response) {
      console.error('Response details:', error.response.data);
    }
  } finally {
    if (userId) {
      console.log('🧹 Cleaning up test user and created communities...');
      try {
        await pool.query('DELETE FROM memberships WHERE user_id = $1', [userId]);
        await pool.query('DELETE FROM communities WHERE created_by = $1', [userId]);
        await pool.query('DELETE FROM users WHERE user_id = $1', [userId]);
        console.log('✅ Cleanup finished successfully');
      } catch (cleanupErr) {
        console.error('Error during cleanup:', cleanupErr.message);
      }
    }
    await pool.end();
  }
}

runVerification();
