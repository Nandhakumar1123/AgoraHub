const { analyzeText } = require('./nlp.service');
const { query, transaction } = require('../config/database');
const { logger, logAudit } = require('../config/logger');
const { redactPII } = require('../middleware/sanitize');
const crypto = require('crypto');

const TOXICITY_THRESHOLD = parseFloat(process.env.TOXICITY_THRESHOLD) || 0.7;
const QUARANTINE_DURATION_HOURS = parseInt(process.env.QUARANTINE_DURATION_HOURS) || 24;
let hasNlpAuditTable = null;

/**
 * Generate hash for text (for audit trail)
 */
function generateTextHash(text) {
  return crypto.createHash('sha256').update(text).digest('hex');
}

async function checkNlpAuditTable() {
  if (hasNlpAuditTable !== null) return hasNlpAuditTable;
  const result = await query('SELECT to_regclass($1) AS reg', ['public.nlp_audit']);
  hasNlpAuditTable = !!(result.rows && result.rows[0] && result.rows[0].reg);
  return hasNlpAuditTable;
}

/**
 * Save to audit log (immutable compliance record)
 */
async function saveAuditLog(userId, communityId, text, analysis, action, metadata = {}) {
  try {
    const auditTableExists = await checkNlpAuditTable();
    if (!auditTableExists) {
      logger.warn('nlp_audit table missing; skipping audit DB insert');
      return;
    }

    const textHash = generateTextHash(text);
    const redactedText = redactPII(text);
    
    await query(
      `INSERT INTO nlp_audit 
       (user_id, community_id, text_hash, raw_text, sentiment, toxicity, action, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
      [
        userId,
        communityId,
        textHash,
        redactedText,
        JSON.stringify(analysis.sentiment),
        JSON.stringify(analysis.toxicity),
        action,
      ]
    );
    
    // Also log to audit file
    logAudit({
      userId,
      communityId,
      textHash,
      action,
      sentiment: analysis.sentiment.label,
      toxicity: analysis.toxicity.label,
      toxicityScore: analysis.toxicity.score,
      ...metadata,
    });
    
  } catch (error) {
    logger.error('Audit log save error', { error: error.message });
    // Don't throw - audit failure shouldn't block moderation
  }
}

/**
 * Moderate content in real-time
 */
async function moderateContent(text, communityId, userId, messageType = 'chat') {
  const startTime = Date.now();
  
  try {
    // Run NLP analysis
    const analysis = await analyzeText(text);
    
    let action = 'approved';
    let approved = true;
    let reason = null;
    let holdId = null;
    
    // Check toxicity threshold
    if (analysis.toxicity.isToxic && analysis.toxicity.score >= TOXICITY_THRESHOLD) {
      action = 'quarantined';
      approved = false;
      reason = `Content flagged as toxic (confidence: ${(analysis.toxicity.score * 100).toFixed(1)}%)`;
      
      // Create quarantine record
      const quarantineResult = await query(
        `INSERT INTO content_quarantine 
         (user_id, community_id, content, message_type, toxicity_score, 
          expires_at, created_at)
         VALUES ($1, $2, $3, $4, $5, NOW() + INTERVAL '${QUARANTINE_DURATION_HOURS} hours', NOW())
         RETURNING id`,
        [userId, communityId, text, messageType, analysis.toxicity.score]
      );
      
      holdId = quarantineResult.rows[0].id;
      
      logger.warn('Content quarantined', {
        userId,
        communityId,
        messageType,
        toxicityScore: analysis.toxicity.score,
        holdId,
      });
    }
    
    // Save to audit log
    await saveAuditLog(userId, communityId, text, analysis, action, {
      messageType,
      holdId,
    });
    
    const duration = Date.now() - startTime;
    
    logger.info('Content moderation completed', {
      userId,
      communityId,
      action,
      duration: `${duration}ms`,
    });
    
    return {
      approved,
      action,
      reason,
      holdId,
      analysis: {
        sentiment: analysis.sentiment,
        toxicity: {
          label: analysis.toxicity.label,
          score: analysis.toxicity.score,
        },
        language: analysis.language,
      },
      processingTime: duration,
    };
  } catch (error) {
    logger.error('Content moderation error', { error: error.message });
    
    // Fail open with logging
    await saveAuditLog(userId, communityId, text, { 
      sentiment: { label: 'unknown', score: 0 },
      toxicity: { label: 'unknown', score: 0 },
    }, 'error', { error: error.message });
    
    return {
      approved: true, // Fail open
      action: 'approved_on_error',
      reason: 'Moderation service error',
      error: error.message,
    };
  }
}

/**
 * Review quarantined content (admin action)
 */
async function reviewQuarantinedContent(holdId, adminId, decision, notes = '') {
  try {
    return await transaction(async (client) => {
      // Get quarantine record
      const quarantineResult = await client.query(
        'SELECT * FROM content_quarantine WHERE id = $1',
        [holdId]
      );
      
      if (quarantineResult.rows.length === 0) {
        throw new Error('Quarantine record not found');
      }
      
      const record = quarantineResult.rows[0];
      
      // Update quarantine status
      await client.query(
        `UPDATE content_quarantine 
         SET status = $1, reviewed_by = $2, reviewed_at = NOW(), 
             review_notes = $3
         WHERE id = $4`,
        [decision, adminId, notes, holdId]
      );
      
      // Log admin action
      logAudit({
        action: 'quarantine_review',
        holdId,
        adminId,
        decision,
        userId: record.user_id,
        communityId: record.community_id,
      });
      
      logger.info('Quarantine review completed', {
        holdId,
        adminId,
        decision,
      });
      
      return {
        success: true,
        holdId,
        decision,
        originalContent: record.content,
      };
    });
  } catch (error) {
    logger.error('Quarantine review error', { error: error.message });
    throw error;
  }
}

/**
 * Get quarantined content for review
 */
async function getQuarantinedContent(communityId, status = 'pending', limit = 50) {
  try {
    const result = await query(
      `SELECT id, user_id, content, message_type, toxicity_score, 
              created_at, expires_at
       FROM content_quarantine
       WHERE community_id = $1 AND status = $2 
             AND expires_at > NOW()
       ORDER BY created_at DESC
       LIMIT $3`,
      [communityId, status, limit]
    );
    
    return result.rows;
  } catch (error) {
    logger.error('Get quarantined content error', { error: error.message });
    throw error;
  }
}

/**
 * Get moderation statistics
 */
async function getModerationStats(communityId, days = 7) {
  try {
    const auditTableExists = await checkNlpAuditTable();
    if (!auditTableExists) {
      return {
        total: '0',
        approved: '0',
        quarantined: '0',
        blocked: '0',
        avg_toxicity: null,
        unique_users: '0',
      };
    }

    const result = await query(
      `SELECT 
         COUNT(*) as total,
         COUNT(*) FILTER (WHERE action = 'approved') as approved,
         COUNT(*) FILTER (WHERE action = 'quarantined') as quarantined,
         COUNT(*) FILTER (WHERE action = 'blocked') as blocked,
         AVG((toxicity->>'score')::float) as avg_toxicity,
         COUNT(DISTINCT user_id) as unique_users
       FROM nlp_audit
       WHERE community_id = $1 
             AND created_at > NOW() - INTERVAL '${days} days'`,
      [communityId]
    );
    
    return result.rows[0];
  } catch (error) {
    if (error && error.code === '42P01' && String(error.message || '').includes('"nlp_audit"')) {
      logger.warn('nlp_audit table missing; returning default moderation stats');
      return {
        total: '0',
        approved: '0',
        quarantined: '0',
        blocked: '0',
        avg_toxicity: null,
        unique_users: '0',
      };
    }
    logger.error('Moderation stats error', { error: error.message });
    throw error;
  }
}

/**
 * Get user moderation history
 */
async function getUserModerationHistory(userId, communityId, limit = 20) {
  try {
    const result = await query(
      `SELECT action, sentiment, toxicity, created_at
       FROM nlp_audit
       WHERE user_id = $1 AND community_id = $2
       ORDER BY created_at DESC
       LIMIT $3`,
      [userId, communityId, limit]
    );
    
    return result.rows;
  } catch (error) {
    logger.error('User moderation history error', { error: error.message });
    throw error;
  }
}

/**
 * Batch moderate multiple texts (for bulk processing)
 */
async function batchModerate(texts, communityId, userId) {
  const startTime = Date.now();
  
  try {
    const results = await Promise.all(
      texts.map(text => moderateContent(text, communityId, userId))
    );
    
    const duration = Date.now() - startTime;
    
    logger.info('Batch moderation completed', {
      count: texts.length,
      duration: `${duration}ms`,
      avgPerText: `${(duration / texts.length).toFixed(0)}ms`,
    });
    
    return results;
  } catch (error) {
    logger.error('Batch moderation error', { error: error.message });
    throw error;
  }
}

module.exports = {
  moderateContent,
  reviewQuarantinedContent,
  getQuarantinedContent,
  getModerationStats,
  getUserModerationHistory,
  batchModerate,
};
