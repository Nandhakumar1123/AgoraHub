const Redis = require('ioredis');
require('dotenv').config();

const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379,
  password: process.env.REDIS_PASSWORD || undefined,
  retryStrategy(times) {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
  maxRetriesPerRequest: 3,
});

redis.on('connect', () => {
  console.log('✅ Redis connected');
});

redis.on('error', (err) => {
  console.error('❌ Redis connection error:', err);
});

// Cache metrics
let cacheHits = 0;
let cacheMisses = 0;

const getCacheStats = () => ({
  hits: cacheHits,
  misses: cacheMisses,
  hitRate: cacheHits + cacheMisses > 0 
    ? (cacheHits / (cacheHits + cacheMisses) * 100).toFixed(2) 
    : 0,
});

// Cache helper with metrics
const getCache = async (key) => {
  try {
    const value = await redis.get(key);
    if (value) {
      cacheHits++;
      return JSON.parse(value);
    }
    cacheMisses++;
    return null;
  } catch (error) {
    console.error('Redis GET error:', error);
    cacheMisses++;
    return null;
  }
};

const setCache = async (key, value, ttl = 3600) => {
  try {
    await redis.setex(key, ttl, JSON.stringify(value));
    return true;
  } catch (error) {
    console.error('Redis SET error:', error);
    return false;
  }
};

const deleteCache = async (key) => {
  try {
    await redis.del(key);
    return true;
  } catch (error) {
    console.error('Redis DEL error:', error);
    return false;
  }
};

// Session management for bot conversations
const getBotSession = async (sessionHash) => {
  const key = `bot:session:${sessionHash}`;
  return await getCache(key);
};

const setBotSession = async (sessionHash, context, ttl = 1800) => {
  const key = `bot:session:${sessionHash}`;
  return await setCache(key, context, ttl);
};

// Rate limiting helpers
const getRateLimitKey = (identifier, type = 'ip') => {
  return `ratelimit:${type}:${identifier}`;
};

const checkRateLimit = async (identifier, max, window, type = 'ip') => {
  const key = getRateLimitKey(identifier, type);
  
  try {
    const current = await redis.incr(key);
    
    if (current === 1) {
      await redis.expire(key, window);
    }
    
    return {
      allowed: current <= max,
      current,
      limit: max,
      remaining: Math.max(0, max - current),
    };
  } catch (error) {
    console.error('Rate limit check error:', error);
    return { allowed: true, current: 0, limit: max, remaining: max };
  }
};

// Model cache key generator
const getModelCacheKey = (text, modelType) => {
  const crypto = require('crypto');
  const hash = crypto.createHash('sha256').update(text).digest('hex').substring(0, 16);
  return `nlp:${modelType}:${hash}`;
};

module.exports = {
  redis,
  getCache,
  setCache,
  deleteCache,
  getBotSession,
  setBotSession,
  checkRateLimit,
  getModelCacheKey,
  getCacheStats,
};