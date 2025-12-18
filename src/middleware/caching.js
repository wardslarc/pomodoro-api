import Redis from 'ioredis';
import config from '../config/config.js';
import logger from '../utils/logger.js';

let redisClient = null;

/**
 * Initialize Redis client
 */
export const initializeRedis = async () => {
  if (redisClient) return redisClient;

  try {
    redisClient = new Redis(config.redis.url, {
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      enableOfflineQueue: false
    });

    redisClient.on('connect', () => {
      logger.info('Redis connected');
    });

    redisClient.on('error', (err) => {
      logger.error('Redis error:', err);
    });

    redisClient.on('reconnecting', () => {
      logger.warn('Redis reconnecting');
    });

    return redisClient;
  } catch (error) {
    logger.error('Failed to initialize Redis:', error);
    return null;
  }
};

/**
 * Get value from cache
 */
export const getCached = async (key) => {
  try {
    if (!redisClient) return null;
    
    const cached = await redisClient.get(key);
    if (!cached) return null;
    
    return JSON.parse(cached);
  } catch (error) {
    logger.error('Cache get error:', { key, error: error.message });
    return null;
  }
};

/**
 * Set value in cache with TTL
 */
export const setCached = async (key, value, ttl = 300) => {
  try {
    if (!redisClient) return false;
    
    await redisClient.setex(key, ttl, JSON.stringify(value));
    return true;
  } catch (error) {
    logger.error('Cache set error:', { key, error: error.message });
    return false;
  }
};

/**
 * Delete cache key
 */
export const deleteCached = async (key) => {
  try {
    if (!redisClient) return false;
    
    await redisClient.del(key);
    return true;
  } catch (error) {
    logger.error('Cache delete error:', { key, error: error.message });
    return false;
  }
};

/**
 * Delete multiple cache keys by pattern
 */
export const deleteCachedPattern = async (pattern) => {
  try {
    if (!redisClient) return false;
    
    const keys = await redisClient.keys(pattern);
    if (keys.length > 0) {
      await redisClient.del(...keys);
    }
    return true;
  } catch (error) {
    logger.error('Cache pattern delete error:', { pattern, error: error.message });
    return false;
  }
};

/**
 * Cache middleware - caches GET requests
 */
export const cacheMiddleware = (ttl = 300) => {
  return async (req, res, next) => {
    // Only cache GET requests
    if (req.method !== 'GET') {
      return next();
    }

    const cacheKey = `${req.originalUrl}`;
    
    try {
      const cached = await getCached(cacheKey);
      if (cached) {
        logger.debug('Cache hit', { cacheKey });
        return res.json(cached);
      }
    } catch (error) {
      logger.debug('Cache lookup failed', { cacheKey, error: error.message });
    }

    // Store original res.json to intercept response
    const originalJson = res.json.bind(res);

    res.json = function (data) {
      // Cache successful responses (2xx status codes)
      if (res.statusCode >= 200 && res.statusCode < 300) {
        setCached(cacheKey, data, ttl).catch(err => 
          logger.debug('Failed to cache response', { error: err.message })
        );
      }
      
      return originalJson(data);
    };

    next();
  };
};

/**
 * Invalidate related caches after data modification
 */
export const invalidateRelatedCaches = async (patterns = []) => {
  for (const pattern of patterns) {
    await deleteCachedPattern(pattern);
  }
};

/**
 * Close Redis connection
 */
export const closeRedis = async () => {
  try {
    if (redisClient) {
      await redisClient.quit();
      redisClient = null;
      logger.info('Redis connection closed');
    }
  } catch (error) {
    logger.error('Error closing Redis:', error);
  }
};

export default {
  initializeRedis,
  getCached,
  setCached,
  deleteCached,
  deleteCachedPattern,
  cacheMiddleware,
  invalidateRelatedCaches,
  closeRedis
};
