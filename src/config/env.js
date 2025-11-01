// src/config.js
import dotenv from 'dotenv';
import Joi from 'joi';

dotenv.config();

const envVarsSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('production'),
  
  PORT: Joi.number()
    .default(5000),
  
  MONGODB_URI: Joi.string()
    .uri()
    .required()
    .description('MongoDB connection string'),
  
  JWT_SECRET: Joi.string()
    .required()
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
  
  FRONTEND_URL: Joi.string()
    .uri()
    .default('https://reflectivepomodoro.com')
    .description('Frontend URL for CORS'),
  
  LOG_LEVEL: Joi.string()
    .valid('error', 'warn', 'info', 'debug')
    .default('info')
    .description('Log level'),
}).unknown();

const { value: envVars, error } = envVarsSchema.validate(process.env);

if (error) {
  console.error('Config validation error:', error.message);
  // In production, we should fail fast if required vars are missing
  if (process.env.NODE_ENV === 'production') {
    throw new Error(`Config validation error: ${error.message}`);
  }
}

const config = {
  env: envVars.NODE_ENV,
  port: envVars.PORT,
  mongoose: {
    url: envVars.MONGODB_URI,
    options: {
      maxPoolSize: 5,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      bufferCommands: false,
    }
  },
  jwt: {
    secret: envVars.JWT_SECRET,
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
    allowedOrigins: [
      envVars.FRONTEND_URL,
      "http://localhost:5173",
      "http://127.0.0.1:5173",
      "https://reflectivepomodoro.com",
      "https://www.reflectivepomodoro.com",
    ].filter(Boolean),
  },
  logLevel: envVars.LOG_LEVEL,
};

export default config;