const jwt = require('jsonwebtoken');
const config = require('../config/env');
const logger = require('./logger');

class TokenUtils {
  static generateToken(userId, payload = {}) {
    try {
      const tokenPayload = {
        id: userId,
        ...payload,
      };

      return jwt.sign(tokenPayload, config.jwt.secret, {
        expiresIn: config.jwt.expiresIn,
        issuer: 'pomodoro-app',
        subject: userId.toString(),
      });
    } catch (error) {
      logger.error('Token generation error:', error);
      throw new Error('Failed to generate token');
    }
  }

  static verifyToken(token) {
    try {
      return jwt.verify(token, config.jwt.secret);
    } catch (error) {
      logger.error('Token verification error:', error);
      
      if (error.name === 'TokenExpiredError') {
        throw new Error('Token expired');
      } else if (error.name === 'JsonWebTokenError') {
        throw new Error('Invalid token');
      } else {
        throw new Error('Token verification failed');
      }
    }
  }

  static decodeToken(token) {
    return jwt.decode(token);
  }

  static extractTokenFromHeader(authHeader) {
    if (!authHeader) return null;

    const parts = authHeader.split(' ');
    if (parts.length === 2 && parts[0] === 'Bearer') {
      return parts[1];
    }

    return null;
  }

  static isTokenExpiringSoon(token, thresholdMs = 5 * 60 * 1000) {
    try {
      const decoded = this.verifyToken(token);
      const now = Date.now();
      const exp = decoded.exp * 1000;
      
      return (exp - now) <= thresholdMs;
    } catch (error) {
      return true;
    }
  }
}

module.exports = TokenUtils;