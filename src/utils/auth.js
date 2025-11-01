import jwt from 'jsonwebtoken';
import crypto from 'crypto';

const JWT_SECRET = process.env.JWT_SECRET || 'your-fallback-secret-key-change-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

export function generateToken(userId) {
  return jwt.sign(
    { userId },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

export function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    throw new Error('Invalid token');
  }
}

export function decodeToken(token) {
  try {
    return jwt.decode(token);
  } catch (error) {
    return null;
  }
}

// Optional: Token refresh function
export function refreshToken(token) {
  try {
    const decoded = verifyToken(token);
    return generateToken(decoded.userId);
  } catch (error) {
    throw new Error('Cannot refresh invalid token');
  }
}

// 2FA Functions
export function generate2FACode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export function generate2FASecret() {
  return crypto.randomBytes(20).toString('hex');
}

export function is2FACodeExpired(expiresAt) {
  return new Date() > new Date(expiresAt);
}