const { checkRateLimit } = require('../config/redis');
const { logger } = require('../config/logger');

const RATE_LIMIT_WINDOW_MS = parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 60000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 10;
const DAILY_LIMIT_MAX_REQUESTS = parseInt(process.env.DAILY_LIMIT_MAX_REQUESTS) || 50;

/**
 * IP-based rate limiting
 */
const ipRateLimit = async (req, res, next) => {
  try {
    const ip = req.ip || req.connection.remoteAddress;
    const windowSeconds = Math.floor(RATE_LIMIT_WINDOW_MS / 1000);
    
    const result = await checkRateLimit(
      ip,
      RATE_LIMIT_MAX_REQUESTS,
      windowSeconds,
      'ip'
    );
    
    // Set rate limit headers
    res.setHeader('X-RateLimit-Limit', result.limit);
    res.setHeader('X-RateLimit-Remaining', result.remaining);
    res.setHeader('X-RateLimit-Reset', Date.now() + RATE_LIMIT_WINDOW_MS);
    
    if (!result.allowed) {
      logger.warn('IP rate limit exceeded', {
        ip,
        current: result.current,
        limit: result.limit,
      });
      
      return res.status(429).json({
        error: 'Too many requests',
        code: 'RATE_LIMIT_EXCEEDED',
        retryAfter: windowSeconds,
        limit: result.limit,
        current: result.current,
      });
    }
    
    next();
  } catch (error) {
    logger.error('Rate limit middleware error', { error: error.message });
    // Fail open - allow request if rate limiting fails
    next();
  }
};

/**
 * User-based daily rate limiting
 */
const userDailyLimit = async (req, res, next) => {
  try {
    if (!req.user || !req.user.id) {
      return next();
    }
    
    const userId = req.user.id;
    const dailyWindowSeconds = 86400; // 24 hours
    
    const result = await checkRateLimit(
      userId,
      DAILY_LIMIT_MAX_REQUESTS,
      dailyWindowSeconds,
      'user-daily'
    );
    
    res.setHeader('X-Daily-Limit', result.limit);
    res.setHeader('X-Daily-Remaining', result.remaining);
    
    if (!result.allowed) {
      logger.warn('User daily limit exceeded', {
        userId,
        current: result.current,
        limit: result.limit,
      });
      
      return res.status(429).json({
        error: 'Daily request limit exceeded',
        code: 'DAILY_LIMIT_EXCEEDED',
        retryAfter: dailyWindowSeconds,
        limit: result.limit,
        current: result.current,
      });
    }
    
    next();
  } catch (error) {
    logger.error('Daily limit middleware error', { error: error.message });
    next();
  }
};

/**
 * Endpoint-specific rate limits
 */
const endpointRateLimit = (maxRequests, windowSeconds) => {
  return async (req, res, next) => {
    try {
      const identifier = req.user?.id || req.ip;
      const endpoint = req.path;
      const key = `${identifier}:${endpoint}`;
      
      const result = await checkRateLimit(
        key,
        maxRequests,
        windowSeconds,
        'endpoint'
      );
      
      if (!result.allowed) {
        logger.warn('Endpoint rate limit exceeded', {
          identifier,
          endpoint,
          current: result.current,
          limit: result.limit,
        });
        
        return res.status(429).json({
          error: 'Too many requests to this endpoint',
          code: 'ENDPOINT_RATE_LIMIT_EXCEEDED',
          retryAfter: windowSeconds,
        });
      }
      
      next();
    } catch (error) {
      logger.error('Endpoint rate limit error', { error: error.message });
      next();
    }
  };
};

/**
 * Adaptive rate limiting based on server load
 */
let serverLoadFactor = 1.0;

const updateServerLoad = (cpuUsage, memoryUsage) => {
  if (cpuUsage > 80 || memoryUsage > 80) {
    serverLoadFactor = 0.5; // Reduce limits by 50%
  } else if (cpuUsage > 60 || memoryUsage > 60) {
    serverLoadFactor = 0.75;
  } else {
    serverLoadFactor = 1.0;
  }
};

const adaptiveRateLimit = async (req, res, next) => {
  const adjustedLimit = Math.floor(RATE_LIMIT_MAX_REQUESTS * serverLoadFactor);
  
  const ip = req.ip || req.connection.remoteAddress;
  const windowSeconds = Math.floor(RATE_LIMIT_WINDOW_MS / 1000);
  
  const result = await checkRateLimit(
    ip,
    adjustedLimit,
    windowSeconds,
    'adaptive'
  );
  
  if (!result.allowed) {
    return res.status(429).json({
      error: 'Server under high load, please retry later',
      code: 'SERVER_LOAD_LIMIT',
      retryAfter: windowSeconds,
    });
  }
  
  next();
};

module.exports = {
  ipRateLimit,
  userDailyLimit,
  endpointRateLimit,
  adaptiveRateLimit,
  updateServerLoad,
};