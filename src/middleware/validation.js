import { body, validationResult, query, param } from 'express-validator';
import logger from '../utils/logger.js';

/**
 * Middleware to handle validation errors with detailed logging
 */
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const errorMessages = errors.array().map(error => ({
      field: error.param,
      message: error.msg,
      value: error.value
    }));

    logger.warn('Validation error', {
      path: req.path,
      method: req.method,
      errors: errorMessages
    });

    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errorMessages
    });
  }
  next();
};

const validateReflection = [
  body('sessionId')
    .notEmpty()
    .withMessage('Session ID is required')
    .isString()
    .withMessage('Session ID must be a string')
    .custom((value) => {
      const trimmedValue = value.trim();
      if (trimmedValue.length === 0) {
        throw new Error('Session ID cannot be empty');
      }
      
      const isMongoId = /^[0-9a-fA-F]{24}$/.test(trimmedValue);
      const isLocalId = trimmedValue.startsWith('local-');
      
      if (!isMongoId && !isLocalId) {
        throw new Error('Invalid session ID format');
      }
      
      return true;
    }),
  
  body('learnings')
    .notEmpty()
    .withMessage('Learnings content is required')
    .isString()
    .withMessage('Learnings must be a string')
    .custom((value) => {
      const trimmedValue = value.trim();
      if (trimmedValue.length === 0) {
        throw new Error('Learnings content is required');
      }
      
      if (trimmedValue.length > 2000) {
        throw new Error('Learnings must be less than 2000 characters');
      }
      
      return true;
    }),
  
  body('createdAt')
    .optional()
    .isISO8601()
    .withMessage('CreatedAt must be a valid ISO 8601 date string'),
  
  handleValidationErrors
];

const validateSignup = [
  body('name')
    .trim()
    .isLength({ min: 2 })
    .withMessage('Name must be at least 2 characters long'),
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email'),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long'),
  handleValidationErrors
];

const validateLogin = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email'),
  body('password')
    .notEmpty()
    .withMessage('Password is required'),
  handleValidationErrors
];

const validateSession = [
  body('sessionType')
    .isIn(['work', 'break', 'longBreak'])
    .withMessage('Invalid session type'),
  body('duration')
    .isInt({ min: 1 })
    .withMessage('Duration must be a positive number'),
  body('completedAt')
    .optional()
    .isISO8601()
    .withMessage('CompletedAt must be a valid date'),
  handleValidationErrors
];

export {
  handleValidationErrors,
  validateSignup,
  validateLogin,
  validateSession,
  validateReflection
};