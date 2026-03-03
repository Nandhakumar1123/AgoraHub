const express = require('express');
const router = express.Router();
const { 
  reviewQuarantinedContent,
  getQuarantinedContent,
} = require('../services/moderation.service');
const { verifyToken, requireRole, verifyCommunityAccess } = require('../middleware/auth');
const { ipRateLimit, endpointRateLimit } = require('../middleware/rate-limit');
const { body, validationResult } = require('express-validator');
const { logger, logRequest } = require('../config/logger');

/**
 * GET /api/admin/quarantine/:community_id
 * Get quarantined content for review
 */
router.get(
  '/quarantine/:community_id',
  verifyToken,
  requireRole('admin', 'moderator'),
  endpointRateLimit(30, 60),
  async (req, res) => {
    try {
      const { community_id } = req.params;
      const status = req.query.status || 'pending';
      const limit = parseInt(req.query.limit) || 50;
      
      const content = await getQuarantinedContent(community_id, status, limit);
      
      res.json({
        success: true,
        data: {
          communityId: community_id,
          status,
          items: content,
          count: content.length,
        },
      });
      
    } catch (error) {
      logger.error('Get quarantine endpoint error', { error: error.message });
      
      res.status(500).json({
        success: false,
        error: 'Failed to fetch quarantined content',
      });
    }
  }
);

/**
 * POST /api/admin/quarantine/:hold_id/review
 * Review and decide on quarantined content
 */
router.post(
  '/quarantine/:hold_id/review',
  verifyToken,
  requireRole('admin', 'moderator'),
  ipRateLimit,
  [
    body('decision')
      .isIn(['approved', 'rejected', 'deleted'])
      .withMessage('Invalid decision'),
    body('notes')
      .optional()
      .isString()
      .isLength({ max: 500 })
      .withMessage('Notes must not exceed 500 characters'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Invalid input',
        details: errors.array(),
      });
    }
    
    const startTime = Date.now();
    
    try {
      const { hold_id } = req.params;
      const { decision, notes } = req.body;
      const adminId = req.user.id;
      
      const result = await reviewQuarantinedContent(hold_id, adminId, decision, notes);
      
      const duration = Date.now() - startTime;
      logRequest(req, { duration, decision });
      
      logger.info('Quarantine reviewed', {
        holdId: hold_id,
        adminId,
        decision,
      });
      
      res.json({
        success: true,
        data: result,
        metadata: {
          processingTime: duration,
        },
      });
      
    } catch (error) {
      logger.error('Quarantine review endpoint error', { 
        error: error.message,
        adminId: req.user.id,
      });
      
      res.status(500).json({
        success: false,
        error: 'Failed to review content',
        code: 'REVIEW_ERROR',
      });
    }
  }
);

/**
 * GET /api/admin/cache/stats
 * Get cache statistics (admin only)
 */
router.get(
  '/cache/stats',
  verifyToken,
  requireRole('admin'),
  async (req, res) => {
    try {
      const { getCacheStats } = require('../config/redis');
      const stats = getCacheStats();
      
      res.json({
        success: true,
        data: {
          cacheStats: stats,
          target: '85% hit rate',
        },
      });
      
    } catch (error) {
      logger.error('Cache stats endpoint error', { error: error.message });
      
      res.status(500).json({
        success: false,
        error: 'Failed to fetch cache stats',
      });
    }
  }
);

module.exports = router;