import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import Settings from '../models/Settings.js';
import asyncHandler from '../middleware/asyncHandler.js';
import ApiResponse from '../utils/apiResponse.js';
import logger from '../utils/logger.js';

const generateToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN
  });
};

/**
 * Register a new user
 * POST /api/auth/register
 */
export const register = asyncHandler(async (req, res) => {
  const { name, email, password } = req.body;

  const existingUser = await User.findOne({ email });
  if (existingUser) {
    logger.warn('Registration attempt with existing email', { email });
    return res.status(400).json(ApiResponse.error('User already exists with this email'));
  }

  const user = await User.create({ name, email, password });
  await Settings.createDefaultSettings(user._id);

  const token = generateToken(user._id);
  const userResponse = user.toObject();
  delete userResponse.password;

  logger.info('New user registered', { userId: user._id, email });

  res.status(201).json(
    ApiResponse.success('User registered successfully', { user: userResponse, token })
  );
});

/**
 * User login
 * POST /api/auth/login
 */
export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email }).select('+password');
  if (!user || !(await user.comparePassword(password))) {
    logger.warn('Failed login attempt', { email });
    return res.status(401).json(ApiResponse.error('Invalid email or password'));
  }

  if (!user.isActive) {
    logger.warn('Login attempt with deactivated account', { userId: user._id });
    return res.status(401).json(ApiResponse.error('Account is deactivated'));
  }

  user.lastLogin = new Date();
  await user.save();

  const token = generateToken(user._id);
  const userResponse = user.toObject();
  delete userResponse.password;

  logger.info('User login successful', { userId: user._id });

  res.json(
    ApiResponse.success('Login successful', { user: userResponse, token })
  );
});

/**
 * Get user profile
 * GET /api/auth/profile
 */
export const getProfile = asyncHandler(async (req, res) => {
  res.json(
    ApiResponse.success('Profile retrieved', { user: req.user })
  );
});

/**
 * Update user profile
 * PUT /api/auth/profile
 */
export const updateProfile = asyncHandler(async (req, res) => {
  const { name } = req.body;
  
  const user = await User.findByIdAndUpdate(
    req.user.id,
    { name },
    { new: true, runValidators: true }
  );

  logger.info('User profile updated', { userId: user._id });

  res.json(
    ApiResponse.success('Profile updated successfully', { user })
  );
});