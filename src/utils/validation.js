import { validationResult } from 'express-validator';
import { ApiResponse } from './apiResponse.js';

const customValidators = {
  isObjectId: (value) => {
    if (!value) return false;
    return /^[0-9a-fA-F]{24}$/.test(value);
  },

  isSessionType: (value) => {
    return ['work', 'break', 'longBreak'].includes(value);
  },

  isNotificationSound: (value) => {
    return ['bell', 'chime', 'beep', 'none'].includes(value);
  },

  isTagsArray: (value) => {
    if (!Array.isArray(value)) return false;
    return value.every(tag => 
      typeof tag === 'string' && 
      tag.length <= 20 && 
      /^[a-zA-Z0-9\s\-_]+$/.test(tag)
    );
  },
};

const customSanitizers = {
  normalizeEmail: (value) => {
    if (typeof value === 'string') {
      return value.toLowerCase().trim();
    }
    return value;
  },

  normalizeString: (value) => {
    if (typeof value === 'string') {
      return value.trim().replace(/\s+/g, ' ');
    }
    return value;
  },

  normalizeArray: (value) => {
    if (Array.isArray(value)) {
      return value
        .map(item => typeof item === 'string' ? item.trim() : item)
        .filter(item => item !== '');
    }
    return value;
  },
};

const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    const errorMessages = errors.array().map(error => ({
      field: error.param,
      message: error.msg,
      value: error.value,
    }));

    return res.status(400).json(
      ApiResponse.error('Validation failed', null, { errors: errorMessages }).toJSON()
    );
  }
  
  next();
};

export { customValidators, customSanitizers, handleValidationErrors };