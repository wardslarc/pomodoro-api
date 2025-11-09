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
  
  // MongoDB specific configurations
  MONGODB_DB_NAME: Joi.string()
    .default('reflectivePomodoro')
    .description('MongoDB database name'),
  
  MONGODB_MAX_POOL_SIZE: Joi.number()
    .default(10)
    .description('MongoDB max pool size'),
  
  MONGODB_SERVER_SELECTION_TIMEOUT: Joi.number()
    .default(5000)
    .description('MongoDB server selection timeout in ms'),
  
  MONGODB_SOCKET_TIMEOUT: Joi.number()
    .default(45000)
    .description('MongoDB socket timeout in ms'),
  
  MONGODB_CONNECT_TIMEOUT: Joi.number()
    .default(10000)
    .description('MongoDB connection timeout in ms'),
  
  MONGODB_RETRY_WRITES: Joi.boolean()
    .default(true)
    .description('MongoDB retry writes'),
  
  MONGODB_RETRY_READS: Joi.boolean()
    .default(true)
    .description('MongoDB retry reads'),
  
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
    // Ensure the connection string includes the database name
    url: envVars.MONGODB_URI,
    options: {
      dbName: envVars.MONGODB_DB_NAME,
      maxPoolSize: parseInt(envVars.MONGODB_MAX_POOL_SIZE),
      serverSelectionTimeoutMS: parseInt(envVars.MONGODB_SERVER_SELECTION_TIMEOUT),
      socketTimeoutMS: parseInt(envVars.MONGODB_SOCKET_TIMEOUT),
      connectTimeoutMS: parseInt(envVars.MONGODB_CONNECT_TIMEOUT),
      retryWrites: envVars.MONGODB_RETRY_WRITES,
      retryReads: envVars.MONGODB_RETRY_READS,
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