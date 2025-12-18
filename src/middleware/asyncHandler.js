/**
 * Higher-order function to wrap async route handlers
 * Catches errors and passes them to the error handler middleware
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

export default asyncHandler;
