import mongoose from 'mongoose';

const settingsSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  workDuration: {
    type: Number,
    required: true,
    min: 1,
    max: 120,
    default: 25
  },
  shortBreakDuration: {
    type: Number,
    required: true,
    min: 1,
    max: 30,
    default: 5
  },
  longBreakDuration: {
    type: Number,
    required: true,
    min: 1,
    max: 60,
    default: 15
  },
  sessionsBeforeLongBreak: {
    type: Number,
    required: true,
    min: 1,
    max: 10,
    default: 4
  },
  notificationSound: {
    type: String,
    enum: ['bell', 'chime', 'beep', 'none'],
    default: 'bell'
  },
  volume: {
    type: Number,
    min: 0,
    max: 100,
    default: 50
  },
  darkMode: {
    type: Boolean,
    default: false
  },
  autoStartBreaks: {
    type: Boolean,
    default: true
  },
  autoStartPomodoros: {
    type: Boolean,
    default: false
  },
  showSettingsButton: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

settingsSchema.statics.createDefaultSettings = async function(userId) {
  return await this.create({ userId });
};

export default mongoose.model('Settings', settingsSchema);