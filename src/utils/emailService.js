// src/utils/emailService.js
import nodemailer from 'nodemailer';
import logger from './logger.js';

const createTransporter = () => {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });
};

export const send2FACode = async (email, code) => {
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
    };

    await transporter.sendMail(mailOptions);
    logger.info(`✅ Verification code sent to ${email}`);
  } catch (error) {
    logger.error('❌ Error sending email:', error);
    throw new Error('Failed to send verification code');
  }
};

export const sendWelcomeEmail = async (user) => {
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
          <p>Thank you for joining Reflective Pomodoro! We're excited to help you boost your productivity with our Pomodoro technique app.</p>
          <p>Get started by creating your first Pomodoro session and track your productivity patterns.</p>
          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;">
          <p style="color: #64748b; font-size: 12px;">
            Reflective Pomodoro Team
          </p>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);
    logger.info(`✅ Welcome email sent to ${user.email}`);
  } catch (error) {
    logger.error('❌ Error sending welcome email:', error);
    // Don't throw error for welcome email - it shouldn't block registration
  }
};

// Optional: Add password reset email
export const sendPasswordResetEmail = async (user, resetToken) => {
  try {
    const transporter = createTransporter();
    const resetLink = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;

    const mailOptions = {
      from: `"Reflective Pomodoro" <${process.env.EMAIL_USER}>`,
      to: user.email,
      subject: 'Reset Your Password - Reflective Pomodoro',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #4F46E5;">Password Reset</h2>
          <p>Hello ${user.name},</p>
          <p>You requested to reset your password. Click the link below to create a new password:</p>
          <div style="text-align: center; margin: 20px 0;">
            <a href="${resetLink}" style="background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
              Reset Password
            </a>
          </div>
          <p>This link will expire in 1 hour.</p>
          <p>If you didn't request this reset, please ignore this email.</p>
          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;">
          <p style="color: #64748b; font-size: 12px;">
            Reflective Pomodoro Team
          </p>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);
    logger.info(`✅ Password reset email sent to ${user.email}`);
  } catch (error) {
    logger.error('❌ Error sending password reset email:', error);
    throw new Error('Failed to send password reset email');
  }
};