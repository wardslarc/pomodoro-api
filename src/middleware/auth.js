import { verifyToken } from '../utils/auth.js';
import User from '../models/User.js';

const auth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. No token provided.'
      });
    }

    const decoded = verifyToken(token);
    const user = await User.findById(decoded.userId).select('-password');
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Token is invalid. User not found.'
      });
    }

    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Account is deactivated.'
      });
    }

    // STANDARDIZED: Set both _id and id for consistency
    req.user = user;
    req.userId = user._id.toString(); // Always use this in routes
    
    // Ensure user object has both _id and id
    if (!user.id) {
      user.id = user._id.toString();
    }

    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'Token is invalid.'
    });
  }
};

export { auth };