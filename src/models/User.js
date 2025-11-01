import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },

    password: {
      type: String,
      required: true,
      minlength: 6,
      select: false, // Hide password by default
    },

    /** 2FA (Email-based) Fields **/
    is2FAEnabled: {
      type: Boolean,
      default: false,
    },

    twoFACode: {
      type: String,
      select: false, // Hide code by default
    },

    twoFAExpires: {
      type: Date,
      select: false,
    },

    hasBeenPromptedFor2FA: {
      type: Boolean,
      default: false,
    },

    /** Account Management **/
    isActive: {
      type: Boolean,
      default: true,
    },

    lastLogin: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

/** 🔐 Hash password before saving **/
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();

  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

/** 🧩 Compare password **/
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

/** 🧹 Clean sensitive data before sending to client **/
userSchema.methods.toJSON = function () {
  const user = this.toObject();
  delete user.password;
  delete user.twoFACode;
  delete user.twoFAExpires;
  delete user.__v;
  return user;
};

export default mongoose.model('User', userSchema);
