import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  password: {
    type: String,
    required: true,
    minlength: 6,
    select: false // Hide password by default
  },
  // 2FA Fields for Email-based verification
  is2FAEnabled: {
    type: Boolean,
    default: false
  },
  twoFACode: {
    type: String,
    select: false // Hide 2FA code by default
  },
  twoFAExpires: {
    type: Date,
    select: false // Hide expiration by default
  },
  // Add this field to track if user has been prompted for 2FA setup
  hasBeenPromptedFor2FA: {
    type: Boolean,
    default: false
  },
  // Original fields
  isActive: {
    type: Boolean,
    default: true
  },
  lastLogin: {
    type: Date
  }
}, {
  timestamps: true
});

userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

userSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

userSchema.methods.toJSON = function() {
  const user = this.toObject();
  delete user.password;
  delete user.twoFACode;
  delete user.twoFAExpires;
  delete user.twoFASecret;
  delete user.tempTwoFASecret;
  return user;
};

export default mongoose.model('User', userSchema);