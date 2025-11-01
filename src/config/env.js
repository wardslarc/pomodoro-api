// src/config.js
import dotenv from 'dotenv';
import Joi from 'joi';

dotenv.config();

const envVarsSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('production'), // Change default to production for Vercel
  
  PORT: Joi.number()
    .default(5000),
  
  MONGODB_URI: Joi.string()
    .default('') // Allow empty for serverless
    .description('MongoDB connection string'),
  
  JWT_SECRET: Joi.string()
    .default('fallback-jwt-secret-change-this-in-production-12345') // Fallback for serverless
    .min(32)
    .description('JWT secret key'),
  
  JWT_EXPIRES_IN: Joi.string()
    .default('7d')
    .description('JWT expiration time'),
  
  BCRYPT_ROUNDS: Joi.number()
    .default(12)
    .description('BCrypt salt rounds'),
  
  RATE_LIMIT_WINDOW_MS: Joi.number()
    .default(900000)
    .description('Rate limit window in milliseconds'),
  
  RATE_LIMIT_MAX_REQUESTS: Joi.number()
    .default(100)
    .description('Max requests per window'),
  
  ALLOWED_ORIGINS: Joi.string()
    .default('http://localhost:3000,http://localhost:5173,https://reflectivepomodoro.com,https://www.reflectivepomodoro.com')
    .description('CORS allowed origins'),
  
  LOG_LEVEL: Joi.string()
    .valid('error', 'warn', 'info', 'debug')
    .default('info')
    .description('Log level'),
}).unknown();

const { value: envVars, error } = envVarsSchema.validate(process.env);

if (error) {
  console.error('Config validation error:', error.message);
  // Don't throw error in production, use fallbacks
  if (process.env.NODE_ENV === 'production') {
    console.log('Using fallback configuration for production...');
  } else {
    throw new Error(`Config validation error: ${error.message}`);
  }
}

const config = {
  env: envVars.NODE_ENV,
  port: envVars.PORT,
  mongoose: {
    url: envVars.MONGODB_URI || process.env.MONGODB_URI, // Fallback to direct env
  },
  jwt: {
    secret: envVars.JWT_SECRET || process.env.JWT_SECRET || 'fallback-jwt-secret-change-this-in-production-12345',
    expiresIn: envVars.JWT_EXPIRES_IN,
  },
  bcrypt: {
    rounds: parseInt(envVars.BCRYPT_ROUNDS),
  },
  rateLimit: {
    windowMs: parseInt(envVars.RATE_LIMIT_WINDOW_MS),
    max: parseInt(envVars.RATE_LIMIT_MAX_REQUESTS),
  },
  cors: {
    allowedOrigins: envVars.ALLOWED_ORIGINS.split(',').map(origin => origin.trim()),
  },
  logLevel: envVars.LOG_LEVEL,
};

export default config;