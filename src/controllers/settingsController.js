import Settings from '../models/Settings.js';
import { getUserId } from '../utils/userUtils.js';
import logger from '../utils/logger.js';

/**
 * Get user settings
 * @route GET /api/settings
 * @access Private
 */
export const getSettings = async (req, res, next) => {
  try {
    // STANDARDIZED: Use getUserId utility
    const userId = getUserId(req);
    
    logger.info('Fetching user settings', { userId });

    let settings = await Settings.findOne({ userId });

    if (!settings) {
      logger.info('No settings found, creating default settings', { userId });
      settings = await Settings.createDefaultSettings(userId);
    }

    logger.info('Settings fetched successfully', { 
      userId, 
      settingsId: settings._id 
    });

    res.json({
      success: true,
      data: { settings }
    });
  } catch (error) {
    logger.error('Error fetching settings:', error);
    next(error);
  }
};

/**
 * Update user settings
 * @route PUT /api/settings
 * @access Private
 */
export const updateSettings = async (req, res, next) => {
  try {
    // STANDARDIZED: Use getUserId utility
    const userId = getUserId(req);
    const updateData = req.body;

    logger.info('Updating user settings', { 
      userId, 
      updateFields: Object.keys(updateData) 
    });

    // Filter out any fields that are not in the settings schema for security
    const allowedFields = [
      'workDuration',
      'shortBreakDuration', 
      'longBreakDuration',
      'sessionsBeforeLongBreak',
      'notificationSound',
      'volume',
      'darkMode',
      'autoStartBreaks',
      'autoStartPomodoros',
      'showSettingsButton'
    ];

    const filteredUpdate = {};
    Object.keys(updateData).forEach(key => {
      if (allowedFields.includes(key)) {
        filteredUpdate[key] = updateData[key];
      }
    });

    // Validate that we have at least one valid field to update
    if (Object.keys(filteredUpdate).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid settings fields provided for update'
      });
    }

    const settings = await Settings.findOneAndUpdate(
      { userId },
      filteredUpdate,
      { 
        new: true, 
        runValidators: true, 
        upsert: true,
        setDefaultsOnInsert: true
      }
    );

    logger.info('Settings updated successfully', { 
      userId, 
      settingsId: settings._id 
    });

    res.json({
      success: true,
      message: 'Settings updated successfully',
      data: { settings }
    });
  } catch (error) {
    logger.error('Error updating settings:', error);
    
    // Handle specific error types
    if (error.name === 'ValidationError') {
      const errorMessages = Object.values(error.errors).map(err => ({
        field: err.path,
        message: err.message,
        value: err.value
      }));

      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errorMessages
      });
    }
    
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'Settings already exist for this user'
      });
    }
    
    next(error);
  }
};

/**
 * Reset settings to defaults
 * @route POST /api/settings/reset
 * @access Private
 */
export const resetSettings = async (req, res, next) => {
  try {
    // STANDARDIZED: Use getUserId utility
    const userId = getUserId(req);

    logger.info('Resetting user settings to defaults', { userId });

    const defaultSettings = {
      workDuration: 25,
      shortBreakDuration: 5,
      longBreakDuration: 15,
      sessionsBeforeLongBreak: 4,
      notificationSound: 'bell',
      volume: 50,
      darkMode: false,
      autoStartBreaks: true,
      autoStartPomodoros: false,
      showSettingsButton: false
    };

    const settings = await Settings.findOneAndUpdate(
      { userId },
      defaultSettings,
      { 
        new: true,
        upsert: true,
        setDefaultsOnInsert: true
      }
    );

    logger.info('Settings reset to defaults successfully', { 
      userId, 
      settingsId: settings._id 
    });

    res.json({
      success: true,
      message: 'Settings reset to defaults',
      data: { settings }
    });
  } catch (error) {
    logger.error('Error resetting settings:', error);
    next(error);
  }
};