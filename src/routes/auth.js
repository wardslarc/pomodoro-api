// src/routes/auth.js
import express from 'express';
import User from '../models/User.js';
import { validateLogin, validateSignup } from '../middleware/validation.js';
import { generateToken } from '../utils/auth.js';
import { send2FACode, sendWelcomeEmail } from '../utils/emailService.js';
import logger from '../utils/logger.js';

const router = express.Router();

// Generate random 6-digit code
const generateVerificationCode = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Store verification codes temporarily (in production, use Redis)
const verificationCodes = new Map();

// Clean up expired codes every hour
setInterval(() => {
  const now = Date.now();
  for (const [email, data] of verificationCodes.entries()) {
    if (now > data.expiresAt) {
      verificationCodes.delete(email);
    }
  }
}, 60 * 60 * 1000);

// Login route
router.post('/login', validateLogin, async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Account is deactivated'
      });
    }

    // Check if 2FA is enabled
    if (user.is2FAEnabled) {
      // Generate and send verification code
      const verificationCode = generateVerificationCode();
      
      // Store code with expiration (10 minutes)
      verificationCodes.set(user.email, {
        code: verificationCode,
        expiresAt: Date.now() + 10 * 60 * 1000,
        userId: user._id.toString()
      });

      // Send verification code via email
      try {
        await send2FACode(user.email, verificationCode);
        logger.info(`2FA code sent to ${user.email}`);
      } catch (emailError) {
        logger.error('Failed to send 2FA code:', emailError);
        return res.status(500).json({
          success: false,
          message: 'Failed to send verification code. Please try again.'
        });
      }

      return res.json({
        success: true,
        data: {
          requires2FA: true,
          email: user.email,
          method: 'email'
        },
        message: 'Verification code sent to your email'
      });
    }

    // Auto-enable 2FA for old users
    user.is2FAEnabled = true;
    user.twoFAMethod = 'email';
    user.hasBeenPromptedFor2FA = true;
    await user.save();

    // Send welcome email
    try {
      await sendWelcomeEmail(user);
    } catch (emailError) {
      logger.error('Failed to send welcome email:', emailError);
    }

    // Generate and send verification code
    const verificationCode = generateVerificationCode();
    
    verificationCodes.set(user.email, {
      code: verificationCode,
      expiresAt: Date.now() + 10 * 60 * 1000,
      userId: user._id.toString()
    });

    // Send 2FA code
    try {
      await send2FACode(user.email, verificationCode);
    } catch (emailError) {
      return res.status(500).json({
        success: false,
        message: 'Failed to send verification code. Please try again.'
      });
    }

    return res.json({
      success: true,
      data: {
        requires2FA: true,
        email: user.email,
        method: 'email'
      },
      message: 'Two-factor authentication has been enabled for your account. Verification code sent to your email.'
    });
    
  } catch (error) {
    next(error);
  }
});

// Register route - FIXED
router.post('/register', validateSignup, async (req, res, next) => {
  try {
    const { name, email, password } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User already exists with this email'
      });
    }

    // Create user with 2FA already enabled
    const user = new User({
      name,
      email,
      password,
      is2FAEnabled: true,
      twoFAMethod: 'email',
      hasBeenPromptedFor2FA: true
    });

    await user.save();

    // Send welcome email
    try {
      await sendWelcomeEmail(user);
    } catch (emailError) {
      logger.error('Failed to send welcome email:', emailError);
    }

    // Generate and send first 2FA code
    const verificationCode = generateVerificationCode();
    
    verificationCodes.set(user.email, {
      code: verificationCode,
      expiresAt: Date.now() + 10 * 60 * 1000,
      userId: user._id.toString()
    });

    // Send 2FA code
    try {
      await send2FACode(user.email, verificationCode);
    } catch (emailError) {
      logger.error('Failed to send 2FA code:', emailError);
    }

    // ✅ FIXED: Return requires2FA instead of direct login
    return res.json({
      success: true,
      data: {
        requires2FA: true,
        email: user.email,
        method: 'email'
      },
      message: 'Registration successful. Please check your email for the verification code to complete setup.'
    });

  } catch (error) {
    next(error);
  }
});

// 2FA Verification route
router.post('/verify-2fa', async (req, res, next) => {
  try {
    const { email, code } = req.body;

    if (!email || !code) {
      return res.status(400).json({
        success: false,
        message: 'Email and verification code are required'
      });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    if (!user.is2FAEnabled) {
      return res.status(400).json({
        success: false,
        message: '2FA is not enabled for this account'
      });
    }

    // Check if verification code exists and is valid
    const storedCode = verificationCodes.get(email);
    
    if (!storedCode) {
      return res.status(400).json({
        success: false,
        message: 'No verification code found. Please request a new code.'
      });
    }

    if (Date.now() > storedCode.expiresAt) {
      verificationCodes.delete(email);
      return res.status(400).json({
        success: false,
        message: 'Verification code has expired. Please request a new code.'
      });
    }

    if (storedCode.code !== code) {
      // Track failed attempts
      const failedAttempts = storedCode.failedAttempts || 0;
      if (failedAttempts >= 3) {
        verificationCodes.delete(email);
        return res.status(400).json({
          success: false,
          message: 'Too many failed attempts. Please request a new code.'
        });
      }
      
      verificationCodes.set(email, { ...storedCode, failedAttempts: failedAttempts + 1 });
      
      return res.status(401).json({
        success: false,
        message: 'Invalid verification code'
      });
    }

    // Code is valid - clear it and proceed with login
    verificationCodes.delete(email);

    user.lastLogin = new Date();
    await user.save();

    const authToken = generateToken(user._id);

    res.json({
      success: true,
      data: {
        user: {
          _id: user._id,
          name: user.name,
          email: user.email,
          createdAt: user.createdAt,
          is2FAEnabled: user.is2FAEnabled
        },
        token: authToken
      },
      message: '2FA verification successful'
    });
  } catch (error) {
    next(error);
  }
});

// Resend 2FA code
router.post('/resend-2fa-code', async (req, res, next) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required'
      });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    if (!user.is2FAEnabled) {
      return res.status(400).json({
        success: false,
        message: '2FA is not enabled for this account'
      });
    }

    // Generate new verification code
    const verificationCode = generateVerificationCode();
    
    verificationCodes.set(user.email, {
      code: verificationCode,
      expiresAt: Date.now() + 10 * 60 * 1000,
      userId: user._id.toString()
    });

    // Send verification code via email
    try {
      await send2FACode(user.email, verificationCode);
      logger.info(`Resent 2FA code to ${user.email}`);
    } catch (emailError) {
      logger.error('Failed to resend 2FA code:', emailError);
      return res.status(500).json({
        success: false,
        message: 'Failed to send verification code. Please try again.'
      });
    }

    res.json({
      success: true,
      message: 'New verification code sent to your email'
    });
  } catch (error) {
    next(error);
  }
});

// Logout route
router.post('/logout', async (req, res, next) => {
  try {
    res.json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    next(error);
  }
});

export const authRoutes = router;