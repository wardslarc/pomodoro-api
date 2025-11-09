import config from '../config/config.js';
import logger from '../src/utils/logger.js'; // Import your Vercel-optimized logger

/**
 * Sanitize request body to remove sensitive information before logging
 */
function sanitizeRequestBody(body) {
  if (!body || typeof body !== 'object') return body;
  
  const sensitiveFields = [
    'password', 'token', 'authorization', 'auth', 
    'secret', 'key', 'creditCard', 'ssn', 'cvv'
  ];
  
  const sanitized = { ...body };
  
  sensitiveFields.forEach(field => {
    if (sanitized[field]) {
      sanitized[field] = '***REDACTED***';
    }
  });
  
  return sanitized;
}

/**
 * Sanitize error messages to remove sensitive information
 */
function sanitizeErrorMessage(message, env) {
  if (env === 'production') {
    // Remove API URLs and sensitive paths from error messages
    return message
      .replace(/https?:\/\/[^\s]+/g, '[REDACTED_URL]')
      .replace(/\/api\/[^\s]+/g, '[REDACTED_ENDPOINT]')
      .replace(/mongodb(\+srv)?:\/\/[^@]+@/g, 'mongodb://[REDACTED_CREDENTIALS]@')
      .replace(/API_KEY_[^\s]+/g, '[REDACTED_API_KEY]');
  }
  
  return message;
}

/**
 * Production-safe error handler for Express.js
 * Logs detailed errors server-side but returns only safe messages to the client
 */
const errorHandler = (err, req, res, next) => {
  // Add request context to error log
  const errorContext = {
    path: req.path,
    method: req.method,
    query: req.query,
    body: sanitizeRequestBody(req.body),
    userAgent: req.get('User-Agent'),
    ip: req.ip,
    timestamp: new Date().toISOString()
  };

  // Handle specific error types
  let statusCode = err.statusCode || 500;
  let clientMessage = err.message || 'Internal Server Error';
  let clientErrors = null;

  // MongoDB Duplicate Key Error (11000)
  if (err.code === 11000) {
    statusCode = 400;
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    clientMessage = `${field} already exists`;
    
    // Log the duplicate key error with context
    logger.warn('Duplicate key violation', {
      ...errorContext,
      duplicateField: field,
      keyValue: err.keyValue
    });
  }

  // Mongoose Validation Error
  else if (err.name === 'ValidationError') {
    statusCode = 400;
    clientMessage = 'Validation failed';
    clientErrors = Object.values(err.errors).map(error => ({
      field: error.path,
      message: error.message
    }));
    
    logger.warn('Validation error', {
      ...errorContext,
      validationErrors: clientErrors
    });
  }

  // JWT Errors
  else if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    clientMessage = 'Invalid token';
    
    logger.warn('JWT validation failed', {
      ...errorContext,
      errorType: 'JsonWebTokenError'
    });
  }
  else if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    clientMessage = 'Token expired';
    
    logger.warn('JWT token expired', {
      ...errorContext,
      errorType: 'TokenExpiredError'
    });
  }

  // Mongoose Cast Error (Invalid ObjectId)
  else if (err.name === 'CastError') {
    statusCode = 400;
    clientMessage = 'Invalid resource identifier';
    
    logger.warn('Cast error', {
      ...errorContext,
      castError: err.kind,
      value: err.value
    });
  }

  // Generic 4xx errors
  else if (statusCode >= 400 && statusCode < 500) {
    // Keep client message for 4xx errors but sanitize it
    clientMessage = sanitizeErrorMessage(clientMessage, config.env);
    
    logger.warn('Client error', {
      ...errorContext,
      statusCode,
      originalMessage: err.message
    });
  }

  // 5xx Server Errors
  else {
    // For production, hide internal error details from client
    if (config.env === 'production') {
      clientMessage = 'Internal Server Error';
    }
    
    // Log full error details for server-side investigation
    logger.error('Server error', {
      ...errorContext,
      statusCode,
      errorStack: err.stack,
      errorName: err.name,
      originalMessage: err.message
    });
  }

  // Prepare response
  const response = {
    success: false,
    message: clientMessage
  };

  // Include validation errors if present
  if (clientErrors) {
    response.errors = clientErrors;
  }

  // Include stack trace in development for debugging
  if (config.env === 'development' && statusCode >= 500) {
    response.stack = err.stack;
  }

  // Send response
  res.status(statusCode).json(response);
};

export default errorHandler;