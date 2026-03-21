const express = require('express');
const router = express.Router();
const { Pool } = require('pg');
const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'db_mini',
  password: process.env.DB_PASSWORD || 'nandha102',
  port: parseInt(process.env.DB_PORT) || 5432,
});
const {
  summarizeFromComplaints,
  summarizeFromPetitions,
  suggestAction,
  askBot,
  continueConversation,
  addDocument,
  getDocumentCount,
  deleteDocument,
  checkOllamaHealth,
  getBotHistory,
  updateBotHistoryEntry,
  deleteBotHistoryEntry,
  clearBotHistory,
} = require('../services/rag.service');
const { verifyToken, verifyCommunityAccess, requireRole } = require('../middleware/auth');
const { ipRateLimit, endpointRateLimit } = require('../middleware/rate-limit');
const { botAskValidation, docUploadValidation, checkMaliciousPatterns } = require('../middleware/sanitize');
const { logger, logRequest } = require('../config/logger');

// Helper: Save full AI chat details to dedicated bot history table
// Saves: question, AI answer, confidence, source_count, status, error_message
// NEVER writes to complaints or petitions tables
async function saveToBotHistoryTable(tableName, { userId, communityId, question, answer, confidence, sourceCount, status, errorMessage }) {
  try {
    const result = await pool.query(
      `INSERT INTO ${tableName} 
        (user_id, community_id, question, answer, confidence, source_count, status, error_message, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
       RETURNING id`,
      [
        userId || null,
        communityId,
        question,
        answer || '',
        confidence || null,
        sourceCount || null,
        status || 'answered',
        errorMessage || null,
      ]
    );
    return result.rows[0]?.id;
  } catch (err) {
    logger.warn('Failed to save bot history', { table: tableName, error: err.message });
    return null;
  }
}


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
          historyId: result.historyId,
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
 * GET /api/bot/ask/complaints/history
 * Get user's AI chat history for community complaints
 */
router.get(
  '/ask/complaints/history',
  verifyToken,
  verifyCommunityAccess,
  async (req, res) => {
    try {
      const { community_id } = req.query;
      const userId = getRequestUserId(req);

      if (!community_id) {
        return res.status(400).json({ success: false, error: 'community_id is required' });
      }

      const history = await pool.query(
        `SELECT id, question, answer, confidence, source_count, status, created_at 
         FROM complaint_bot_history 
         WHERE user_id = $1 AND community_id = $2 
         ORDER BY created_at ASC 
         LIMIT 50`,
        [userId, community_id]
      );

      res.json({ success: true, data: history.rows });
    } catch (error) {
      logger.error('Fetch complaints bot history error', { error: error.message });
      res.status(500).json({ success: false, error: 'Failed to fetch history' });
    }
  }
);

/**
 * POST /api/bot/ask/complaints
 * Get AI summary of community complaints
 */
router.post(
  '/ask/complaints',
  ipRateLimit,
  verifyToken,
  verifyCommunityAccess,  // Any authenticated community member can ask
  endpointRateLimit(10, 60),
  async (req, res) => {
    const startTime = Date.now();
    try {
      const { question, community_id } = req.body;
      const userId = getRequestUserId(req);

      if (!question || !community_id) {
        return res.status(400).json({ success: false, error: 'question and community_id are required' });
      }

      const result = await summarizeFromComplaints(question, community_id);

      const historyId = await saveToBotHistoryTable('complaint_bot_history', {
        userId,
        communityId: community_id,
        question,
        answer: result.answer,
        confidence: result.confidence,
        sourceCount: result.sourceCount,
        status: result.status,
        errorMessage: null,
      });

      const duration = Date.now() - startTime;
      res.json({
        success: true,
        data: {
          ...result,
          historyId,
        },
        metadata: { processingTime: duration },
      });
    } catch (error) {
      logger.error('Bot ask complaints error', { error: error.message });
      res.status(500).json({ success: false, error: error.message || 'Failed to process complaints question' });
    }
  }
);

/**
 * GET /api/bot/ask/petitions/history
 * Get user's AI chat history for community petitions
 */
