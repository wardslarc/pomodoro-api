import express from 'express';
import User from '../models/User.js';
import { validateLogin, validateSignup } from '../middleware/validation.js';
import { generateToken } from '../utils/auth.js';
import { send2FACode, sendWelcomeEmail } from '../utils/emailService.js';
import logger from '../utils/logger.js';
import redisService from '../services/redisService.js';
import { auth } from '../middleware/auth.js';

const router = express.Router();

// Generate random 6-digit code
const generateVerificationCode = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Redis key helper
const get2FAKey = (email) => `2fa:${email}`;

// Register route
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
      hasBeenPromptedFor2FA: true
    });

    await user.save();
    logger.info('User registered successfully', { userId: user._id });

    // Send welcome email
    try {
      await sendWelcomeEmail(user);
      logger.info('Welcome email sent successfully', { userId: user._id });
    } catch (emailError) {
      logger.error('Failed to send welcome email:', { 
        userId: user._id, 
        error: emailError.message 
      });
    }

    // Generate and send first 2FA code
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
        600
      );

      // Send 2FA code
      await send2FACode(user.email, verificationCode);
      logger.info('Initial 2FA code sent during registration', { userId: user._id });

    } catch (redisError) {
      logger.error('Redis error during registration:', { 
        userId: user._id, 
        error: redisError.message 
      });
    }

    // Return requires2FA instead of direct login
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
    logger.error('Registration error:', { error: error.message });
    next(error);
  }
});

// Login route
router.post('/login', validateLogin, async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      logger.warn('Login attempt failed - user not found', { email });
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      logger.warn('Login attempt failed - invalid password', { email, userId: user._id });
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    if (!user.isActive) {
      logger.warn('Login attempt failed - account deactivated', { email, userId: user._id });
      return res.status(401).json({
        success: false,
        message: 'Account is deactivated'
      });
    }

    logger.info('User authenticated successfully', { 
      email, 
      userId: user._id,
      is2FAEnabled: user.is2FAEnabled 
    });

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
        logger.info('2FA code sent for login', { userId: user._id });

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
        logger.error('Redis error during 2FA setup:', { 
          userId: user._id, 
          error: redisError.message 
        });
        return res.status(500).json({
          success: false,
          message: 'Unable to process 2FA request. Please try again.'
        });
      }
    }

    // Auto-enable 2FA for old users
    user.is2FAEnabled = true;
    user.hasBeenPromptedFor2FA = true;
    await user.save();

    // Send welcome email
    try {
      await sendWelcomeEmail(user);
      logger.info('Welcome email sent for existing user', { userId: user._id });
    } catch (emailError) {
      logger.error('Failed to send welcome email to existing user:', { 
        userId: user._id, 
        error: emailError.message 
      });
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
      logger.info('2FA code sent for auto-enabled 2FA', { userId: user._id });

      return res.json({
        success: true,
        data: {
          requires2FA: true,
          email: user.email,
          method: 'email'
        },
        message: 'Two-factor authentication has been enabled for your account. Verification code sent to your email.'
      });
    } catch (redisError) {
      logger.error('Redis error sending 2FA code for auto-enable:', { 
        userId: user._id, 
        error: redisError.message 
      });
      return res.status(500).json({
        success: false,
        message: 'Failed to send verification code. Please try again.'
      });
    }
    
  } catch (error) {
    logger.error('Login error:', { error: error.message });
    next(error);
  }
});

// 2FA Verification Route
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
      logger.warn('2FA verification failed - user not found', { email });
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    if (!user.is2FAEnabled) {
      logger.warn('2FA verification failed - 2FA not enabled', { userId: user._id });
      return res.status(400).json({
        success: false,
        message: '2FA is not enabled for this account'
      });
    }

    // Check if verification code exists in Redis
    const storedData = await redisService.get(get2FAKey(email));
    
    if (!storedData) {
      logger.warn('2FA verification failed - no code found', { userId: user._id });
      return res.status(400).json({
        success: false,
        message: 'No verification code found. Please request a new code.'
      });
    }

    // Check failed attempts
    const failedAttempts = storedData.failedAttempts || 0;
    if (failedAttempts >= 3) {
      await redisService.delete(get2FAKey(email));
      logger.warn('2FA verification failed - too many attempts', { userId: user._id });
      return res.status(400).json({
        success: false,
        message: 'Too many failed attempts. Please request a new code.'
      });
    }

    if (storedData.code !== code) {
      // Track failed attempts
      await redisService.set(
        get2FAKey(email),
        {
          ...storedData,
          failedAttempts: failedAttempts + 1,
          lastAttempt: new Date().toISOString()
        },
        600
      );
      
      logger.warn('2FA verification failed - invalid code', { 
        userId: user._id, 
        attempts: failedAttempts + 1 
      });
      
      return res.status(401).json({
        success: false,
        message: 'Invalid verification code'
      });
    }

    // Code is valid - clear it from Redis and proceed with login
    await redisService.delete(get2FAKey(email));

    user.lastLogin = new Date();
    await user.save();

    const authToken = generateToken(user._id);

    logger.info('2FA verification successful', { userId: user._id });

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
    logger.error('2FA verification error:', { error: error.message });
    next(error);
  }
});

// Resend 2FA Code Route
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
      logger.warn('Resend 2FA code failed - user not found', { email });
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    if (!user.is2FAEnabled) {
      logger.warn('Resend 2FA code failed - 2FA not enabled', { userId: user._id });
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
      logger.info('2FA code resent successfully', { userId: user._id });

      res.json({
        success: true,
        message: 'New verification code sent to your email'
      });
    } catch (redisError) {
      logger.error('Redis error resending 2FA code:', { 
        userId: user._id, 
        error: redisError.message 
      });
      return res.status(500).json({
        success: false,
        message: 'Failed to send verification code. Please try again.'
      });
    }
  } catch (error) {
    logger.error('Resend 2FA code error:', { error: error.message });
    next(error);
  }
});

// 2FA Status Check Route
router.get('/2fa-status', auth, async (req, res, next) => {
  try {
    res.json({
      success: true,
      data: {
        is2FAEnabled: req.user.is2FAEnabled,
        hasBeenPrompted: req.user.hasBeenPromptedFor2FA
      }
    });
  } catch (error) {
    logger.error('2FA status check error:', { 
      userId: req.user?._id, 
      error: error.message 
    });
    next(error);
  }
});

// Logout route
router.post('/logout', auth, async (req, res, next) => {
  try {
    logger.info('User logged out successfully', { userId: req.user._id });
    res.json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    logger.error('Logout error:', { 
      userId: req.user?._id, 
      error: error.message 
    });
    next(error);
  }
});

export const authRoutes = router;