import express from 'express';
import { body } from 'express-validator';
import {
  getSettings,
  updateSettings,
  resetSettings
} from '../controllers/settingsController.js';
import { auth } from '../middleware/auth.js';
import { handleValidationErrors } from '../middleware/validation.js';

const router = express.Router();

const settingsValidation = [
  body('workDuration')
    .optional()
    .isInt({ min: 1, max: 120 })
    .withMessage('Work duration must be between 1 and 120 minutes'),
  body('shortBreakDuration')
    .optional()
    .isInt({ min: 1, max: 30 })
    .withMessage('Short break duration must be between 1 and 30 minutes'),
  body('longBreakDuration')
    .optional()
    .isInt({ min: 1, max: 60 })
    .withMessage('Long break duration must be between 1 and 60 minutes'),
  body('sessionsBeforeLongBreak')
    .optional()
    .isInt({ min: 1, max: 10 })
    .withMessage('Sessions before long break must be between 1 and 10'),
  body('notificationSound')
    .optional()
    .isIn(['bell', 'chime', 'beep', 'none'])
    .withMessage('Invalid notification sound'),
  body('volume')
    .optional()
    .isInt({ min: 0, max: 100 })
    .withMessage('Volume must be between 0 and 100'),
  body('darkMode')
    .optional()
    .isBoolean()
    .withMessage('Dark mode must be a boolean'),
  body('autoStartBreaks')
    .optional()
    .isBoolean()
    .withMessage('Auto start breaks must be a boolean'),
  body('autoStartPomodoros')
    .optional()
    .isBoolean()
    .withMessage('Auto start pomodoros must be a boolean'),
  body('showSettingsButton')
    .optional()
    .isBoolean()
    .withMessage('Show settings button must be a boolean'),
  handleValidationErrors
];

// Apply authentication to all routes
router.use(auth);

// GET /api/settings - Get user settings
router.get('/', getSettings);

// PUT /api/settings - Update user settings
router.put('/', settingsValidation, updateSettings);

// POST /api/settings/reset - Reset settings to defaults
router.post('/reset', resetSettings);

export default router;