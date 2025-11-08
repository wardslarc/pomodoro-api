import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import config from '../config/config.js'; // Updated import path
import logger from './logger.js';

export function generateToken(userId) {
  return jwt.sign(
    { userId },
    config.jwt.secret,
    { 
      expiresIn: config.jwt.expiresIn,
      issuer: 'reflective-pomodoro',
      audience: 'reflective-pomodoro-users'
    }
  );
}

export function verifyToken(token) {
  try {
    return jwt.verify(token, config.jwt.secret, {
      issuer: 'reflective-pomodoro',
      audience: 'reflective-pomodoro-users'
    });
  } catch (error) {
    logger.error('Token verification failed:', error);
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