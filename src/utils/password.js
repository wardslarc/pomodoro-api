import bcrypt from 'bcryptjs';
import config from '../config/env.js';
import logger from './logger.js';

class PasswordUtils {
  static async hashPassword(password) {
    try {
      if (!password || typeof password !== 'string') {
        throw new Error('Password must be a non-empty string');
      }

      if (password.length < 6) {
        throw new Error('Password must be at least 6 characters long');
      }

      const salt = await bcrypt.genSalt(config.bcrypt.rounds);
      return await bcrypt.hash(password, salt);
    } catch (error) {
      logger.error('Password hashing error:', error);
      throw new Error('Failed to hash password');
    }
  }

  static async comparePassword(password, hashedPassword) {
    try {
      if (!password || !hashedPassword) {
        return false;
      }

      return await bcrypt.compare(password, hashedPassword);
    } catch (error) {
      logger.error('Password comparison error:', error);
      return false;
    }
  }

  static validatePasswordStrength(password) {
    const requirements = {
      minLength: password.length >= 6,
      hasUpperCase: /[A-Z]/.test(password),
      hasLowerCase: /[a-z]/.test(password),
      hasNumbers: /\d/.test(password),
      hasSpecialChar: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password),
    };

    const isValid = Object.values(requirements).every(Boolean);
    const score = Object.values(requirements).filter(Boolean).length;

    return {
      isValid,
      score,
      requirements,
      strength: score >= 5 ? 'strong' : score >= 3 ? 'medium' : 'weak',
    };
  }

  static generateRandomPassword(length = 12) {
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
    let password = '';
    
    for (let i = 0; i < length; i++) {
      const randomIndex = Math.floor(Math.random() * charset.length);
      password += charset[randomIndex];
    }
    
    return password;
  }
}

export default PasswordUtils;