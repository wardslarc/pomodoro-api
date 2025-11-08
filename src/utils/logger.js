// Vercel-optimized logger
const isVercel = process.env.VERCEL;
const isDevelopment = process.env.NODE_ENV === 'development';

// Only log at certain levels in production serverless to reduce costs
const getEffectiveLogLevel = () => {
  if (isVercel && !isDevelopment) {
    return process.env.LOG_LEVEL || 'warn'; // More restrictive in production
  }
  return process.env.LOG_LEVEL || 'info';
};

const shouldLog = (level) => {
  const levels = {
    error: 0,
    warn: 1,
    info: 2,
    debug: 3
  };
  
  const currentLevel = levels[getEffectiveLogLevel()] || 1; // Default to warn in serverless
  const messageLevel = levels[level] || 2;
  
  return messageLevel <= currentLevel;
};

const logger = {
  info: (message, meta) => {
    if (shouldLog('info')) {
      // In Vercel production, keep logs very minimal
      if (isVercel && !isDevelopment) {
        console.log(JSON.stringify({ level: 'INFO', message, timestamp: new Date().toISOString() }));
      } else {
        console.log(`[INFO] ${message}`, meta || '');
      }
    }
  },
  
  error: (message, meta) => {
    if (shouldLog('error')) {
      // Always log errors, but structure them for serverless
      const errorEntry = {
        level: 'ERROR',
        message,
        timestamp: new Date().toISOString(),
        ...meta
      };
      console.error(JSON.stringify(errorEntry));
    }
  },
  
  warn: (message, meta) => {
    if (shouldLog('warn')) {
      const warnEntry = {
        level: 'WARN',
        message,
        timestamp: new Date().toISOString(),
        ...meta
      };
      console.warn(JSON.stringify(warnEntry));
    }
  },
  
  debug: (message, meta) => {
    if (isDevelopment && shouldLog('debug')) {
      console.debug(`[DEBUG] ${message}`, meta || '');
    }
    // Skip debug logs in production serverless
  }
};

export default logger;