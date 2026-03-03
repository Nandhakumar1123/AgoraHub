const express = require('express');
const router = express.Router();
const { 
  askBot, 
  continueConversation, 
  addDocument,
  getDocumentCount,
  deleteDocument,
  checkOllamaHealth,
  getBotHistory,
  deleteBotHistoryEntry,
  clearBotHistory,
} = require('../services/rag.service');
const { verifyToken, verifyCommunityAccess, requireRole } = require('../middleware/auth');
const { ipRateLimit, endpointRateLimit } = require('../middleware/rate-limit');
const { botAskValidation, docUploadValidation, checkMaliciousPatterns } = require('../middleware/sanitize');
const { logger, logRequest } = require('../config/logger');

function getRequestUserId(req) {
  const raw = req?.user?.id ?? req?.user?.user_id;
  const userId = Number(raw);
  return Number.isFinite(userId) && userId > 0 ? userId : null;
}

/**
 * POST /api/bot/ask
 * Ask the RAG chatbot a question
 */
router.post(
  '/ask',
  ipRateLimit,
  verifyToken,
  verifyCommunityAccess,
  endpointRateLimit(15, 60), // 15 requests per minute for bot
  botAskValidation,
  checkMaliciousPatterns,
  async (req, res) => {
    const startTime = Date.now();
    
    try {
      const { question, community_id, context, session_hash, item_context } = req.body;
      const userId = getRequestUserId(req);
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'Invalid user token',
          code: 'INVALID_USER_TOKEN',
        });
      }
      
      let result;
      
      // Continue existing conversation or start new one
      if (session_hash) {
        result = await continueConversation(question, session_hash, community_id, userId, item_context);
      } else {
        result = await askBot(question, community_id, userId, context, item_context);
      }
      
      const duration = Date.now() - startTime;
      logRequest(req, { duration, confidence: result.confidence });
      
      res.json({
        success: true,
        data: {
          answer: result.answer,
          sources: result.sources,
          confidence: result.confidence,
          sessionHash: result.sessionHash,
        },
        metadata: {
          processingTime: duration,
          sourcesUsed: result.sources.length,
        },
      });
      
    } catch (error) {
      logger.error('Bot ask endpoint error', { 
        error: error.message,
        userId: getRequestUserId(req),
      });
      
      if (error.message.includes('RAG service unavailable')) {
        return res.status(503).json({
          success: false,
          error: 'Bot service temporarily unavailable',
          code: 'BOT_UNAVAILABLE',
        });
      }
      
      res.status(500).json({
        success: false,
        error: 'Failed to process question',
        code: 'BOT_ERROR',
      });
    }
  }
);

/**
 * POST /api/bot/docs
 * Upload community document for RAG
 */
router.post(
  '/docs',
  ipRateLimit,
  verifyToken,
  requireRole('admin', 'manager'),
  verifyCommunityAccess,
  endpointRateLimit(10, 3600), // 10 documents per hour
  docUploadValidation,
  checkMaliciousPatterns,
  async (req, res) => {
    const startTime = Date.now();
    
    try {
      const { community_id, title, content } = req.body;
      const userId = getRequestUserId(req);
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'Invalid user token',
          code: 'INVALID_USER_TOKEN',
        });
      }
      
      // Add document to vector database
      const docId = await addDocument(community_id, title, content, userId);
      
      const duration = Date.now() - startTime;
      logRequest(req, { duration, docId });
      
      logger.info('Document uploaded', {
        docId,
        communityId: community_id,
        userId,
        title,
      });
      
      res.json({
        success: true,
        data: {
          docId,
          embeddingStatus: 'created',
          communityId: community_id,
        },
        metadata: {
          processingTime: duration,
        },
      });
      
    } catch (error) {
      logger.error('Document upload endpoint error', { 
        error: error.message,
        userId: getRequestUserId(req),
      });
      
      res.status(500).json({
        success: false,
        error: 'Failed to upload document',
        code: 'DOC_UPLOAD_ERROR',
      });
    }
  }
);

/**
 * GET /api/bot/docs/:community_id
 * Get document count for community
 */
router.get(
  '/docs/:community_id',
  verifyToken,
  verifyCommunityAccess,
  async (req, res) => {
    try {
      const { community_id } = req.params;
      
      const count = await getDocumentCount(community_id);
      
      res.json({
        success: true,
        data: {
          communityId: community_id,
          documentCount: count,
        },
      });
      
    } catch (error) {
      logger.error('Document count endpoint error', { error: error.message });
      
      res.status(500).json({
        success: false,
        error: 'Failed to fetch document count',
      });
    }
  }
);

