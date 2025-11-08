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
  
  FRONTEND_URL: Joi.string()
    .uri()
    .default('http://localhost:3000')
    .description('Frontend URL for CORS'),
  
  ALLOWED_ORIGINS: Joi.string()
    .default('http://localhost:3000,http://localhost:5173,http://127.0.0.1:3000,http://127.0.0.1:5173')
    .description('Comma-separated list of allowed CORS origins'),
  
  EMAIL_USER: Joi.string()
    .email()
    .description('Email service username'),
  
  EMAIL_PASS: Joi.string()
    .description('Email service password'),
  
  LOG_LEVEL: Joi.string()
    .valid('error', 'warn', 'info', 'debug')
    .default('info')
    .description('Log level'),
}).unknown();

const { value: envVars, error } = envVarsSchema.validate(process.env);

if (error) {
  console.error('Config validation error:', error.message);
  if (process.env.NODE_ENV === 'production') {
    throw new Error(`Config validation error: ${error.message}`);
  }
}

// Parse ALLOWED_ORIGINS into an array
const allowedOrigins = envVars.ALLOWED_ORIGINS 
  ? envVars.ALLOWED_ORIGINS.split(',') 
  : [
      "http://localhost:5173",
      "http://127.0.0.1:5173", 
      "http://localhost:3000",
      "http://127.0.0.1:3000",
    ];

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
    enableRequestLogging: envVars.ENABLE_REQUEST_LOGGING !== 'false', // default true
    enableSecurityLogging: envVars.ENABLE_SECURITY_LOGGING !== 'false', // default true
  },
  cors: {
    allowedOrigins: allowedOrigins,
    frontendUrl: envVars.FRONTEND_URL,
  },
  email: {
    user: envVars.EMAIL_USER,
    pass: envVars.EMAIL_PASS,
  },
  logLevel: envVars.LOG_LEVEL,
};

export default config;