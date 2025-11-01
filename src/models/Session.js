import mongoose from 'mongoose';

const sessionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  sessionType: {
    type: String,
    enum: ['work', 'break', 'longBreak'],
    required: true
  },
  duration: {
    type: Number,
    required: true,
    min: 1,
    max: 180
  },
  completedAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  notes: {
    type: String,
    maxlength: 500,
    trim: true
  },
  tags: [{
    type: String,
    trim: true,
    maxlength: 20
  }],
  efficiency: {
    type: Number,
    min: 1,
    max: 5,
    default: 3
  }
}, {
  timestamps: true,
  toJSON: {
    transform: function(doc, ret) {
      ret.id = ret._id;
      delete ret._id;
      delete ret.__v;
      return ret;
    }
  }
});

sessionSchema.index({ userId: 1, completedAt: -1 });
sessionSchema.index({ userId: 1, sessionType: 1, completedAt: -1 });
sessionSchema.index({ completedAt: 1, sessionType: 1 });

sessionSchema.virtual('formattedDate').get(function() {
  return this.completedAt.toISOString().split('T')[0];
});

sessionSchema.statics.getTotalFocusTime = function(userId, startDate = null) {
  const match = { userId, sessionType: 'work' };
  if (startDate) {
    match.completedAt = { $gte: startDate };
  }
  
  return this.aggregate([
    { $match: match },
    { $group: { _id: null, total: { $sum: '$duration' } } }
  ]);
};

sessionSchema.methods.hasReflection = async function() {
  try {
    const reflection = await mongoose.model('Reflection').findOne({ sessionId: this._id });
    return !!reflection;
  } catch (error) {
    return false;
  }
};

sessionSchema.pre('save', function(next) {
  if (this.completedAt > new Date()) {
    this.completedAt = new Date();
  }
  
  if (this.sessionType !== 'work' && this.duration > 60) {
    next(new Error('Break sessions cannot be longer than 60 minutes'));
    return;
  }
  
  next();
});

export default mongoose.models.Session || mongoose.model('Session', sessionSchema);