import mongoose from 'mongoose';
import config from './config.js'; // Updated import path
import logger from '../utils/logger.js';

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(config.mongoose.url, config.mongoose.options);

    logger.info(`MongoDB Connected: ${conn.connection.host}`, {
      database: conn.connection.db?.databaseName,
      host: conn.connection.host,
      readyState: conn.connection.readyState
    });
    
    mongoose.connection.on('error', (err) => {
      logger.error('MongoDB connection error:', err);
    });

    mongoose.connection.on('disconnected', () => {
      logger.warn('MongoDB disconnected');
    });

    mongoose.connection.on('reconnected', () => {
      logger.info('MongoDB reconnected');
    });

    return conn;
  } catch (error) {
    logger.error('Database connection failed:', error);
    
    if (config.env === 'production') {
      process.exit(1);
    }
    
    throw error;
  }
};

const gracefulShutdown = async () => {
  try {
    await mongoose.connection.close();
    logger.info('MongoDB connection closed gracefully');
    process.exit(0);
  } catch (error) {
    logger.error('Error during graceful shutdown:', error);
    process.exit(1);
  }
};

process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);

export { connectDB, gracefulShutdown };