// src/utils/emailService.js
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Validate environment variables
function validateEmailConfig() {
  const requiredEnvVars = ['EMAIL_USER', 'EMAIL_PASS'];
  const missing = requiredEnvVars.filter(key => !process.env[key]);
  return missing.length === 0;
}

// Initialize validation
const isEmailConfigured = validateEmailConfig();

const createTransporter = () => {
  if (!isEmailConfigured) {
    throw new Error('Email service not configured');
  }

  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    }
  });
};

export const send2FACode = async (email, code) => {
  if (!isEmailConfigured) {
    throw new Error('Email service not configured');
  }

  if (!email || !code) {
    throw new Error('Email and verification code are required');
  }

  try {
    const transporter = createTransporter();

    const mailOptions = {
      from: `"Reflective Pomodoro" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'Your Verification Code - Reflective Pomodoro',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #4F46E5;">Email Verification</h2>
          <p>Hello,</p>
          <p>Your verification code for Reflective Pomodoro is:</p>
          <div style="background: #f8fafc; border: 2px dashed #e2e8f0; padding: 20px; text-align: center; margin: 20px 0;">
            <h1 style="color: #4F46E5; font-size: 32px; letter-spacing: 8px; margin: 0;">${code}</h1>
          </div>
          <p>This code will expire in 10 minutes.</p>
          <p>If you didn't request this code, please ignore this email.</p>
          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;">
          <p style="color: #64748b; font-size: 12px;">
            Reflective Pomodoro Team
          </p>
        </div>
      `,
      text: `Your verification code is: ${code}. This code will expire in 10 minutes.`
    };

    const result = await transporter.sendMail(mailOptions);
    
    return {
      success: true,
      messageId: result.messageId
    };
    
  } catch (error) {
    throw new Error('Failed to send verification code');
  }
};

export const sendWelcomeEmail = async (user) => {
  if (!isEmailConfigured) {
    return;
  }

  try {
    const transporter = createTransporter();

    const mailOptions = {
      from: `"Reflective Pomodoro" <${process.env.EMAIL_USER}>`,
      to: user.email,
      subject: 'Welcome to Reflective Pomodoro!',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #4F46E5;">Welcome to Reflective Pomodoro!</h2>
          <p>Hello ${user.name},</p>
          <p>Welcome to Reflective Pomodoro! We're excited to have you on board.</p>
          <p>Your account security is important to us. Two-factor authentication has been enabled for your account to keep your data safe.</p>
          <div style="background: #f0f9ff; border-left: 4px solid #4F46E5; padding: 16px; margin: 20px 0;">
            <h3 style="color: #4F46E5; margin-top: 0;">What to expect:</h3>
            <ul>
              <li>You'll receive verification codes via email when logging in</li>
              <li>Each code expires in 10 minutes for security</li>
              <li>Check your spam folder if you don't see the emails</li>
            </ul>
          </div>
          <p>Get started by creating your first Pomodoro session and track your productivity patterns.</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${process.env.FRONTEND_URL || 'https://reflectivepomodoro.com'}" style="background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
              Get Started
            </a>
          </div>
          <p>If you have any questions, please don't hesitate to contact our support team.</p>
          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;">
          <p style="color: #64748b; font-size: 12px;">
            Reflective Pomodoro Team
          </p>
        </div>
      `,
      text: `
        Welcome to Reflective Pomodoro!
        
        Hello ${user.name},
        
        Welcome to Reflective Pomodoro! We're excited to have you on board.
        
        Your account security is important to us. Two-factor authentication has been enabled for your account to keep your data safe.
        
        What to expect:
        - You'll receive verification codes via email when logging in
        - Each code expires in 10 minutes for security
        - Check your spam folder if you don't see the emails
        
        Get started by creating your first Pomodoro session and track your productivity patterns.
        
        Get Started: ${process.env.FRONTEND_URL || 'https://reflectivepomodoro.com'}
        
        If you have any questions, please don't hesitate to contact our support team.
        
        Reflective Pomodoro Team
      `
    };

    await transporter.sendMail(mailOptions);
    
  } catch (error) {
    // Silent fail for welcome emails
  }
};

export default {
  send2FACode,
  sendWelcomeEmail
};