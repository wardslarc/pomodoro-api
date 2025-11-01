const express = require('express');
const { body } = require('express-validator');
const {
  getSettings,
  updateSettings,
  resetSettings
} = require('../controllers/settingsController');
const auth = require('../middleware/auth');
const { handleValidationErrors } = require('../middleware/validation');

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
  body('volume')
    .optional()
    .isInt({ min: 0, max: 100 })
    .withMessage('Volume must be between 0 and 100')
];

router.get('/', auth, getSettings);
router.put('/', auth, settingsValidation, handleValidationErrors, updateSettings);
router.post('/reset', auth, resetSettings);

module.exports = router;