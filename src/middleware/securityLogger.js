import logger from '../utils/logger.js';

/**
 * Lightweight security logger for serverless environments
 * Only logs critical security events
 */
const securityLogger = (req, res, next) => {
  const isServerless = process.env.VERCEL;
  
  // Only log critical security events in serverless
  if (isServerless && process.env.NODE_ENV === 'production') {
    // Rate limit hits
    if (req.rateLimit && req.rateLimit.remaining === 0) {
      logger.warn('Rate limit exceeded', {
        ip: req.ip,
        path: req.path,
        method: req.method
      });
    }
    
    // Failed authentication
    if (req.path.includes('/auth/login') && req.method === 'POST') {
      // This will be logged after the auth logic runs
      res.on('finish', () => {
        if (res.statusCode === 401) {
          logger.warn('Failed login attempt', {
            ip: req.ip,
            path: req.path,
            email: req.body?.email ? '***' : 'missing' // Don't log actual email
          });
        }
      });
    }
    
    return next();
  }

  // More detailed logging in development/non-serverless
  if (req.path.includes('/auth/')) {
    const authLog = {
      path: req.path,
      method: req.method,
      ip: req.ip,
    };

    if (req.path.includes('/login')) {
      logger.info('Authentication attempt', authLog);
    } else if (req.path.includes('/register')) {
      logger.info('Registration attempt', authLog);
    }
  }

  next();
};

export default securityLogger;