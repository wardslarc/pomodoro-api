import dotenv from 'dotenv';
import Joi from 'joi';

dotenv.config();

const envVarsSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),
  
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
  
  LOG_LEVEL: Joi.string()
    .valid('error', 'warn', 'info', 'debug')
    .default('info')
    .description('Log level'),
}).unknown();

const { value: envVars, error } = envVarsSchema.validate(process.env);

if (error) {
  console.error('Config validation error:', error.message);
  throw new Error(`Config validation error: ${error.message}`);
}

// Production CORS configuration - only allow your domain
const allowedOrigins = ['https://www.reflectivepomodoro.com'];

const config = {
  env: envVars.NODE_ENV,
  port: envVars.PORT,
  mongoose: {
    url: envVars.MONGODB_URI + (envVars.NODE_ENV === 'test' ? '-test' : ''),
    options: {
      maxPoolSize: 10,
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
  logging: {
    level: envVars.LOG_LEVEL || 'info',
  },
  cors: {
    allowedOrigins: allowedOrigins,
  },
};

export default config;