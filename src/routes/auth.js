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
}, 60 * 60 * 1000); // Run every hour

// Login route - UPDATED (Auto-enable 2FA for old users on first login)
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
      console.log(`🔐 User ${email} has 2FA enabled, sending code...`);
      
      // Generate and send verification code
      const verificationCode = generateVerificationCode();
      
      // Store code with expiration (10 minutes)
      verificationCodes.set(user.email, {
        code: verificationCode,
        expiresAt: Date.now() + 10 * 60 * 1000, // 10 minutes
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

    // ✅ FOR OLD USERS: Auto-enable 2FA and send welcome email
    console.log(`🔐 Old user ${email} - auto-enabling 2FA...`);
    
    // Auto-enable 2FA for this user
    user.is2FAEnabled = true;
    user.twoFAMethod = 'email';
    user.hasBeenPromptedFor2FA = true;
    await user.save();
    
    console.log(`✅ 2FA auto-enabled for ${email}`);

    // Send welcome email (not setup instructions)
    try {
      await sendWelcomeEmail(user);
      console.log('✅ Welcome email sent to:', user.email);
    } catch (emailError) {
      console.error('Failed to send welcome email:', emailError);
      // Don't block login if email fails
    }

    // Generate and send verification code (since 2FA is now enabled)
    const verificationCode = generateVerificationCode();
    
    // Store code with expiration (10 minutes)
    verificationCodes.set(user.email, {
      code: verificationCode,
      expiresAt: Date.now() + 10 * 60 * 1000,
      userId: user._id.toString()
    });

    // Send actual 2FA code (not setup instructions)
    try {
      await send2FACode(user.email, verificationCode);
      console.log('✅ 2FA code sent to:', user.email);
    } catch (emailError) {
      console.error('Failed to send 2FA code:', emailError);
      return res.status(500).json({
        success: false,
        message: 'Failed to send verification code. Please try again.'
      });
    }

    // Return that 2FA is required (since we just enabled it)
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

// Register route - UPDATED (Auto-enable 2FA for new users)
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
      is2FAEnabled: true, // ✅ Auto-enable 2FA
      twoFAMethod: 'email', // ✅ Set 2FA method
      hasBeenPromptedFor2FA: true // ✅ Mark as prompted
    });

    await user.save();

    // ✅ Send welcome email
    try {
      await sendWelcomeEmail(user);
      console.log('✅ Welcome email sent to new user:', email);
    } catch (emailError) {
      console.error('Failed to send welcome email:', emailError);
      // Don't block registration if email fails
    }

    // Generate and send first 2FA code
    const verificationCode = generateVerificationCode();
    
    // Store code with expiration (10 minutes)
    verificationCodes.set(user.email, {
      code: verificationCode,
      expiresAt: Date.now() + 10 * 60 * 1000,
      userId: user._id.toString()
    });

    // Send 2FA code
    try {
      await send2FACode(user.email, verificationCode);
      console.log('✅ 2FA code sent to new user:', email);
    } catch (emailError) {
      console.error('Failed to send 2FA code:', emailError);
      // Don't block registration if email fails
    }

    const token = generateToken(user._id);

    res.status(201).json({
      success: true,
      data: {
        user: {
          _id: user._id,
          name: user.name,
          email: user.email,
          createdAt: user.createdAt,
          is2FAEnabled: user.is2FAEnabled
        },
        token
      },
      message: 'User registered successfully. Two-factor authentication is enabled for your account.'
    });
  } catch (error) {
    next(error);
  }
});

// 2FA Verification route (for email codes)
router.post('/verify-2fa', async (req, res, next) => {
  try {
    console.log('🔐 2FA Verification Request:', {
      body: req.body,
      headers: req.headers
    });

    const { email, code, token } = req.body; // Accept both code and token

    // Use either code or token (frontend compatibility)
    const verificationCode = code || token;
    
    console.log('📧 Email:', email);
    console.log('🔐 Code from request:', code);
    console.log('🔐 Token from request:', token);
    console.log('🔐 Using verification code:', verificationCode);

    if (!email || !verificationCode) {
      console.log('❌ Missing email or verification code');
      return res.status(400).json({
        success: false,
        message: 'Email and verification code are required'
      });
    }

    const user = await User.findOne({ email });
    if (!user) {
      console.log('❌ User not found:', email);
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    if (!user.is2FAEnabled) {
      console.log('❌ 2FA not enabled for user:', email);
      return res.status(400).json({
        success: false,
        message: '2FA is not enabled for this account'
      });
    }

    // Check if verification code exists and is valid
    const storedCode = verificationCodes.get(email);
    
    if (!storedCode) {
      console.log('❌ No stored code found for:', email);
      return res.status(400).json({
        success: false,
        message: 'No verification code found. Please request a new code.'
      });
    }

    console.log('🔐 Stored code:', storedCode.code);
    console.log('⏰ Code expires at:', new Date(storedCode.expiresAt).toISOString());
    console.log('⏰ Current time:', new Date().toISOString());

    if (Date.now() > storedCode.expiresAt) {
      verificationCodes.delete(email);
      console.log('❌ Code expired for:', email);
      return res.status(400).json({
        success: false,
        message: 'Verification code has expired. Please request a new code.'
      });
    }

    if (storedCode.code !== verificationCode) {
      // Track failed attempts
      const failedAttempts = storedCode.failedAttempts || 0;
      console.log(`❌ Invalid code attempt ${failedAttempts + 1} for:`, email);
      
      if (failedAttempts >= 3) {
        verificationCodes.delete(email);
        console.log('❌ Too many failed attempts for:', email);
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

    console.log('✅ 2FA verification successful for:', email);

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
    console.error('❌ 2FA verification error:', error);
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
    
    // Store code with expiration (10 minutes)
    verificationCodes.set(user.email, {
      code: verificationCode,
      expiresAt: Date.now() + 10 * 60 * 1000, // 10 minutes
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