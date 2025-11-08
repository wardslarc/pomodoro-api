import express from 'express';
import User from '../models/User.js';
import { validateLogin, validateSignup } from '../middleware/validation.js';
import { generateToken } from '../utils/auth.js';
import { send2FACode, sendWelcomeEmail } from '../utils/emailService.js';
import logger from '../utils/logger.js';
import redisService from '../services/redisService.js'; // ADD THIS IMPORT

const router = express.Router();

// Generate random 6-digit code
const generateVerificationCode = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Redis key helper
const get2FAKey = (email) => `2fa:${email}`;

// Login route - UPDATED
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
      
      try {
        // Store code in Redis with expiration (10 minutes)
        await redisService.set(
          get2FAKey(user.email), 
          {
            code: verificationCode,
            userId: user._id.toString(),
            createdAt: new Date().toISOString(),
            failedAttempts: 0
          },
          600 // 10 minutes in seconds
        );

        // Send verification code via email
        await send2FACode(user.email, verificationCode);
        logger.info(`2FA code sent to ${user.email}`);

        return res.json({
          success: true,
          data: {
            requires2FA: true,
            email: user.email,
            method: 'email'
          },
          message: 'Verification code sent to your email'
        });
      } catch (redisError) {
        logger.error('Redis error during 2FA setup:', redisError);
        return res.status(500).json({
          success: false,
          message: 'Unable to process 2FA request. Please try again.'
        });
      }
    }

    // Auto-enable 2FA for old users (your existing logic)
    user.is2FAEnabled = true;
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
    
    try {
      await redisService.set(
        get2FAKey(user.email),
        {
          code: verificationCode,
          userId: user._id.toString(),
          createdAt: new Date().toISOString(),
          failedAttempts: 0
        },
        600
      );

      // Send 2FA code
      await send2FACode(user.email, verificationCode);
    } catch (redisError) {
      logger.error('Redis error sending 2FA code:', redisError);
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

// 2FA Verification route - UPDATED
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

    // Check if verification code exists in Redis
    let storedData;
    try {
      storedData = await redisService.get(get2FAKey(email));
    } catch (redisError) {
      logger.error('Redis error during 2FA verification:', redisError);
      return res.status(500).json({
        success: false,
        message: 'Unable to verify code. Please try again.'
      });
    }
    
    if (!storedData) {
      return res.status(400).json({
        success: false,
        message: 'No verification code found. Please request a new code.'
      });
    }

    // Check failed attempts
    const failedAttempts = storedData.failedAttempts || 0;
    if (failedAttempts >= 3) {
      try {
        await redisService.delete(get2FAKey(email));
      } catch (error) {
        logger.error('Error deleting expired 2FA code:', error);
      }
      return res.status(400).json({
        success: false,
        message: 'Too many failed attempts. Please request a new code.'
      });
    }

    if (storedData.code !== code) {
      // Track failed attempts
      try {
        await redisService.set(
          get2FAKey(email),
          {
            ...storedData,
            failedAttempts: failedAttempts + 1,
            lastAttempt: new Date().toISOString()
          },
          600 // Keep same expiration
        );
      } catch (error) {
        logger.error('Error updating failed attempts:', error);
      }
      
      return res.status(401).json({
        success: false,
        message: 'Invalid verification code'
      });
    }

    // Code is valid - clear it from Redis and proceed with login
    try {
      await redisService.delete(get2FAKey(email));
    } catch (error) {
      logger.error('Error deleting used 2FA code:', error);
    }

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

// Resend 2FA code - UPDATED
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
    
    try {
      // Store in Redis
      await redisService.set(
        get2FAKey(user.email),
        {
          code: verificationCode,
          userId: user._id.toString(),
          createdAt: new Date().toISOString(),
          failedAttempts: 0
        },
        600 // 10 minutes
      );

      // Send verification code via email
      await send2FACode(user.email, verificationCode);
      logger.info(`Resent 2FA code to ${user.email}`);

      res.json({
        success: true,
        message: 'New verification code sent to your email'
      });
    } catch (redisError) {
      logger.error('Redis error resending 2FA code:', redisError);
      return res.status(500).json({
        success: false,
        message: 'Failed to send verification code. Please try again.'
      });
    }
  } catch (error) {
    next(error);
  }
});

// Export routes
export const authRoutes = router;