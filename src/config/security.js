import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

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
  });
};

const authLimiter = createRateLimit(900000, 5, 'Too many authentication attempts from this IP, please try again later.');

const apiLimiter = createRateLimit(900000, 100, 'Too many requests from this IP, please try again later.');

const strictLimiter = createRateLimit(60000, 10, 'Too many requests from this IP, please slow down.');

export {
  securityHeaders,
  authLimiter,
  apiLimiter,
  strictLimiter,
};