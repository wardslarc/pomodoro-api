import Redis from 'ioredis';
import logger from '../utils/logger.js';

class RedisService {
  constructor() {
    this.client = null;
    this.isConnected = false;
    this.initialize();
  }

  initialize() {
    try {
      const redisUrl = process.env.REDIS_URL;
      
      if (!redisUrl) {
        logger.error('REDIS_URL environment variable is not set');
        throw new Error('REDIS_URL not configured');
      }

      this.client = new Redis(redisUrl, {
        connectTimeout: 10000,
        commandTimeout: 5000,
        retryDelayOnFailover: 100,
        maxRetriesPerRequest: 3,
        lazyConnect: true,
        enableReadyCheck: true,
        tls: {} // Important for Upstash SSL
      });

      this.client.on('connect', () => {
        logger.info('Redis connected successfully');
        this.isConnected = true;
      });

      this.client.on('ready', () => {
        logger.info('Redis ready for commands');
      });

      this.client.on('error', (error) => {
        logger.error('Redis connection error:', { 
          message: error.message, 
          code: error.code
        });
        this.isConnected = false;
      });

      this.client.on('end', () => {
        logger.warn('Redis connection ended');
        this.isConnected = false;
      });

      this.client.on('close', () => {
        logger.warn('Redis connection closed');
        this.isConnected = false;
      });

      // Test connection after a short delay
      setTimeout(async () => {
        try {
          const result = await this.client.ping();
          logger.info('Redis connection test successful');
        } catch (error) {
          logger.error('Redis connection test failed:', { 
            message: error.message, 
            code: error.code 
          });
        }
      }, 2000);

    } catch (error) {
      logger.error('Failed to initialize Redis:', { 
        message: error.message
      });
    }
  }

  async set(key, value, expirySeconds = 600) {
    try {
      if (!this.client) {
        throw new Error('Redis client not initialized');
      }

      const result = await this.client.setex(key, expirySeconds, JSON.stringify(value));
      logger.debug(`Redis set: ${key}`, { expirySeconds });
      return true;
    } catch (error) {
      logger.error('Redis set error:', { 
        key, 
        message: error.message, 
        code: error.code 
      });
      throw error;
    }
  }

  async get(key) {
    try {
      if (!this.client) {
        throw new Error('Redis client not initialized');
      }

      const data = await this.client.get(key);
      logger.debug(`Redis get: ${key}`, { found: !!data });
      return data ? JSON.parse(data) : null;
    } catch (error) {
      logger.error('Redis get error:', { 
        key, 
        message: error.message, 
        code: error.code 
      });
      throw error;
    }
  }

  async delete(key) {
    try {
      if (!this.client) {
        throw new Error('Redis client not initialized');
      }
      await this.client.del(key);
      logger.debug(`Redis delete: ${key}`);
      return true;
    } catch (error) {
      logger.error('Redis delete error:', { 
        key, 
        message: error.message,
        code: error.code
      });
      throw error;
    }
  }

  async health() {
    try {
      if (!this.client) {
        return { connected: false, error: 'Redis client not initialized' };
      }
      await this.client.ping();
      return { connected: true };
    } catch (error) {
      return { 
        connected: false, 
        error: error.message, 
        code: error.code 
      };
    }
  }

  // Utility method to mask sensitive URLs for logging (if needed elsewhere)
  maskUrl(url) {
    if (!url) return 'undefined';
    return url.replace(/:[^@]+@/, ':***@');
  }
}

// Create singleton instance
const redisService = new RedisService();

export default redisService;