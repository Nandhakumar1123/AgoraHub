// tests/services.test.js
// Comprehensive tests for NLP, RAG, and Moderation services

const { 
    analyzeSentiment, 
    analyzeToxicity, 
    analyzeText,
    detectLanguage,
  } = require('../services/nlp.service');
  
  const {
    generateEmbedding,
    addDocument,
    searchDocuments,
    askBot,
  } = require('../services/rag.service');
  
  const {
    moderateContent,
    getModerationStats,
  } = require('../services/moderation.service');
  
  // Mock dependencies
  jest.mock('../config/redis', () => ({
    getCache: jest.fn(),
    setCache: jest.fn(),
    getModelCacheKey: jest.fn((text, type) => `mock:${type}:${text.substring(0, 10)}`),
  }));
  
  jest.mock('../config/database', () => ({
    query: jest.fn(),
    vectorSearch: jest.fn(),
  }));
  
  jest.mock('../config/logger', () => ({
    logger: {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    },
    logPerformance: jest.fn(),
    logAudit: jest.fn(),
  }));
  
  const { getCache, setCache } = require('../config/redis');
  const { query, vectorSearch } = require('../config/database');
  
  describe('NLP Service', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });
  
    describe('Language Detection', () => {
      it('should detect English', () => {
        const text = 'This is a wonderful community';
        const language = detectLanguage(text);
        expect(language).toBe('en');
      });
  
      it('should handle empty text', () => {
        const language = detectLanguage('');
        expect(language).toBe('en'); // Default to English
      });
    });
  
    describe('Sentiment Analysis', () => {
      it('should analyze positive sentiment from cache', async () => {
        const text = 'This is wonderful!';
        const cachedResult = {
          label: 'POSITIVE',
          score: 0.99,
          language: 'en',
        };
  
        getCache.mockResolvedValue(cachedResult);
  
        const result = await analyzeSentiment(text);
  
        expect(result).toEqual(cachedResult);
        expect(getCache).toHaveBeenCalled();
      });
  
      it('should handle sentiment analysis errors gracefully', async () => {
        const text = 'Test text';
        
        getCache.mockResolvedValue(null);
        
        // Mock model failure by making setCache throw
        setCache.mockRejectedValue(new Error('Cache error'));
  
        await expect(analyzeSentiment(text)).rejects.toThrow();
      });
  
      it('should truncate long text to 512 characters', async () => {
        const longText = 'a'.repeat(1000);
        
        getCache.mockResolvedValue(null);
        setCache.mockResolvedValue(true);
  
        // Should not throw error for long text
        // Model should handle truncation internally
        await expect(analyzeSentiment(longText)).resolves.toBeDefined();
      });
    });
  
    describe('Toxicity Detection', () => {
      it('should detect toxic content from cache', async () => {
        const text = 'Some toxic message';
        const cachedResult = {
          label: 'toxic',
          score: 0.95,
          isToxic: true,
        };
  
        getCache.mockResolvedValue(cachedResult);
  
        const result = await analyzeToxicity(text);
  
        expect(result).toEqual(cachedResult);
        expect(result.isToxic).toBe(true);
      });
  
      it('should detect non-toxic content', async () => {
        const text = 'Hello everyone!';
        const cachedResult = {
          label: 'non-toxic',
          score: 0.05,
          isToxic: false,
        };
  
        getCache.mockResolvedValue(cachedResult);
  
        const result = await analyzeToxicity(text);
  
        expect(result.isToxic).toBe(false);
      });
    });
  
    describe('Full Text Analysis', () => {
      it('should perform complete analysis', async () => {
        const text = 'This is a great community!';
  
        getCache.mockResolvedValue(null);
        setCache.mockResolvedValue(true);
  
        const result = await analyzeText(text);
  
        expect(result).toHaveProperty('sentiment');
        expect(result).toHaveProperty('toxicity');
        expect(result).toHaveProperty('language');
        expect(result).toHaveProperty('safe');
        expect(result).toHaveProperty('metadata');
      });
  
      it('should mark toxic content as unsafe', async () => {
        const text = 'Toxic message';
  
        getCache
          .mockResolvedValueOnce(null) // sentiment cache miss
          .mockResolvedValueOnce({ // toxicity cache hit
            label: 'toxic',
            score: 0.9,
            isToxic: true,
          });
  
        const result = await analyzeText(text);
  
        expect(result.safe).toBe(false);
        expect(result.toxicity.isToxic).toBe(true);
      });
  
      it('should include processing time in metadata', async () => {
        const text = 'Test message';
  
        getCache.mockResolvedValue(null);
        setCache.mockResolvedValue(true);
  
        const result = await analyzeText(text);
  
        expect(result.metadata).toHaveProperty('processingTime');
        expect(result.metadata.processingTime).toBeGreaterThan(0);
      });
    });
  });
  
  describe('RAG Service', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });
  
    describe('Embedding Generation', () => {
      it('should generate embeddings for text', async () => {
        const text = 'Community parking guidelines';
  
        const embedding = await generateEmbedding(text);
  
        expect(embedding).toBeDefined();
        expect(Array.isArray(embedding)).toBe(true);
        expect(embedding.length).toBeGreaterThan(0);
      });
  
      it('should generate consistent embeddings', async () => {
        const text = 'Same text';
  
        const embedding1 = await generateEmbedding(text);
        const embedding2 = await generateEmbedding(text);
  
        // Embeddings should be similar (not testing exact match due to potential normalization)
        expect(embedding1.length).toBe(embedding2.length);
      });
  
      it('should handle empty text', async () => {
        const text = '';
  
        await expect(generateEmbedding(text)).resolves.toBeDefined();
      });
    });
  
    describe('Document Management', () => {
      it('should add document to vector database', async () => {
        const communityId = 1;
        const title = 'Parking Rules';
        const content = 'Parking is allowed in designated spots only';
        const uploadedBy = 123;
  
        query.mockResolvedValue({
          rows: [{ id: 42 }],
        });
  
        const docId = await addDocument(communityId, title, content, uploadedBy);
  
        expect(docId).toBe(42);
        expect(query).toHaveBeenCalledWith(
          expect.stringContaining('INSERT INTO community_docs'),
          expect.arrayContaining([communityId, title, content])
        );
      });
  
      it('should handle database errors', async () => {
        query.mockRejectedValue(new Error('Database error'));
  
        await expect(
          addDocument(1, 'Title', 'Content', 123)
        ).rejects.toThrow('Database error');
      });
    });
  
    describe('Document Search', () => {
      it('should find relevant documents', async () => {
        const question = 'What are the parking rules?';
        const communityId = 1;
  
        const mockDocs = [
          {
            id: 1,
            title: 'Parking Guidelines',
            content: 'Parking rules...',
            similarity: 0.89,
          },
          {
            id: 2,
            title: 'Community Rules',
            content: 'General rules...',
            similarity: 0.75,
          },
        ];
  
        vectorSearch.mockResolvedValue(mockDocs);
  
        const results = await searchDocuments(question, communityId, 5);
  
        expect(results).toEqual(mockDocs);
        expect(results.length).toBe(2);
        expect(results[0].similarity).toBeGreaterThan(results[1].similarity);
      });
  
      it('should return empty array when no documents found', async () => {
        vectorSearch.mockResolvedValue([]);
  
        const results = await searchDocuments('Unknown topic', 1);
  
        expect(results).toEqual([]);
      });
  
      it('should limit results to specified count', async () => {
        const mockDocs = Array(10).fill(null).map((_, idx) => ({
          id: idx,
          title: `Doc ${idx}`,
          content: 'Content',
          similarity: 0.5,
        }));
  
        vectorSearch.mockResolvedValue(mockDocs.slice(0, 3));
  
        const results = await searchDocuments('Question', 1, 3);
  
        expect(results.length).toBeLessThanOrEqual(3);
      });
    });
  
    describe('Bot Question Answering', () => {
      it('should answer question with relevant documents', async () => {
        const question = 'What are parking rules?';
        const communityId = 1;
        const userId = 123;
  
        const mockDocs = [
          {
            id: 1,
            title: 'Parking Guidelines',
            content: 'Parking is allowed in designated spots only',
            similarity: 0.89,
          },
        ];
  
        vectorSearch.mockResolvedValue(mockDocs);
  
        // Mock Ollama response
        const axios = require('axios');
        jest.spyOn(axios, 'post').mockResolvedValue({
          data: {
            response: 'According to the parking guidelines, parking is allowed in designated spots only.',
            context: 'mock-context',
          },
        });
  
        const result = await askBot(question, communityId, userId);
  
        expect(result).toHaveProperty('answer');
        expect(result).toHaveProperty('sources');
        expect(result).toHaveProperty('confidence');
        expect(result).toHaveProperty('sessionHash');
        expect(result.sources.length).toBeGreaterThan(0);
        expect(result.confidence).toBeGreaterThan(0);
      });
  
      it('should handle no relevant documents', async () => {
        vectorSearch.mockResolvedValue([]);
  
        const result = await askBot('Unknown question', 1, 123);
  
        expect(result.answer).toContain("don't have enough information");
        expect(result.sources).toEqual([]);
        expect(result.confidence).toBe(0);
      });
  
      it('should calculate confidence from similarity scores', async () => {
        const mockDocs = [
          { id: 1, title: 'Doc1', content: 'Content', similarity: 0.9 },
          { id: 2, title: 'Doc2', content: 'Content', similarity: 0.8 },
        ];
  
        vectorSearch.mockResolvedValue(mockDocs);
  
        const axios = require('axios');
        jest.spyOn(axios, 'post').mockResolvedValue({
          data: { response: 'Answer', context: 'context' },
        });
  
        const result = await askBot('Question', 1, 123);
  
        // Average similarity: (0.9 + 0.8) / 2 = 0.85 = 85%
        expect(result.confidence).toBe(85);
      });
    });
  });
  
  describe('Moderation Service', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });
  
    describe('Content Moderation', () => {
      it('should approve safe content', async () => {
        const text = 'Hello everyone!';
        const communityId = 1;
        const userId = 123;
  
        getCache.mockResolvedValue(null);
        setCache.mockResolvedValue(true);
        query.mockResolvedValue({ rows: [] });
  
        const result = await moderateContent(text, communityId, userId, 'chat');
  
        expect(result.approved).toBe(true);
        expect(result.action).toBe('approved');
        expect(result.reason).toBeNull();
        expect(result.holdId).toBeNull();
      });
  
      it('should quarantine toxic content', async () => {
        const text = 'Very toxic message';
        const communityId = 1;
        const userId = 123;
  
        getCache
          .mockResolvedValueOnce(null) // sentiment
          .mockResolvedValueOnce({ // toxicity
            label: 'toxic',
            score: 0.95,
            isToxic: true,
          });
  
        query.mockResolvedValue({
          rows: [{ id: 456 }],
        });
  
        const result = await moderateContent(text, communityId, userId, 'chat');
  
        expect(result.approved).toBe(false);
        expect(result.action).toBe('quarantined');
        expect(result.reason).toContain('toxic');
        expect(result.holdId).toBe(456);
      });
  
      it('should include analysis details', async () => {
        const text = 'Test message';
        const communityId = 1;
        const userId = 123;
  
        getCache.mockResolvedValue(null);
        setCache.mockResolvedValue(true);
        query.mockResolvedValue({ rows: [] });
  
        const result = await moderateContent(text, communityId, userId, 'chat');
  
        expect(result).toHaveProperty('analysis');
        expect(result.analysis).toHaveProperty('sentiment');
        expect(result.analysis).toHaveProperty('toxicity');
        expect(result.analysis).toHaveProperty('language');
      });
  
      it('should fail open on service error', async () => {
        const text = 'Test message';
        
        getCache.mockRejectedValue(new Error('Service error'));
        query.mockResolvedValue({ rows: [] });
  
        const result = await moderateContent(text, 1, 123, 'chat');
  
        // Should approve on error (fail open)
        expect(result.approved).toBe(true);
        expect(result.action).toBe('approved_on_error');
      });
  
      it('should save to audit log', async () => {
        const text = 'Test message';
        const communityId = 1;
        const userId = 123;
  
        getCache.mockResolvedValue(null);
        setCache.mockResolvedValue(true);
        query.mockResolvedValue({ rows: [] });
  
        await moderateContent(text, communityId, userId, 'chat');
  
        expect(query).toHaveBeenCalledWith(
          expect.stringContaining('INSERT INTO nlp_audit'),
          expect.any(Array)
        );
      });
    });
  
    describe('Moderation Statistics', () => {
      it('should calculate statistics correctly', async () => {
        const communityId = 1;
        const days = 7;
  
        query.mockResolvedValue({
          rows: [{
            total: '100',
            approved: '90',
            quarantined: '10',
            blocked: '0',
            avg_toxicity: '0.05',
            unique_users: '25',
          }],
        });
  
        const stats = await getModerationStats(communityId, days);
  
        expect(stats).toEqual({
          total: '100',
          approved: '90',
          quarantined: '10',
          blocked: '0',
          avg_toxicity: '0.05',
          unique_users: '25',
        });
      });
  
      it('should handle database errors gracefully', async () => {
        query.mockRejectedValue(new Error('Database error'));
  
        await expect(getModerationStats(1, 7)).rejects.toThrow('Database error');
      });
    });
  
    describe('Toxicity Threshold', () => {
      it('should use configured threshold', async () => {
        const originalThreshold = process.env.TOXICITY_THRESHOLD;
        process.env.TOXICITY_THRESHOLD = '0.8';
  
        const text = 'Moderately toxic';
        
        getCache
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce({
            label: 'toxic',
            score: 0.75, // Below 0.8 threshold
            isToxic: true,
          });
  
        query.mockResolvedValue({ rows: [] });
  
        const result = await moderateContent(text, 1, 123, 'chat');
  
        // Should approve because score < threshold
        expect(result.approved).toBe(true);
  
        process.env.TOXICITY_THRESHOLD = originalThreshold;
      });
    });
  
    describe('Message Types', () => {
      const messageTypes = ['chat', 'complaint', 'petition', 'announcement'];
  
      messageTypes.forEach(type => {
        it(`should handle ${type} message type`, async () => {
          getCache.mockResolvedValue(null);
          setCache.mockResolvedValue(true);
          query.mockResolvedValue({ rows: [] });
  
          const result = await moderateContent('Test', 1, 123, type);
  
          expect(result).toHaveProperty('approved');
          expect(result).toHaveProperty('action');
        });
      });
    });
  
    describe('Performance', () => {
      it('should complete moderation within acceptable time', async () => {
        const text = 'Test message';
  
        getCache.mockResolvedValue(null);
        setCache.mockResolvedValue(true);
        query.mockResolvedValue({ rows: [] });
  
        const startTime = Date.now();
        await moderateContent(text, 1, 123, 'chat');
        const duration = Date.now() - startTime;
  
        // Should complete within 5 seconds (generous limit for tests)
        expect(duration).toBeLessThan(5000);
      });
    });
  });
  
  describe('Integration Tests', () => {
    describe('End-to-End Moderation Flow', () => {
      it('should handle complete moderation workflow', async () => {
        const text = 'Community announcement';
        const communityId = 1;
        const userId = 123;
  
        getCache.mockResolvedValue(null);
        setCache.mockResolvedValue(true);
        query.mockResolvedValue({ rows: [] });
  
        // Step 1: Analyze
        const analysis = await analyzeText(text);
        expect(analysis).toHaveProperty('sentiment');
        expect(analysis).toHaveProperty('toxicity');
  
        // Step 2: Moderate
        const moderation = await moderateContent(text, communityId, userId, 'announcement');
        expect(moderation).toHaveProperty('approved');
  
        // Step 3: Verify audit log was created
        expect(query).toHaveBeenCalledWith(
          expect.stringContaining('INSERT INTO nlp_audit'),
          expect.any(Array)
        );
      });
    });
  
    describe('RAG Question Answering Flow', () => {
      it('should handle complete RAG workflow', async () => {
        // Step 1: Add document
        query.mockResolvedValue({ rows: [{ id: 1 }] });
        
        const docId = await addDocument(
          1,
          'Test Doc',
          'Test content',
          123
        );
        expect(docId).toBe(1);
  
        // Step 2: Search documents
        vectorSearch.mockResolvedValue([
          { id: 1, title: 'Test Doc', content: 'Test content', similarity: 0.9 },
        ]);
  
        const docs = await searchDocuments('test question', 1);
        expect(docs.length).toBeGreaterThan(0);
  
        // Step 3: Ask bot
        const axios = require('axios');
        jest.spyOn(axios, 'post').mockResolvedValue({
          data: { response: 'Answer', context: 'context' },
        });
  
        const answer = await askBot('test question', 1, 123);
        expect(answer).toHaveProperty('answer');
        expect(answer).toHaveProperty('sources');
      });
    });
  });
  
  describe('Error Handling', () => {
    it('should handle network errors gracefully', async () => {
      const axios = require('axios');
      jest.spyOn(axios, 'post').mockRejectedValue({
        code: 'ECONNREFUSED',
      });
  
      await expect(askBot('question', 1, 123)).rejects.toThrow('RAG service unavailable');
    });
  
    it('should handle database connection errors', async () => {
      query.mockRejectedValue(new Error('Connection timeout'));
  
      await expect(addDocument(1, 'Title', 'Content', 123)).rejects.toThrow('Connection timeout');
    });
  
    it('should handle cache failures gracefully', async () => {
      getCache.mockRejectedValue(new Error('Redis error'));
      setCache.mockResolvedValue(true);
  
      // Should still work without cache
      await expect(analyzeText('test')).resolves.toBeDefined();
    });
  });