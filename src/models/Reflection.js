import mongoose from 'mongoose';

const reflectionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  sessionId: {
    type: String,
    required: true,
    unique: true
  },
  learnings: {
    type: String,
    required: true,
    trim: true,
    maxlength: 2000
  }
}, {
  timestamps: true
});

reflectionSchema.index({ userId: 1, createdAt: -1 });
reflectionSchema.index({ sessionId: 1 }, { unique: true });

export default mongoose.model('Reflection', reflectionSchema);