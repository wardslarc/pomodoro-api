// middleware/twoFactorCheck.js

/**
 * Middleware to ensure user has set up 2FA before accessing protected routes.
 *
 * - Skips 2FA routes (setup, verify, disable) and logout
 * - Assumes `req.user` is set by your auth middleware (e.g., JWT verification)
 */
export const checkTwoFactorSetup = (req, res, next) => {
  // If no authenticated user, skip — handled by auth middleware
  if (!req.user) {
    return next();
  }

  const path = req.path.toLowerCase();

  // Exclude routes related to authentication or 2FA setup
  const excludedRoutes = [
    "/2fa",
    "/auth/logout",
    "/auth/login",
    "/auth/register",
  ];

  if (excludedRoutes.some((route) => path.includes(route))) {
    return next();
  }

  // Check if 2FA is not yet set up
  if (!req.user.twoFactorEnabled && !req.user.twoFaPrompted) {
    return res.status(200).json({
      success: true,
      requiresTwoFactorSetup: true,
      message: "Please set up two-factor authentication for enhanced security.",
    });
  }

  next();
};
