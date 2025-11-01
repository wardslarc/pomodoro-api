import Settings from '../models/Settings.js';

export const getSettings = async (req, res, next) => {
  try {
    let settings = await Settings.findOne({ userId: req.user.id });

    if (!settings) {
      settings = await Settings.createDefaultSettings(req.user.id);
    }

    res.json({
      success: true,
      data: {
        settings
      }
    });
  } catch (error) {
    next(error);
  }
};

export const updateSettings = async (req, res, next) => {
  try {
    const {
      workDuration,
      shortBreakDuration,
      longBreakDuration,
      sessionsBeforeLongBreak,
      notificationSound,
      volume,
      darkMode,
      autoStartBreaks,
      autoStartPomodoros,
      showSettingsButton
    } = req.body;

    const settings = await Settings.findOneAndUpdate(
      { userId: req.user.id },
      {
        workDuration,
        shortBreakDuration,
        longBreakDuration,
        sessionsBeforeLongBreak,
        notificationSound,
        volume,
        darkMode,
        autoStartBreaks,
        autoStartPomodoros,
        showSettingsButton
      },
      { new: true, runValidators: true, upsert: true }
    );

    res.json({
      success: true,
      message: 'Settings updated successfully',
      data: {
        settings
      }
    });
  } catch (error) {
    next(error);
  }
};

export const resetSettings = async (req, res, next) => {
  try {
    const settings = await Settings.findOneAndUpdate(
      { userId: req.user.id },
      {
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
      },
      { new: true }
    );

    res.json({
      success: true,
      message: 'Settings reset to defaults',
      data: {
        settings
      }
    });
  } catch (error) {
    next(error);
  }
};