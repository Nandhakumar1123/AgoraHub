const { body, param, validationResult } = require('express-validator');
const { logger } = require('../config/logger');

const MAX_TEXT_LENGTH = parseInt(process.env.MAX_TEXT_LENGTH) || 5000;

/**
 * Sanitize text input - remove potential XSS and SQL injection
 */
const sanitizeText = (text) => {
  if (!text || typeof text !== 'string') {
    return '';
  }
  
  // Remove control characters
  let sanitized = text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  
  // Remove HTML tags (basic XSS protection)
  sanitized = sanitized.replace(/<[^>]*>/g, '');
  
  // Remove SQL comment patterns
  sanitized = sanitized.replace(/--/g, '');
  sanitized = sanitized.replace(/\/\*/g, '');
  sanitized = sanitized.replace(/\*\//g, '');
  
  // Trim whitespace
  sanitized = sanitized.trim();
  
  return sanitized;
};

/**
 * Redact PII (Personal Identifiable Information)
 */
const redactPII = (text) => {
  if (!text) return text;
  
  let redacted = text;
  
  // Email addresses
  redacted = redacted.replace(
    /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
    '[EMAIL_REDACTED]'
  );
  
  // Phone numbers (Indian format)
  redacted = redacted.replace(
    /(\+91[\s-]?)?[6-9]\d{9}\b/g,
    '[PHONE_REDACTED]'
  );
  
  // Aadhar numbers (12 digits)
  redacted = redacted.replace(
    /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g,
    '[AADHAR_REDACTED]'
  );
  
  // Credit card numbers (basic pattern)
  redacted = redacted.replace(
    /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g,
    '[CARD_REDACTED]'
  );
  
  return redacted;
};

/**
 * Input validation middleware
 */
const validateInput = (req, res, next) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    logger.warn('Input validation failed', {
      errors: errors.array(),
      path: req.path,
      userId: req.user?.id,
    });
    
    return res.status(400).json({
      error: 'Invalid input',
      code: 'VALIDATION_ERROR',
      details: errors.array(),
    });
  }
  
  next();
};

/**
 * Validation rules for NLP analyze endpoint
 */
const analyzeValidation = [
  body('text')
    .trim()
    .notEmpty().withMessage('Text is required')
    .isLength({ max: MAX_TEXT_LENGTH })
    .withMessage(`Text must not exceed ${MAX_TEXT_LENGTH} characters`)
    .customSanitizer(sanitizeText),
  
  body('community_id')
    .isInt({ min: 1 }).withMessage('Valid community_id is required')
    .toInt(),
  
  validateInput,
];

/**
 * Validation rules for moderation endpoint
 */
const moderateValidation = [
  body('text')
    .trim()
    .notEmpty().withMessage('Text is required')
    .isLength({ max: MAX_TEXT_LENGTH })
    .withMessage(`Text must not exceed ${MAX_TEXT_LENGTH} characters`)
    .customSanitizer(sanitizeText),
  
  body('community_id')
    .isInt({ min: 1 }).withMessage('Valid community_id is required')
    .toInt(),
  
  body('message_type')
    .isIn(['chat', 'complaint', 'petition', 'announcement'])
    .withMessage('Invalid message type'),
  
  validateInput,
];

/**
 * Validation rules for bot ask endpoint
 */
const botAskValidation = [
  body('question')
    .trim()
    .notEmpty().withMessage('Question is required')
    .isLength({ min: 3, max: 500 })
    .withMessage('Question must be between 3 and 500 characters')
    .customSanitizer(sanitizeText),
  
  body('community_id')
    .isInt({ min: 1 }).withMessage('Valid community_id is required')
    .toInt(),
  
  body('context')
    .optional()
    .isString()
    .isLength({ max: 2000 })
    .withMessage('Context must not exceed 2000 characters')
    .customSanitizer(sanitizeText),

  body('item_context')
    .optional()
    .custom((v) => {
      if (!v || typeof v !== 'object') return true;
      const type = v.type;
      const data = v.data;
      if (type && !['petition', 'complaint'].includes(type)) return false;
      if (data && typeof data !== 'object') return false;
      // Prevent huge payloads
      const size = JSON.stringify(v).length;
      return size <= 12000;
    })
    .withMessage('Invalid item_context'),
  
  validateInput,
];

/**
 * Validation rules for document upload endpoint
 */
const docUploadValidation = [
  body('community_id')
    .isInt({ min: 1 }).withMessage('Valid community_id is required')
    .toInt(),
  
  body('title')
    .trim()
    .notEmpty().withMessage('Title is required')
    .isLength({ max: 200 })
    .withMessage('Title must not exceed 200 characters')
    .customSanitizer(sanitizeText),
  
  body('content')
    .trim()
    .notEmpty().withMessage('Content is required')
    .isLength({ max: 50000 })
    .withMessage('Content must not exceed 50000 characters')
    .customSanitizer(sanitizeText),
  
  validateInput,
];

/**
 * Sanitize all request body text fields
 */
const sanitizeRequestBody = (req, res, next) => {
  if (req.body && typeof req.body === 'object') {
    Object.keys(req.body).forEach(key => {
      if (typeof req.body[key] === 'string') {
        req.body[key] = sanitizeText(req.body[key]);
      }
    });
  }
  next();
};

/**
 * Check for malicious patterns
 */
const checkMaliciousPatterns = (req, res, next) => {
  const text = req.body.text || req.body.question || req.body.content || '';
  
  const maliciousPatterns = [
    /(<script|javascript:|onerror=|onclick=)/i,
    /(union\s+select|drop\s+table|delete\s+from)/i,
    /(\.\.\/|\.\.\\)/g, // Path traversal
    /(\${|`)/g, // Template injection
  ];
  
  for (const pattern of maliciousPatterns) {
    if (pattern.test(text)) {
      logger.warn('Malicious pattern detected', {
        pattern: pattern.toString(),
        userId: req.user?.id,
        ip: req.ip,
      });
      
      return res.status(400).json({
        error: 'Invalid input detected',
        code: 'MALICIOUS_PATTERN',
      });
    }
  }
  
  next();
};

module.exports = {
  sanitizeText,
  redactPII,
  sanitizeRequestBody,
  checkMaliciousPatterns,
  analyzeValidation,
  moderateValidation,
  botAskValidation,
  docUploadValidation,
};