/**
 * DELETE /api/bot/docs/:doc_id
 * Delete a community document
 */
router.delete(
  '/docs/:doc_id',
  verifyToken,
  requireRole('admin', 'manager'),
  async (req, res) => {
    try {
      const { doc_id } = req.params;
      const { community_id } = req.query;
      
      if (!community_id) {
        return res.status(400).json({
          success: false,
          error: 'community_id is required',
        });
      }
      
      const deleted = await deleteDocument(doc_id, community_id);
      
      if (!deleted) {
        return res.status(404).json({
          success: false,
          error: 'Document not found',
        });
      }
      
      logger.info('Document deleted', {
        docId: doc_id,
        communityId: community_id,
        userId: getRequestUserId(req),
      });
      
      res.json({
        success: true,
        message: 'Document deleted successfully',
      });
      
    } catch (error) {
      logger.error('Document delete endpoint error', { error: error.message });
      
      res.status(500).json({
        success: false,
        error: 'Failed to delete document',
      });
    }
  }
);

/**
 * GET /api/bot/health
 * Check bot service health (Ollama status)
 */
router.get('/health', async (req, res) => {
  try {
    const health = await checkOllamaHealth();
    
    res.json({
      success: true,
      status: health.available ? 'healthy' : 'degraded',
      ollama: {
        available: health.available,
        models: health.models || [],
        error: health.error,
      },
    });
    
  } catch (error) {
    res.status(503).json({
      success: false,
      status: 'unhealthy',
      error: error.message,
    });
  }
});

/**
 * GET /api/bot/history/:community_id
 * Get previous AI questions/replies for current user and community
 */
router.get(
  '/history/:community_id',
  verifyToken,
  verifyCommunityAccess,
  async (req, res) => {
    try {
      const { community_id } = req.params;
      const limit = req.query.limit || 50;
      const userId = getRequestUserId(req);
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'Invalid user token',
          code: 'INVALID_USER_TOKEN',
        });
      }
      const history = await getBotHistory(community_id, userId, limit);

      res.json({
        success: true,
        data: { history },
      });
    } catch (error) {
      logger.error('Bot history endpoint error', {
        error: error.message,
        userId: getRequestUserId(req),
      });
      res.status(500).json({
        success: false,
        error: 'Failed to fetch bot history',
        code: 'BOT_HISTORY_ERROR',
      });
    }
  }
);

/**
 * DELETE /api/bot/history/:community_id/:history_id
 * Delete a specific AI chat history item for current user/community
 */
router.delete(
  '/history/:community_id/:history_id',
  verifyToken,
  verifyCommunityAccess,
  async (req, res) => {
    try {
      const { community_id, history_id } = req.params;
      const userId = getRequestUserId(req);
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'Invalid user token',
          code: 'INVALID_USER_TOKEN',
        });
      }
      const removed = await deleteBotHistoryEntry(
        Number(community_id),
        userId,
        Number(history_id)
      );

      if (!removed) {
        return res.status(404).json({
          success: false,
          error: 'History item not found',
          code: 'BOT_HISTORY_NOT_FOUND',
        });
      }

      res.json({
        success: true,
        message: 'History item deleted',
      });
    } catch (error) {
      logger.error('Bot history delete endpoint error', {
        error: error.message,
        userId: getRequestUserId(req),
      });
      res.status(500).json({
        success: false,
        error: 'Failed to delete bot history',
        code: 'BOT_HISTORY_DELETE_ERROR',
      });
    }
  }
);

/**
 * DELETE /api/bot/history/:community_id
 * Clear AI chat history for current user/community
 */
router.delete(
  '/history/:community_id',
  verifyToken,
  verifyCommunityAccess,
  async (req, res) => {
    try {
      const { community_id } = req.params;
      const userId = getRequestUserId(req);
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'Invalid user token',
          code: 'INVALID_USER_TOKEN',
        });
      }
      const deletedCount = await clearBotHistory(Number(community_id), userId);

      res.json({
        success: true,
        data: { deletedCount },
      });
    } catch (error) {
      logger.error('Bot history clear endpoint error', {
        error: error.message,
        userId: getRequestUserId(req),
      });
      res.status(500).json({
        success: false,
        error: 'Failed to clear bot history',
        code: 'BOT_HISTORY_CLEAR_ERROR',
      });
    }
  }
);

module.exports = router;
