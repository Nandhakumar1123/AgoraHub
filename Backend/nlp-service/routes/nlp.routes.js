const express = require('express');
const router = express.Router();
const { analyzeText, getModelStatus } = require('../services/nlp.service');
const { moderateContent, getModerationStats, getUserModerationHistory } = require('../services/moderation.service');
const { verifyToken, verifyCommunityAccess } = require('../middleware/auth');
const { ipRateLimit, userDailyLimit, endpointRateLimit } = require('../middleware/rate-limit');
const { 
  analyzeValidation, 
  moderateValidation, 
  checkMaliciousPatterns 
} = require('../middleware/sanitize');
const { logger, logRequest } = require('../config/logger');

/**
 * POST /api/nlp/analyze
 * Analyze text for sentiment and toxicity
 */
router.post(
  '/analyze',
  ipRateLimit,
  verifyToken,
  userDailyLimit,
  verifyCommunityAccess,
  analyzeValidation,
  checkMaliciousPatterns,
  async (req, res) => {
    const startTime = Date.now();
    
    try {
      const { text, community_id } = req.body;
      
      // Perform NLP analysis
      const result = await analyzeText(text);
      
      const duration = Date.now() - startTime;
      logRequest(req, { duration });
      
      res.json({
        success: true,
        data: {
          sentiment: {
            label: result.sentiment.label,
            score: result.sentiment.score,
          },
          toxicity: {
            label: result.toxicity.label,
            score: result.toxicity.score,
          },
          safe: result.safe,
          language: result.language,
        },
        metadata: {
          processingTime: duration,
          textLength: text.length,
        },
      });
      
    } catch (error) {
      logger.error('Analyze endpoint error', { 
        error: error.message,
        userId: req.user.id,
      });
      
      res.status(500).json({
        success: false,
        error: 'Analysis failed',
        code: 'ANALYSIS_ERROR',
      });
    }
  }
);

/**
 * POST /api/nlp/moderate
 * Real-time content moderation
 */
router.post(
  '/moderate',
  ipRateLimit,
  verifyToken,
  userDailyLimit,
  verifyCommunityAccess,
  moderateValidation,
  checkMaliciousPatterns,
  async (req, res) => {
    const startTime = Date.now();
    
    try {
      const { text, community_id, message_type } = req.body;
      const userId = req.user.id;
      
      // Perform moderation
      const result = await moderateContent(text, community_id, userId, message_type);
      
      const duration = Date.now() - startTime;
      logRequest(req, { duration, action: result.action });
      
      res.json({
        success: true,
        data: {
          approved: result.approved,
          action: result.action,
          reason: result.reason,
          holdId: result.holdId,
          analysis: result.analysis,
        },
        metadata: {
          processingTime: duration,
        },
      });
      
    } catch (error) {
      logger.error('Moderate endpoint error', { 
        error: error.message,
        userId: req.user.id,
      });
      
      res.status(500).json({
        success: false,
        error: 'Moderation failed',
        code: 'MODERATION_ERROR',
      });
    }
  }
);

/**
 * GET /api/nlp/stats/:community_id
 * Get moderation statistics for community
 */
router.get(
  '/stats/:community_id',
  verifyToken,
  endpointRateLimit(20, 60),
  async (req, res) => {
    try {
      const { community_id } = req.params;
      const days = parseInt(req.query.days) || 7;
      
      const stats = await getModerationStats(community_id, days);
      
      res.json({
        success: true,
        data: {
          period: `${days} days`,
          statistics: {
            total: parseInt(stats.total),
            approved: parseInt(stats.approved),
            quarantined: parseInt(stats.quarantined),
            blocked: parseInt(stats.blocked),
            averageToxicity: parseFloat(stats.avg_toxicity || 0).toFixed(3),
            uniqueUsers: parseInt(stats.unique_users),
          },
        },
      });
      
    } catch (error) {
      logger.error('Stats endpoint error', { error: error.message });
      
      res.status(500).json({
        success: false,
        error: 'Failed to fetch statistics',
      });
    }
  }
);

/**
 * GET /api/nlp/history
 * Get moderation history for current user
 */
router.get(
  '/history',
  verifyToken,
  endpointRateLimit(10, 60),
  async (req, res) => {
    try {
      const userId = req.user.id;
      const communityId = req.query.community_id;
      const limit = parseInt(req.query.limit) || 20;
      
      if (!communityId) {
        return res.status(400).json({
          success: false,
          error: 'community_id is required',
        });
      }
      
      const history = await getUserModerationHistory(userId, communityId, limit);
      
      res.json({
        success: true,
        data: {
          userId,
          communityId,
          history,
        },
      });
      
    } catch (error) {
      logger.error('History endpoint error', { error: error.message });
      
      res.status(500).json({
        success: false,
        error: 'Failed to fetch history',
      });
    }
  }
);

/**
 * GET /api/nlp/health
 * Health check and model status
 */
router.get('/health', (req, res) => {
  const status = getModelStatus();
  
  res.json({
    success: true,
    status: 'healthy',
    models: status,
    uptime: process.uptime(),
    memory: {
      used: Math.round(status.memoryUsage.heapUsed / 1024 / 1024),
      total: Math.round(status.memoryUsage.heapTotal / 1024 / 1024),
      unit: 'MB',
    },
  });
});

module.exports = router;