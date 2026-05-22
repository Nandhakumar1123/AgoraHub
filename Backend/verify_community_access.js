const { Pool } = require('pg');
const axios = require('axios');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/agorahub'
});

const API_URL = 'http://localhost:3002/api';

async function runVerification() {
  console.log('🚀 Starting end-to-end Community Access Control Verification...');
  
  // Define unique credentials for testing
  const testEmail = `community_test_${Date.now()}@example.com`;
  const testPassword = 'Password123!';
  const testName = 'Community Tester';
  let token = null;
  let userId = null;

  try {
    // 1. Register a test user
    console.log('1. Registering a new test user...');
    const registerResponse = await axios.post(`${API_URL}/register`, {
      full_name: testName,
      email: testEmail,
      mobile_number: '1234567890',
      password: testPassword,
      accept_terms: true
    });
    
    token = registerResponse.data.token;
    userId = registerResponse.data.user?.user_id || registerResponse.data.user_id;
    console.log(`✅ Registered test user (ID: ${userId})`);

    // Verify initial role in the database is MEMBER and can_create_community is false
    const dbCheck1 = await pool.query('SELECT role, can_create_community FROM users WHERE user_id = $1', [userId]);
    const initialRole = dbCheck1.rows[0].role;
    const initialCanCreate = dbCheck1.rows[0].can_create_community;
    console.log(`🔍 Database check - Initial Role: "${initialRole}", can_create_community: ${initialCanCreate}`);
    if (initialRole !== 'MEMBER' || initialCanCreate !== false) {
      throw new Error(`Initial state mismatch. Expected MEMBER/false, got ${initialRole}/${initialCanCreate}`);
    }

    // 2. Try to create community as MEMBER
    console.log('2. Testing community creation restriction for MEMBER...');
    try {
      await axios.post(`${API_URL}/create_community`, {
        name: 'Unauthorized Club',
        description: 'Should fail',
        community_type: 'Club'
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      throw new Error('❌ Member was able to create a community!');
    } catch (err) {
      if (err.response && err.response.status === 403) {
        console.log(`✅ Correctly rejected with status 403. Message: "${err.response.data.error}"`);
      } else {
        throw new Error(`Expected status 403, got ${err.response ? err.response.status : err.message}`);
      }
    }

    // 3. Elevate user by setting can_create_community = true
    console.log('3. Elevating user permission can_create_community = true in database...');
    await pool.query('UPDATE users SET can_create_community = true WHERE user_id = $1', [userId]);
    console.log('✅ User permission updated');

    // 4. Test validation: Invalid community type
    console.log('4. Testing validation: Invalid community type...');
    try {
      await axios.post(`${API_URL}/create_community`, {
        name: 'Valid Name',
        description: 'Valid Description',
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

    // 5. Test validation: Community name too long
    console.log('5. Testing validation: Community name too long...');
    try {
      await axios.post(`${API_URL}/create_community`, {
        name: 'a'.repeat(256),
        description: 'Valid Description',
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

    // 6. Test successful community creation
    console.log('6. Testing successful community creation...');
    const createResponse = await axios.post(`${API_URL}/create_community`, {
      name: 'Superb Tech Club',
      description: 'A place for builders',
      community_type: 'Club'
    }, {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    if (createResponse.status === 201) {
      console.log(`✅ Successfully created community! Code: "${createResponse.data.community.code}"`);
    } else {
      throw new Error(`Expected status 201, got ${createResponse.status}`);
    }

    // 7. Test duplicate name prevention per user
    console.log('7. Testing duplicate name prevention per user...');
    try {
      await axios.post(`${API_URL}/create_community`, {
        name: 'Superb Tech Club',
        description: 'Another one with the same name',
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
    // Cleanup test user
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
