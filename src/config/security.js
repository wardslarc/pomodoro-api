import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

// Security headers configuration
const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  crossOriginEmbedderPolicy: false,
});

// Rate limiting configuration
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
    skip: (req) => req.url === '/health',
  });
};

// Specific rate limiters
const authLimiter = createRateLimit(
  15 * 60 * 1000,
  5,
  'Too many authentication attempts from this IP, please try again later.'
);

const apiLimiter = createRateLimit(
  15 * 60 * 1000,
  100,
  'Too many requests from this IP, please try again later.'
);

const strictLimiter = createRateLimit(
  60 * 1000,
  10,
  'Too many requests from this IP, please slow down.'
);

export {
  securityHeaders,
  authLimiter,
  apiLimiter,
  strictLimiter,
};