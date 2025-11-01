import express from 'express';
import User from '../models/User.js';
import { validateLogin, validateSignup } from '../middleware/validation.js';
import { generateToken } from '../utils/auth.js';
import { send2FACode } from '../utils/emailService.js';
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
        expiresAt: Date.now() + 10 * 60 * 1000, // 10 minutes
        userId: user._id.toString()
      });

      // Send verification code via email using your service
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

    // Check if user needs to be prompted for 2FA setup
    if (!user.is2FAEnabled && !user.hasBeenPromptedFor2FA) {
      const token = generateToken(user._id);
      
      return res.json({
        success: true,
        data: {
          requires2FASetup: true,
          user: {
            _id: user._id,
            name: user.name,
            email: user.email,
            createdAt: user.createdAt,
            is2FAEnabled: user.is2FAEnabled
          },
          token
        },
        message: 'Login successful. Please consider setting up two-factor authentication for enhanced security.'
      });
    }

    user.lastLogin = new Date();
    await user.save();

    const token = generateToken(user._id);

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
        token
      },
      message: 'Login successful'
    });
  } catch (error) {
    next(error);
  }
});

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

    const user = new User({
      name,
      email,
      password
    });

    await user.save();

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
      message: 'User registered successfully'
    });
  } catch (error) {
    next(error);
  }
});

// 2FA Verification route (for email codes) - UPDATED
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

// 🔐 2FA Send Code (for frontend compatibility)
router.post('/2fa/send-code', async (req, res, next) => {
  try {
    const { email } = req.body;

    console.log('📧 2FA Send Code request for:', email);

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

    // Generate verification code
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
      logger.info(`2FA code sent to ${user.email} via /2fa/send-code endpoint`);
    } catch (emailError) {
      logger.error('Failed to send 2FA code:', emailError);
      return res.status(500).json({
        success: false,
        message: 'Failed to send verification code. Please try again.'
      });
    }

    res.json({
      success: true,
      message: 'Verification code sent to your email'
    });
  } catch (error) {
    console.error('❌ 2FA send-code error:', error);
    next(error);
  }
});

// 🔐 2FA Verify (for frontend compatibility)
router.post('/2fa/verify', async (req, res, next) => {
  try {
    console.log('🔐 2FA Verify request (compatibility endpoint):', req.body);

    const { email, code, token } = req.body;
    const verificationCode = code || token;

    if (!email || !verificationCode) {
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

    if (storedCode.code !== verificationCode) {
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

    console.log('✅ 2FA verification successful (compatibility endpoint):', email);

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
    console.error('❌ 2FA verify error (compatibility endpoint):', error);
    next(error);
  }
});

// Enable Email 2FA
router.post('/enable-email-2fa', async (req, res, next) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required'
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Enable email-based 2FA
    user.is2FAEnabled = true;
    user.twoFAMethod = 'email';
    user.hasBeenPromptedFor2FA = true;
    await user.save();

    res.json({
      success: true,
      message: 'Email-based two-factor authentication enabled successfully'
    });
  } catch (error) {
    next(error);
  }
});

// Disable 2FA
router.post('/disable-2fa', async (req, res, next) => {
  try {
    const { userId, password } = req.body;

    if (!userId || !password) {
      return res.status(400).json({
        success: false,
        message: 'User ID and password are required'
      });
    }

    const user = await User.findById(userId).select('+password');
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Verify password before disabling 2FA
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid password'
      });
    }

    // Disable 2FA
    user.is2FAEnabled = false;
    user.twoFAMethod = undefined;
    await user.save();

    res.json({
      success: true,
      message: 'Two-factor authentication disabled successfully'
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