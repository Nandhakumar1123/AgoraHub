// Quick JWT token generator for testing
const jwt = require('jsonwebtoken');

const JWT_SECRET = 'your-super-secret-jwt-key-change-this-in-production';

// Generate a test JWT token
const payload = {
  userId: 1,
  id: 1,
  communityId: 1,
  role: 'admin',
  iat: Math.floor(Date.now() / 1000),
  exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60) // 24 hours
};

const token = jwt.sign(payload, JWT_SECRET);

console.log('Test JWT Token:');
console.log(token);
console.log('\nUse this token in your API requests as: Bearer ' + token);