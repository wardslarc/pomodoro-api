// src/utils/emailService.js
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Simple console logger for debugging
const logger = {
  info: (message, meta) => console.log(`ℹ️ ${message}`, meta || ''),
  error: (message, error) => console.error(`❌ ${message}`, error || ''),
  warn: (message) => console.warn(`⚠️ ${message}`)
};

// Validate environment variables
function validateEmailConfig() {
  const requiredEnvVars = ['EMAIL_USER', 'EMAIL_PASS'];
  const missing = requiredEnvVars.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    logger.error(`Missing email environment variables: ${missing.join(', ')}`);
    console.log('\n🔧 QUICK FIX:');
    console.log('1. Create a .env file in your project root');
    console.log('2. Add these lines:');
    console.log('   EMAIL_USER=your-email@gmail.com');
    console.log('   EMAIL_PASS=your-16-character-app-password');
    console.log('3. Get app password: Google Account → Security → App passwords\n');
    return false;
  }
  
  logger.info('Email environment variables are configured');
  console.log(`📧 Email user: ${process.env.EMAIL_USER}`);
  console.log(`🔑 Email pass: ${'*'.repeat(process.env.EMAIL_PASS.length)} (${process.env.EMAIL_PASS.length} chars)`);
  
  return true;
}

// Initialize validation
const isEmailConfigured = validateEmailConfig();

const createTransporter = () => {
  if (!isEmailConfigured) {
    throw new Error('Email service not configured. Check .env file');
  }

  // ✅ FIX: Use createTransport (not createTransporter)
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
    debug: true,
    logger: true
  });

  return transporter;
};

export const send2FACode = async (email, code) => {
  // Early validation
  if (!isEmailConfigured) {
    throw new Error('Email service not configured. Please set EMAIL_USER and EMAIL_PASS in .env file');
  }

  if (!email || !code) {
    throw new Error('Email and verification code are required');
  }

  let transporter;
  
  try {
    console.log('\n📧 === SENDING 2FA EMAIL ===');
    console.log(`To: ${email}`);
    console.log(`Code: ${code}`);
    console.log(`From: ${process.env.EMAIL_USER}`);

    transporter = createTransporter();

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

    console.log('📤 Attempting to send email...');
    const result = await transporter.sendMail(mailOptions);
    
    console.log('✅ Email sent successfully!');
    console.log(`📨 Message ID: ${result.messageId}`);
    console.log(`🤖 Response: ${result.response}`);
    
    return {
      success: true,
      messageId: result.messageId
    };
    
  } catch (error) {
    console.error('\n❌ EMAIL SENDING FAILED:');
    console.error(`Error: ${error.message}`);
    
    if (error.code === 'EAUTH') {
      console.log('\n🔐 AUTHENTICATION ISSUE DETECTED:');
      console.log('1. Make sure you are using an APP PASSWORD (16 characters)');
      console.log('2. Enable 2FA on your Gmail account');
      console.log('3. Generate new app password: Google Account → Security → App passwords');
      console.log('4. Update your .env file with the new app password');
    }
    
    throw new Error(`Failed to send email: ${error.message}`);
  } finally {
    if (transporter) {
      transporter.close();
    }
  }
};

export const sendWelcomeEmail = async (user) => {
  if (!isEmailConfigured) {
    logger.warn('Email not configured - skipping welcome email');
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
          <p>Thank you for joining Reflective Pomodoro!</p>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);
    console.log(`✅ Welcome email sent to ${user.email}`);
  } catch (error) {
    console.error('Error sending welcome email:', error);
  }
};

// Test function
export const testEmailService = async () => {
  console.log('\n🧪 === TESTING EMAIL SERVICE ===');
  
  if (!isEmailConfigured) {
    console.log('❌ Test failed: Email not configured');
    return { success: false, error: 'Email not configured' };
  }

  try {
    const testEmail = 'cralsdale@gmail.com';
    const testCode = '123456';
    
    console.log(`Testing with email: ${testEmail}`);
    console.log(`Using sender: ${process.env.EMAIL_USER}`);
    
    const result = await send2FACode(testEmail, testCode);
    
    console.log('\n🎉 EMAIL SERVICE TEST PASSED!');
    console.log('✅ Check your email inbox (and spam folder)');
    
    return { success: true, messageId: result.messageId };
  } catch (error) {
    console.log('\n💥 EMAIL SERVICE TEST FAILED');
    return { success: false, error: error.message };
  }
};

export default {
  send2FACode,
  sendWelcomeEmail,
  testEmailService,
  isEmailConfigured
};