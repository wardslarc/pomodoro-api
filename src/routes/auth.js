import express from 'express';
import User from '../models/User.js';
import { validateLogin, validateSignup } from '../middleware/validation.js';
import { generateToken } from '../utils/auth.js';

const router = express.Router();

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
      return res.json({
        success: true,
        data: {
          requires2FA: true,
          email: user.email
        },
        message: '2FA verification required'
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

// 2FA routes
router.post('/verify-2fa', async (req, res, next) => {
  try {
    const { email, token } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // TODO: Implement actual 2FA verification
    const isTokenValid = true;

    if (!isTokenValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid 2FA token'
      });
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

router.post('/setup-2fa', async (req, res, next) => {
  try {
    const { userId } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // TODO: Implement actual 2FA setup
    const secret = 'generate-2fa-secret-here';
    const qrCodeUrl = 'generate-qr-code-url-here';

    user.twoFASecret = secret;
    user.hasBeenPromptedFor2FA = true;
    await user.save();

    res.json({
      success: true,
      data: {
        secret,
        qrCodeUrl,
        message: 'Scan the QR code with your authenticator app'
      },
      message: '2FA setup initiated'
    });
  } catch (error) {
    next(error);
  }
});

router.post('/enable-2fa', async (req, res, next) => {
  try {
    const { userId, token } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // TODO: Implement actual 2FA verification
    const isTokenValid = true;

    if (!isTokenValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid 2FA token'
      });
    }

    user.is2FAEnabled = true;
    await user.save();

    res.json({
      success: true,
      message: '2FA enabled successfully'
    });
  } catch (error) {
    next(error);
  }
});

export const authRoutes = router;