router.get(
  '/ask/petitions/history',
  verifyToken,
  verifyCommunityAccess,
  async (req, res) => {
    try {
      const { community_id } = req.query;
      const userId = getRequestUserId(req);

      if (!community_id) {
        return res.status(400).json({ success: false, error: 'community_id is required' });
      }

      const history = await pool.query(
        `SELECT id, question, answer, confidence, source_count, status, created_at 
         FROM petition_bot_history 
         WHERE user_id = $1 AND community_id = $2 
         ORDER BY created_at ASC 
         LIMIT 50`,
        [userId, community_id]
      );

      res.json({ success: true, data: history.rows });
    } catch (error) {
      logger.error('Fetch petitions bot history error', { error: error.message });
      res.status(500).json({ success: false, error: 'Failed to fetch history' });
    }
  }
);

/**
 * POST /api/bot/ask/petitions
 * Get AI summary of community petitions
 */
router.post(
  '/ask/petitions',
  ipRateLimit,
  verifyToken,
  verifyCommunityAccess,  // Any authenticated community member can ask
  endpointRateLimit(10, 60),
  async (req, res) => {
    const startTime = Date.now();
    try {
      const { question, community_id } = req.body;
      const userId = getRequestUserId(req);

      if (!question || !community_id) {
        return res.status(400).json({ success: false, error: 'question and community_id are required' });
      }

      const result = await summarizeFromPetitions(question, community_id);

      const historyId = await saveToBotHistoryTable('petition_bot_history', {
        userId,
        communityId: community_id,
        question,
        answer: result.answer,
        confidence: result.confidence,
        sourceCount: result.sourceCount,
        status: result.status,
        errorMessage: null,
      });

      const duration = Date.now() - startTime;
      res.json({
        success: true,
        data: {
          ...result,
          historyId,
        },
        metadata: { processingTime: duration },
      });
    } catch (error) {
      logger.error('Bot ask petitions error', { error: error.message });
      res.status(500).json({ success: false, error: error.message || 'Failed to process petitions question' });
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
      const type = req.query.type || 'chat';
      const userId = getRequestUserId(req);
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'Invalid user token',
          code: 'INVALID_USER_TOKEN',
        });
      }
      const history = await getBotHistory(community_id, userId, limit, type);

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
 * PUT /api/bot/history/:community_id/:history_id
 * Update a specific AI chat history item (question)
 */
router.put(
  '/history/:community_id/:history_id',
  verifyToken,
  verifyCommunityAccess,
  async (req, res) => {
    try {
      const { community_id, history_id } = req.params;
      const { question } = req.body;
      const type = req.query.type || 'chat';
      const userId = getRequestUserId(req);

      if (!userId) {
        return res.status(401).json({ success: false, error: 'Invalid user token' });
      }
      if (!question) {
        return res.status(400).json({ success: false, error: 'question is required' });
      }

      const updated = await updateBotHistoryEntry(
        Number(community_id),
        userId,
        Number(history_id),
        question,
        type
      );

      if (!updated) {
        return res.status(404).json({ success: false, error: 'History item not found or unauthorized' });
      }

      res.json({ success: true, message: 'History item updated' });
    } catch (error) {
      logger.error('Bot history update endpoint error', { error: error.message, userId: getRequestUserId(req) });
      res.status(500).json({ success: false, error: 'Failed to update bot history' });
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
      const type = req.query.type || 'chat';
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
        Number(history_id),
        type
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
      const type = req.query.type || 'chat';
      const userId = getRequestUserId(req);
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'Invalid user token',
          code: 'INVALID_USER_TOKEN',
        });
      }
      const deletedCount = await clearBotHistory(Number(community_id), userId, type);

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

/**
 * POST /api/bot/suggest-action
 * Get AI recommendation for petition or complaint status
 */
router.post(
  '/suggest-action',
  ipRateLimit,
  verifyToken,
  requireRole('HEAD', 'ADMIN'), // Only community leaders can request suggestions
  verifyCommunityAccess,
  async (req, res) => {
    try {
      const { item_id, item_type, community_id } = req.body;

      if (!item_id || !item_type || !community_id) {
        return res.status(400).json({
          success: false,
          error: 'item_id, item_type, and community_id are required',
        });
      }

      const result = await suggestAction(item_id, item_type, community_id);

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      logger.error('Bot suggest-action error', { error: error.message });
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to get AI suggestion',
      });
    }
  }
);

module.exports = router;
