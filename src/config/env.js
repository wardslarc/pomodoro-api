const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const Joi = require('joi');

// Define validation schema for environment variables
const envVarsSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),
  
  PORT: Joi.number()
    .default(5000),
  
  MONGODB_URI: Joi.string()
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
    .default(15 * 60 * 1000)
    .description('Rate limit window in milliseconds'),
  
  RATE_LIMIT_MAX_REQUESTS: Joi.number()
    .default(100)
    .description('Max requests per window'),
  
  ALLOWED_ORIGINS: Joi.string()
    .default('http://localhost:3000,http://localhost:5173')
    .description('CORS allowed origins'),
  
  LOG_LEVEL: Joi.string()
    .valid('error', 'warn', 'info', 'debug')
    .default('info')
    .description('Log level'),
}).unknown();

// Validate environment variables
const { value: envVars, error } = envVarsSchema.validate(process.env);

if (error) {
  throw new Error(`Config validation error: ${error.message}`);
}

// Export configuration object
const config = {
  env: envVars.NODE_ENV,
  port: envVars.PORT,
  mongoose: {
    url: envVars.MONGODB_URI,
    options: {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    },
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
    allowedOrigins: envVars.ALLOWED_ORIGINS.split(',').map(origin => origin.trim()),
  },
  logLevel: envVars.LOG_LEVEL,
};

module.exports = config;