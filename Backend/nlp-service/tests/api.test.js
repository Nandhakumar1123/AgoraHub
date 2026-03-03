const request = require('supertest');
const jwt = require('jsonwebtoken');
const { app } = require('../server');

// Mock token for testing
const generateTestToken = (userId = 1, communityId = 1, role = 'user') => {
  return jwt.sign(
    { userId, communityId, role },
    process.env.JWT_SECRET || 'test-secret',
    { expiresIn: '1h' }
  );
};

describe('NLP API Endpoints', () => {
  let authToken;
  
  beforeAll(() => {
    authToken = generateTestToken();
  });
  
  describe('POST /api/nlp/analyze', () => {
    it('should analyze text sentiment and toxicity', async () => {
      const response = await request(app)
        .post('/api/nlp/analyze')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          text: 'This is a wonderful community!',
          community_id: 1,
        });
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('sentiment');
      expect(response.body.data).toHaveProperty('toxicity');
      expect(response.body.data).toHaveProperty('safe');
    });
    
    it('should reject request without auth token', async () => {
      const response = await request(app)
        .post('/api/nlp/analyze')
        .send({
          text: 'Test text',
          community_id: 1,
        });
      
      expect(response.status).toBe(401);
    });
    
    it('should reject text exceeding max length', async () => {
      const longText = 'a'.repeat(6000);
      
      const response = await request(app)
        .post('/api/nlp/analyze')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          text: longText,
          community_id: 1,
        });
      
      expect(response.status).toBe(400);
    });
  });
  
  describe('POST /api/nlp/moderate', () => {
    it('should approve safe content', async () => {
      const response = await request(app)
        .post('/api/nlp/moderate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          text: 'Hello everyone, nice to meet you!',
          community_id: 1,
          message_type: 'chat',
        });
      
      expect(response.status).toBe(200);
      expect(response.body.data.approved).toBe(true);
    });
  });
  
  describe('GET /api/nlp/health', () => {
    it('should return service health status', async () => {
      const response = await request(app).get('/api/nlp/health');
      
      expect(response.status).toBe(200);
      expect(response.body.status).toBe('healthy');
      expect(response.body).toHaveProperty('models');
    });
  });
});

describe('Bot API Endpoints', () => {
  let authToken;
  
  beforeAll(() => {
    authToken = generateTestToken();
  });
  
  describe('POST /api/bot/ask', () => {
    it('should return response with empty knowledge base', async () => {
      const response = await request(app)
        .post('/api/bot/ask')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          question: 'What are the parking rules?',
          community_id: 1,
        });
      
      expect(response.status).toBe(200);
      expect(response.body.data).toHaveProperty('answer');
      expect(response.body.data).toHaveProperty('sources');
      expect(response.body.data).toHaveProperty('confidence');
    });
  });
});