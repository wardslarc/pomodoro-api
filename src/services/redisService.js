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
      
      console.log('🔍 Redis URL:', this.maskUrl(redisUrl));
      
      if (!redisUrl) {
        logger.error('❌ REDIS_URL environment variable is not set');
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
        console.log('✅ Redis: connect event');
        logger.info('✅ Redis connected successfully');
        this.isConnected = true;
      });

      this.client.on('ready', () => {
        console.log('✅ Redis: ready event');
        logger.info('✅ Redis ready for commands');
      });

      this.client.on('error', (error) => {
        console.log('❌ Redis: error event', error.message, error.code);
        logger.error('❌ Redis connection error:', { 
          message: error.message, 
          code: error.code,
          stack: error.stack 
        });
        this.isConnected = false;
      });

      this.client.on('end', () => {
        console.log('🔌 Redis: end event');
        logger.warn('🔌 Redis connection ended');
        this.isConnected = false;
      });

      // Test connection after a short delay
      setTimeout(async () => {
        try {
          console.log('🔍 Testing Redis connection...');
          const result = await this.client.ping();
          console.log('✅ Redis ping result:', result);
          logger.info('✅ Redis ping successful:', { result });
        } catch (error) {
          console.log('❌ Redis ping failed:', error.message, error.code);
          logger.error('❌ Redis ping failed:', { 
            message: error.message, 
            code: error.code 
          });
        }
      }, 2000);

    } catch (error) {
      console.log('❌ Redis initialization failed:', error.message);
      logger.error('❌ Failed to initialize Redis:', { 
        message: error.message,
        stack: error.stack 
      });
    }
  }

  // Mask URL for logging (hide password)
  maskUrl(url) {
    if (!url) return 'undefined';
    return url.replace(/:[^@]+@/, ':***@');
  }

  async set(key, value, expirySeconds = 600) {
    try {
      console.log('🔍 Redis SET called:', { key, expirySeconds });
      
      if (!this.client) {
        throw new Error('Redis client not initialized');
      }

      const result = await this.client.setex(key, expirySeconds, JSON.stringify(value));
      console.log('✅ Redis SET result:', result);
      logger.debug(`Redis set: ${key}`, { result });
      return true;
    } catch (error) {
      console.log('❌ Redis SET error:', error.message, error.code);
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
      console.log('🔍 Redis GET called:', { key });
      
      if (!this.client) {
        throw new Error('Redis client not initialized');
      }

      const data = await this.client.get(key);
      console.log('✅ Redis GET result:', data ? 'found' : 'not found');
      logger.debug(`Redis get: ${key}`, { found: !!data });
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.log('❌ Redis GET error:', error.message, error.code);
      logger.error('Redis get error:', { 
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
      const result = await this.client.ping();
      return { connected: true, ping: result };
    } catch (error) {
      return { connected: false, error: error.message, code: error.code };
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
        message: error.message 
      });
      throw error;
    }
  }
}

// Create singleton instance
const redisService = new RedisService();

export default redisService;