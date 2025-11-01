import { body, validationResult } from 'express-validator';

const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    // Transform the errors to match what your frontend expects
    const errorMessages = errors.array().map(error => ({
      field: error.param,
      message: error.msg,
      value: error.value,
      location: error.location
    }));

    console.log('🔍 VALIDATION ERRORS - COMPLETE DETAILS:', {
      timestamp: new Date().toISOString(),
      method: req.method,
      path: req.path,
      headers: {
        'content-type': req.headers['content-type'],
        'authorization': req.headers['authorization'] ? 'present' : 'missing',
        'content-length': req.headers['content-length']
      },
      body: req.body,
      user: req.user ? { id: req.user._id, email: req.user.email } : 'no user',
      errors: errorMessages,
      rawErrors: errors.array(), // Include raw errors for debugging
      errorCount: errors.array().length
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
    .bail()
    .isString()
    .withMessage('Session ID must be a string')
    .bail()
    .custom((value, { req }) => {
      console.log('🔍 [sessionId] Validation - START:', {
        value,
        type: typeof value,
        isString: typeof value === 'string',
        length: value?.length,
        trimmedLength: value?.trim()?.length,
        fullRequest: {
          method: req.method,
          path: req.path,
          body: req.body,
          user: req.user ? { id: req.user._id, email: req.user.email } : 'no user'
        }
      });
      
      const trimmedValue = value.trim();
      
      if (trimmedValue.length === 0) {
        console.log('❌ [sessionId] Validation failed: empty string after trimming');
        throw new Error('Session ID cannot be empty');
      }
      
      const isMongoId = /^[0-9a-fA-F]{24}$/.test(trimmedValue);
      const isLocalId = trimmedValue.startsWith('local-');
      
      console.log('🔍 [sessionId] Validation results:', { 
        originalValue: value,
        trimmedValue,
        isMongoId,
        isLocalId,
        isValid: isMongoId || isLocalId
      });
      
      if (!isMongoId && !isLocalId) {
        console.log('❌ [sessionId] Validation failed: invalid format');
        throw new Error('Invalid session ID format. Must be MongoDB ID (24 hex chars) or local-* format');
      }
      
      // Update the request body with trimmed value for consistency
      req.body.sessionId = trimmedValue;
      
      console.log('✅ [sessionId] Validation passed');
      return true;
    }),
  
  body('learnings')
    .notEmpty()
    .withMessage('Learnings content is required')
    .bail()
    .isString()
    .withMessage('Learnings must be a string')
    .bail()
    .custom((value, { req }) => {
      console.log('🔍 [learnings] Validation - START:', {
        value,
        length: value?.length,
        trimmedLength: value?.trim()?.length,
        isString: typeof value === 'string',
        isEmpty: value?.trim()?.length === 0
      });
      
      const trimmedValue = value.trim();
      
      if (trimmedValue.length === 0) {
        console.log('❌ [learnings] Validation failed: empty or whitespace only');
        throw new Error('Learnings content is required');
      }
      
      if (trimmedValue.length > 2000) {
        console.log('❌ [learnings] Validation failed: too long', trimmedValue.length);
        throw new Error('Learnings must be less than 2000 characters');
      }
      
      // Update the request body with trimmed value for consistency
      req.body.learnings = trimmedValue;
      
      console.log('✅ [learnings] Validation passed');
      return true;
    }),
  
  body('createdAt')
    .optional()
    .isISO8601()
    .withMessage('CreatedAt must be a valid ISO 8601 date string')
    .custom((value, { req }) => {
      console.log('🔍 [createdAt] Validation - START:', {
        value,
        isProvided: value !== undefined && value !== null,
        isString: typeof value === 'string',
        length: value?.length
      });
      
      if (value && typeof value !== 'string') {
        console.log('❌ [createdAt] Validation failed: not a string', typeof value);
        throw new Error('CreatedAt must be a string');
      }
      
      if (value) {
        try {
          const date = new Date(value);
          if (isNaN(date.getTime())) {
            console.log('❌ [createdAt] Validation failed: invalid date', value);
            throw new Error('CreatedAt must be a valid date');
          }
          console.log('✅ [createdAt] Validation passed - valid date:', date.toISOString());
        } catch (error) {
          console.log('❌ [createdAt] Validation failed: date parsing error', error.message);
          throw new Error('CreatedAt must be a valid ISO 8601 date string');
        }
      } else {
        console.log('ℹ️ [createdAt] Not provided, skipping validation');
      }
      
      return true;
    }),
  
  handleValidationErrors
];

const validateSignup = [
  body('name')
    .trim()
    .isLength({ min: 2 })
    .withMessage('Name must be at least 2 characters long')
    .escape(),
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

// SIMPLE VALIDATION - More permissive for debugging
const validateReflectionSimple = [
  (req, res, next) => {
    console.log('🔍 SIMPLE VALIDATION - RAW REQUEST:', {
      method: req.method,
      path: req.path,
      headers: {
        'content-type': req.headers['content-type'],
        'authorization': req.headers['authorization'] ? 'present' : 'missing',
        'content-length': req.headers['content-length']
      },
      body: req.body,
      user: req.user ? { id: req.user._id, email: req.user.email } : 'no user',
      rawBody: JSON.stringify(req.body)
    });

    const { sessionId, learnings, createdAt } = req.body;
    const errors = [];

    // Check sessionId
    if (!sessionId) {
      errors.push({ field: 'sessionId', message: 'Session ID is required', value: sessionId });
    } else if (typeof sessionId !== 'string') {
      errors.push({ field: 'sessionId', message: 'Session ID must be a string', value: sessionId, type: typeof sessionId });
    } else if (sessionId.trim().length === 0) {
      errors.push({ field: 'sessionId', message: 'Session ID cannot be empty', value: sessionId });
    } else {
      const trimmedSessionId = sessionId.trim();
      const isMongoId = /^[0-9a-fA-F]{24}$/.test(trimmedSessionId);
      const isLocalId = trimmedSessionId.startsWith('local-');
      if (!isMongoId && !isLocalId) {
        errors.push({ 
          field: 'sessionId', 
          message: 'Invalid session ID format. Must be MongoDB ID (24 hex chars) or local-* format', 
          value: trimmedSessionId 
        });
      } else {
        // Update with trimmed value
        req.body.sessionId = trimmedSessionId;
      }
    }

    // Check learnings
    if (!learnings) {
      errors.push({ field: 'learnings', message: 'Learnings content is required', value: learnings });
    } else if (typeof learnings !== 'string') {
      errors.push({ field: 'learnings', message: 'Learnings must be a string', value: learnings, type: typeof learnings });
    } else if (learnings.trim().length === 0) {
      errors.push({ field: 'learnings', message: 'Learnings cannot be empty', value: learnings });
    } else if (learnings.length > 2000) {
      errors.push({ field: 'learnings', message: 'Learnings must be less than 2000 characters', value: learnings.length });
    } else {
      // Update with trimmed value
      req.body.learnings = learnings.trim();
    }

    // Check createdAt (optional)
    if (createdAt && typeof createdAt !== 'string') {
      errors.push({ field: 'createdAt', message: 'CreatedAt must be a string', value: createdAt, type: typeof createdAt });
    } else if (createdAt) {
      try {
        const date = new Date(createdAt);
        if (isNaN(date.getTime())) {
          errors.push({ field: 'createdAt', message: 'CreatedAt must be a valid date', value: createdAt });
        }
      } catch (error) {
        errors.push({ field: 'createdAt', message: 'CreatedAt must be a valid date', value: createdAt });
      }
    }

    if (errors.length > 0) {
      console.log('❌ SIMPLE VALIDATION FAILED:', {
        errors,
        receivedBody: req.body,
        sessionIdDetails: sessionId ? {
          value: sessionId,
          type: typeof sessionId,
          length: sessionId.length,
          trimmedLength: sessionId.trim().length
        } : 'missing',
        learningsDetails: learnings ? {
          value: learnings.substring(0, 100) + '...',
          type: typeof learnings,
          length: learnings.length,
          trimmedLength: learnings.trim().length
        } : 'missing'
      });
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors
      });
    }

    console.log('✅ SIMPLE VALIDATION PASSED - Final validated body:', {
      sessionId: req.body.sessionId,
      learnings: req.body.learnings.substring(0, 100) + '...',
      learningsLength: req.body.learnings.length,
      createdAt: req.body.createdAt
    });
    next();
  }
];

// ULTRA SIMPLE VALIDATION - Minimal checks for debugging
const validateReflectionUltraSimple = [
  (req, res, next) => {
    console.log('🔍 ULTRA SIMPLE VALIDATION - RAW REQUEST BODY:', JSON.stringify(req.body, null, 2));
    
    const { sessionId, learnings } = req.body;
    
    // Only the most basic checks
    if (!sessionId || typeof sessionId !== 'string' || sessionId.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Session ID validation failed',
        errors: [{ field: 'sessionId', message: 'Invalid session ID', value: sessionId }]
      });
    }
    
    if (!learnings || typeof learnings !== 'string' || learnings.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Learnings validation failed',
        errors: [{ field: 'learnings', message: 'Invalid learnings', value: learnings?.substring(0, 50) }]
      });
    }
    
    console.log('✅ ULTRA SIMPLE VALIDATION PASSED');
    next();
  }
];

export {
  handleValidationErrors,
  validateSignup,
  validateLogin,
  validateSession,
  validateReflection,
  validateReflectionSimple,
  validateReflectionUltraSimple
};