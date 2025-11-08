import express from 'express';
import User from '../models/User.js';
import { validateLogin, validateSignup } from '../middleware/validation.js';
import { generateToken } from '../utils/auth.js';
import { send2FACode, sendWelcomeEmail } from '../utils/emailService.js';
import logger from '../utils/logger.js';
import redisService from '../services/redisService.js';

const router = express.Router();

// Generate random 6-digit code
const generateVerificationCode = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Redis key helper
const get2FAKey = (email) => `2fa:${email}`;

// Login route - UPDATED WITH DETAILED LOGGING
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
        console.log('❌ Redis error during 2FA setup:', redisError.message, redisError.code);
        logger.error('Redis error during 2FA setup:', { 
          message: redisError.message, 
          code: redisError.code,
          stack: redisError.stack 
        });
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
      console.log('❌ Redis error sending initial 2FA code:', redisError.message, redisError.code);
      logger.error('Redis error sending 2FA code:', { 
        message: redisError.message, 
        code: redisError.code 
      });
      return res.status(500).json({
        success: false,
        message: 'Failed to send verification code. Please try again.'
      });
    }
    
  } catch (error) {
    console.log('❌ General login error:', error.message, error.stack);
    next(error);
  }
});

// Add a simple test endpoint to verify Redis is working
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
    console.log('❌ Auth Redis test failed:', error.message, error.code);
    res.status(500).json({
      success: false,
      error: error.message,
      code: error.code
    });
  }
});

export const authRoutes = router;