import Redis from 'ioredis';
import config from '../config/config.js';
import logger from '../utils/logger.js';

class RedisService {
  constructor() {
    this.client = null;
    this.isConnected = false;
    this.connect();
  }

  connect() {
    if (this.client) return this.client;

    try {
      const redisUrl = process.env.REDIS_URL;
      
      if (!redisUrl) {
        logger.warn('REDIS_URL not found, 2FA will not work in production');
        return null;
      }

      this.client = new Redis(redisUrl, {
        retryDelayOnFailover: 100,
        maxRetriesPerRequest: 3,
        enableReadyCheck: true,
        lazyConnect: true,
        connectTimeout: 10000,
        commandTimeout: 5000
      });

      this.client.on('connect', () => {
        logger.info('✅ Redis client connected to Upstash');
        this.isConnected = true;
      });

      this.client.on('error', (error) => {
        logger.error('Redis connection error:', error.message);
        this.isConnected = false;
      });

      this.client.on('close', () => {
        logger.warn('Redis connection closed');
        this.isConnected = false;
      });

      return this.client;
    } catch (error) {
      logger.error('Failed to create Redis client:', error.message);
      return null;
    }
  }

  async set(key, value, expirySeconds = 600) {
    if (!this.client || !this.isConnected) {
      throw new Error('Redis not connected');
    }

    try {
      if (expirySeconds > 0) {
        await this.client.setex(key, expirySeconds, JSON.stringify(value));
      } else {
        await this.client.set(key, JSON.stringify(value));
      }
      logger.debug(`Redis set: ${key}`);
      return true;
    } catch (error) {
      logger.error('Redis set error:', error.message);
      throw error;
    }
  }

  async get(key) {
    if (!this.client || !this.isConnected) {
      throw new Error('Redis not connected');
    }

    try {
      const data = await this.client.get(key);
      logger.debug(`Redis get: ${key} - ${data ? 'found' : 'not found'}`);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      logger.error('Redis get error:', error.message);
      throw error;
    }
  }

  async delete(key) {
    if (!this.client || !this.isConnected) {
      throw new Error('Redis not connected');
    }

    try {
      await this.client.del(key);
      logger.debug(`Redis delete: ${key}`);
      return true;
    } catch (error) {
      logger.error('Redis delete error:', error.message);
      throw error;
    }
  }

  async exists(key) {
    if (!this.client || !this.isConnected) {
      throw new Error('Redis not connected');
    }

    try {
      const result = await this.client.exists(key);
      return result === 1;
    } catch (error) {
      logger.error('Redis exists error:', error.message);
      throw error;
    }
  }

  // Health check
  async health() {
    try {
      if (!this.client) return false;
      await this.client.ping();
      return true;
    } catch (error) {
      return false;
    }
  }
}

// Create singleton instance
const redisService = new RedisService();

export default redisService;