import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import config from '../config/config.js'; // Updated import path

const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
    },
  },
  crossOriginEmbedderPolicy: false,
  hsts: config.env === 'production' ? {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  } : false
});

const createRateLimit = (windowMs, max, message) => {
  return rateLimit({
    windowMs,
    max,
    message: {
      success: false,
      message,
    },
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => {
      if (config.env === 'development' && req.path === '/api/health') {
        return true;
      }
      return false;
    }
  });
};

// Use config values for rate limiting
const authLimiter = createRateLimit(
  config.rateLimit.windowMs, 
  5, 
  'Too many authentication attempts from this IP, please try again later.'
);

const apiLimiter = createRateLimit(
  config.rateLimit.windowMs, 
  config.rateLimit.max, 
  'Too many requests from this IP, please try again later.'
);

const strictLimiter = createRateLimit(
  60000, 
  10, 
  'Too many requests from this IP, please slow down.'
);

export {
  securityHeaders,
  authLimiter,
  apiLimiter,
  strictLimiter,
};