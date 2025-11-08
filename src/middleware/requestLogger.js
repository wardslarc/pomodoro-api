import logger from '../utils/logger.js';

/**
 * Vercel-optimized request logging middleware
 * Lightweight and serverless-friendly
 */
const requestLogger = (req, res, next) => {
  // In serverless environments, be very selective about logging
  const isServerless = process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION;
  
  // Skip logging for health checks and in production serverless to reduce costs
  if (req.path === '/api/health' && isServerless) {
    return next();
  }

  const start = Date.now();
  
  // Minimal request info for serverless
  const requestInfo = {
    method: req.method,
    url: req.path, // Use path instead of originalUrl for consistency
    ip: getClientIP(req),
  };

  // Only add extra fields in development or for specific routes
  if (!isServerless || process.env.NODE_ENV === 'development') {
    requestInfo.userAgent = req.get('User-Agent');
    requestInfo.referrer = req.get('Referer');
  }

  // Log authentication attempts specifically
  if (req.path.includes('/auth/')) {
    logger.info(`Auth request: ${req.method} ${req.path}`, requestInfo);
  } else {
    logger.info(`Request: ${req.method} ${req.path}`, requestInfo);
  }

  // Response logging - minimal in serverless
  const originalSend = res.send;
  res.send = function(data) {
    const duration = Date.now() - start;
    
    // Only log errors and slow requests in serverless to reduce noise
    if (!isServerless || res.statusCode >= 400 || duration > 1000) {
      const responseInfo = {
        method: req.method,
        url: req.path,
        statusCode: res.statusCode,
        duration: `${duration}ms`,
      };

      if (res.statusCode >= 500) {
        logger.error('Server error', responseInfo);
      } else if (res.statusCode >= 400) {
        logger.warn('Client error', responseInfo);
      } else if (duration > 1000) {
        logger.warn('Slow request', { ...responseInfo, duration: `${duration}ms` });
      } else if (!isServerless) {
        logger.info('Request completed', responseInfo);
      }
    }

    originalSend.call(this, data);
  };

  next();
};

// Helper to get client IP in serverless environments
function getClientIP(req) {
  // Vercel specific
  if (req.headers['x-vercel-forwarded-for']) {
    return req.headers['x-vercel-forwarded-for'].split(',')[0];
  }
  // Other serverless platforms
  if (req.headers['x-forwarded-for']) {
    return req.headers['x-forwarded-for'].split(',')[0];
  }
  // Fallback
  return req.ip || req.connection.remoteAddress || 'unknown';
}

export default requestLogger;