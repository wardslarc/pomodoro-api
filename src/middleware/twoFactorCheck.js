// middleware/twoFactorCheck.js
export const checkTwoFactorSetup = (req, res, next) => {
  if (req.user && 
      !req.user.twoFactorEnabled && 
      !req.user.twoFaPrompted &&
      !req.path.includes('/2fa') && // exclude 2FA routes
      !req.path.includes('/logout')) {
    
    return res.status(200).json({
      success: true,
      requiresTwoFactorSetup: true,
      message: 'Please set up two-factor authentication for enhanced security'
    });
  }
  next();
};