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
    console.log('🔍 Registration attempt:', { email });

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
    console.log('✅ User registered:', user._id);

    // Send welcome email
    try {
      await sendWelcomeEmail(user);
      console.log('✅ Welcome email sent');
    } catch (emailError) {
      console.log('⚠️ Failed to send welcome email:', emailError.message);
      logger.error('Failed to send welcome email:', emailError);
    }

    // Generate and send first 2FA code
    const verificationCode = generateVerificationCode();
    console.log('🔑 Generated initial 2FA code:', verificationCode);
    
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
      console.log('✅ Initial 2FA code stored in Redis');

      // Send 2FA code
      await send2FACode(user.email, verificationCode);
      console.log('✅ Initial 2FA code sent to email');

    } catch (redisError) {
      console.log('❌ Redis error during registration:', redisError.message);
      logger.error('Redis error during registration:', redisError);
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
    console.log('❌ Registration error:', error.message);
    next(error);
  }
});

// Login route
router.post('/login', validateLogin, async (req, res, next) => {
  try {
    const { email, password } = req.body;
    console.log('🔍 Login attempt:', { email });

    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      console.log('❌ User not found:', email);
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      console.log('❌ Invalid password for user:', email);
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    if (!user.isActive) {
      console.log('❌ User account deactivated:', email);
      return res.status(401).json({
        success: false,
        message: 'Account is deactivated'
      });
    }

    console.log('✅ User authenticated, checking 2FA status:', { 
      email, 
      is2FAEnabled: user.is2FAEnabled 
    });

    // Check if 2FA is enabled
    if (user.is2FAEnabled) {
      console.log('🔐 2FA enabled, generating code for:', email);
      
      // Generate and send verification code
      const verificationCode = generateVerificationCode();
      console.log('🔑 Generated 2FA code:', verificationCode);
      
      try {
        console.log('💾 Storing 2FA code in Redis...');
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
        console.log('✅ 2FA code stored in Redis');

        // Send verification code via email
        console.log('📧 Sending 2FA code via email...');
        await send2FACode(user.email, verificationCode);
        console.log('✅ 2FA code sent to email:', user.email);
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
        console.log('❌ Redis error during 2FA setup:', redisError.message);
        logger.error('Redis error during 2FA setup:', redisError);
        return res.status(500).json({
          success: false,
          message: 'Unable to process 2FA request. Please try again.'
        });
      }
    }

    console.log('🔄 Auto-enabling 2FA for user:', email);
    // Auto-enable 2FA for old users
    user.is2FAEnabled = true;
    user.hasBeenPromptedFor2FA = true;
    await user.save();
    console.log('✅ 2FA enabled for user:', email);

    // Send welcome email
    try {
      await sendWelcomeEmail(user);
      console.log('✅ Welcome email sent');
    } catch (emailError) {
      console.log('⚠️ Failed to send welcome email:', emailError.message);
      logger.error('Failed to send welcome email:', emailError);
    }

    // Generate and send verification code
    const verificationCode = generateVerificationCode();
    console.log('🔑 Generated initial 2FA code:', verificationCode);
    
    try {
      console.log('💾 Storing initial 2FA code in Redis...');
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
      console.log('✅ Initial 2FA code stored in Redis');

      // Send 2FA code
      console.log('📧 Sending initial 2FA code via email...');
      await send2FACode(user.email, verificationCode);
      console.log('✅ Initial 2FA code sent to email');

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
      console.log('❌ Redis error sending initial 2FA code:', redisError.message);
      logger.error('Redis error sending 2FA code:', redisError);
      return res.status(500).json({
        success: false,
        message: 'Failed to send verification code. Please try again.'
      });
    }
    
  } catch (error) {
    console.log('❌ General login error:', error.message);
    next(error);
  }
});

// ✅ ESSENTIAL: 2FA Verification Route
router.post('/verify-2fa', async (req, res, next) => {
  try {
    const { email, code } = req.body;
    console.log('🔐 2FA Verification attempt:', { email });

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
    const storedData = await redisService.get(get2FAKey(email));
    
    if (!storedData) {
      return res.status(400).json({
        success: false,
        message: 'No verification code found. Please request a new code.'
      });
    }

    // Check failed attempts
    const failedAttempts = storedData.failedAttempts || 0;
    if (failedAttempts >= 3) {
      await redisService.delete(get2FAKey(email));
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
    console.log('❌ 2FA verification error:', error.message);
    next(error);
  }
});

// ✅ ESSENTIAL: Resend 2FA Code Route
router.post('/resend-2fa-code', async (req, res, next) => {
  try {
    const { email } = req.body;
    console.log('🔄 Resend 2FA code request:', { email });

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
    console.log('🔑 Generated new 2FA code:', verificationCode);
    
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
      console.log('✅ New 2FA code stored in Redis');

      // Send verification code via email
      await send2FACode(user.email, verificationCode);
      console.log('✅ New 2FA code sent to email:', user.email);
      logger.info(`Resent 2FA code to ${user.email}`);

      res.json({
        success: true,
        message: 'New verification code sent to your email'
      });
    } catch (redisError) {
      console.log('❌ Redis error resending 2FA code:', redisError.message);
      logger.error('Redis error resending 2FA code:', redisError);
      return res.status(500).json({
        success: false,
        message: 'Failed to send verification code. Please try again.'
      });
    }
  } catch (error) {
    console.log('❌ Resend 2FA code error:', error.message);
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
    console.log('❌ 2FA status check error:', error.message);
    next(error);
  }
});

// Logout route
router.post('/logout', auth, async (req, res, next) => {
  try {
    res.json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    console.log('❌ Logout error:', error.message);
    next(error);
  }
});

// Debug route to test Redis from auth routes
router.get('/test-redis', async (req, res) => {
  try {
    console.log('🔍 Testing Redis from auth routes...');
    
    // Test Redis operations
    await redisService.set('auth-test', { test: 'auth routes work', time: new Date() }, 60);
    const data = await redisService.get('auth-test');
    
    res.json({
      success: true,
      message: 'Redis working from auth routes',
      data: data
    });
  } catch (error) {
    console.log('❌ Auth Redis test failed:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export const authRoutes = router;