const jwt = require('jsonwebtoken');
const { logger } = require('../config/logger');

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET || JWT_SECRET.length < 32) {
  throw new Error('JWT_SECRET must be at least 32 characters long');
}

/**
 * Verify JWT token middleware
 */
const verifyToken = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({
        error: 'No authorization token provided',
        code: 'NO_TOKEN',
      });
    }

    const token = authHeader.startsWith('Bearer ')
      ? authHeader.substring(7)
      : authHeader;

    const decoded = jwt.verify(token, JWT_SECRET);
    const userId = decoded.user_id ?? decoded.userId ?? decoded.id;

    req.user = {
      id: userId,
      user_id: userId,
      communityId: decoded.communityId,
      role: decoded.role,
    };

    next();
  } catch (error) {
    logger.warn('JWT verification failed', { error: error.message });

    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        error: 'Token expired',
        code: 'TOKEN_EXPIRED',
      });
    }

    return res.status(401).json({
      error: 'Invalid token',
      code: 'INVALID_TOKEN',
    });
  }
};

/**
 * Optional auth - continues even if token is invalid
 */
const optionalAuth = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (authHeader) {
      const token = authHeader.startsWith('Bearer ')
        ? authHeader.substring(7)
        : authHeader;

      const decoded = jwt.verify(token, JWT_SECRET);
      const userId = decoded.user_id ?? decoded.userId ?? decoded.id;
      req.user = {
        id: userId,
        user_id: userId,
        communityId: decoded.communityId,
        role: decoded.role,
      };
    }
  } catch (error) {
    // Continue without user context
    logger.debug('Optional auth failed, continuing without user', {
      error: error.message,
    });
  }

  next();
};

/**
 * Role-based authorization
 */
const requireRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Authentication required',
        code: 'AUTH_REQUIRED',
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      logger.warn('Unauthorized role access attempt', {
        userId: req.user.id,
        userRole: req.user.role,
        requiredRoles: allowedRoles,
      });

      return res.status(403).json({
        error: 'Insufficient permissions',
        code: 'FORBIDDEN',
      });
    }

    next();
  };
};

/**
 * Community access verification
 */
const verifyCommunityAccess = async (req, res, next) => {
  try {
    const communityId = req.body.community_id || req.params.community_id || req.query.community_id;

    if (!communityId) {
      return res.status(400).json({
        error: 'Community ID required',
        code: 'MISSING_COMMUNITY_ID',
      });
    }

    // If user has a community ID in token, verify it matches
    if (req.user.communityId && req.user.communityId !== parseInt(communityId)) {
      logger.warn('Community access denied', {
        userId: req.user.id,
        requestedCommunity: communityId,
        userCommunity: req.user.communityId,
      });

      return res.status(403).json({
        error: 'Access denied to this community',
        code: 'COMMUNITY_ACCESS_DENIED',
      });
    }

    next();
  } catch (error) {
    logger.error('Community verification error', { error: error.message });
    res.status(500).json({ error: 'Server error' });
  }
};

// Alias for server.js compatibility
const authenticateToken = verifyToken;

module.exports = {
  authenticateToken,
  verifyToken,
  optionalAuth,
  requireRole,
  verifyCommunityAccess,
};