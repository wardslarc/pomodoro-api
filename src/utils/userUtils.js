/**
 * Utility functions for consistent user ID handling
 */

/**
 * Get user ID from request object consistently
 * @param {Object} req - Express request object
 * @returns {string} User ID
 */
export const getUserId = (req) => {
  // Priority: req.userId > req.user.id > req.user._id
  if (req.userId) {
    return req.userId;
  }
  
  if (req.user?.id) {
    return req.user.id;
  }
  
  if (req.user?._id) {
    return req.user._id.toString();
  }
  
  throw new Error('User ID not found in request');
};

/**
 * Ensure user ID is consistently formatted as string
 * @param {string|ObjectId} userId - User ID to normalize
 * @returns {string} Normalized user ID
 */
export const normalizeUserId = (userId) => {
  if (!userId) {
    throw new Error('User ID is required');
  }
  
  return userId.toString();
};

/**
 * Compare two user IDs for equality
 * @param {string|ObjectId} id1 - First user ID
 * @param {string|ObjectId} id2 - Second user ID
 * @returns {boolean} True if IDs are equal
 */
export const compareUserIds = (id1, id2) => {
  return normalizeUserId(id1) === normalizeUserId(id2);
};

export default {
  getUserId,
  normalizeUserId,
  compareUserIds
};