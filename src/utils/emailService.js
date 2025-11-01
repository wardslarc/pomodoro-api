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
  console.log(`🔑 Email pass: ${'*'.repeat(process.env.EMAIL_PASS?.length || 0)} (${process.env.EMAIL_PASS?.length || 0} chars)`);
  
  return true;
}

// Initialize validation
const isEmailConfigured = validateEmailConfig();

const createTransporter = () => {
  if (!isEmailConfigured) {
    throw new Error('Email service not configured. Check .env file');
  }

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

// ✅ ADDED: 2FA Setup Email Function
export const send2FASetupEmail = async (email, name) => {
  // Early validation
  if (!isEmailConfigured) {
    throw new Error('Email service not configured. Please set EMAIL_USER and EMAIL_PASS in .env file');
  }

  if (!email || !name) {
    throw new Error('Email and name are required');
  }

  let transporter;
  
  try {
    console.log('\n📧 === SENDING 2FA SETUP EMAIL ===');
    console.log(`To: ${email}`);
    console.log(`Name: ${name}`);
    console.log(`From: ${process.env.EMAIL_USER}`);

    transporter = createTransporter();

    const mailOptions = {
      from: `"Reflective Pomodoro" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'Set Up Two-Factor Authentication - Reflective Pomodoro',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #4F46E5;">Enable Two-Factor Authentication</h2>
          <p>Hello ${name},</p>
          <p>To enhance your account security, we now require two-factor authentication (2FA) for all users.</p>
          
          <div style="background: #f0f9ff; border-left: 4px solid #4F46E5; padding: 16px; margin: 20px 0;">
            <h3 style="color: #4F46E5; margin-top: 0;">How to enable 2FA:</h3>
            <ol>
              <li>Complete your login on the Reflective Pomodoro app</li>
              <li>Click "Enable Two-Factor Authentication" when prompted</li>
              <li>You'll receive verification codes via email for future logins</li>
            </ol>
          </div>
          
          <p>This extra security step helps protect your account from unauthorized access.</p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${process.env.FRONTEND_URL || 'https://reflectivepomodoro.com'}" style="background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
              Go to Reflective Pomodoro
            </a>
          </div>
          
          <p>If you have any questions, please contact our support team.</p>
          
          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;">
          <p style="color: #64748b; font-size: 12px;">
            Reflective Pomodoro Team
          </p>
        </div>
      `,
      text: `
        Enable Two-Factor Authentication - Reflective Pomodoro
        
        Hello ${name},
        
        To enhance your account security, we now require two-factor authentication (2FA) for all users.
        
        How to enable 2FA:
        1. Complete your login on the Reflective Pomodoro app
        2. Click "Enable Two-Factor Authentication" when prompted  
        3. You'll receive verification codes via email for future logins
        
        This extra security step helps protect your account from unauthorized access.
        
        Go to: ${process.env.FRONTEND_URL || 'https://reflectivepomodoro.com'}
        
        If you have any questions, please contact our support team.
        
        Reflective Pomodoro Team
      `
    };

    console.log('📤 Attempting to send 2FA setup email...');
    const result = await transporter.sendMail(mailOptions);
    
    console.log('✅ 2FA setup email sent successfully!');
    console.log(`📨 Message ID: ${result.messageId}`);
    
    return {
      success: true,
      messageId: result.messageId
    };
    
  } catch (error) {
    console.error('\n❌ 2FA SETUP EMAIL FAILED:');
    console.error(`Error: ${error.message}`);
    throw new Error(`Failed to send 2FA setup email: ${error.message}`);
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

// Test 2FA setup email
export const test2FASetupEmail = async () => {
  console.log('\n🧪 === TESTING 2FA SETUP EMAIL ===');
  
  if (!isEmailConfigured) {
    console.log('❌ Test failed: Email not configured');
    return { success: false, error: 'Email not configured' };
  }

  try {
    const testEmail = 'cralsdale@gmail.com';
    const testName = 'Test User';
    
    console.log(`Testing with email: ${testEmail}`);
    console.log(`Using sender: ${process.env.EMAIL_USER}`);
    
    const result = await send2FASetupEmail(testEmail, testName);
    
    console.log('\n🎉 2FA SETUP EMAIL TEST PASSED!');
    console.log('✅ Check your email for setup instructions');
    
    return { success: true, messageId: result.messageId };
  } catch (error) {
    console.log('\n💥 2FA SETUP EMAIL TEST FAILED');
    return { success: false, error: error.message };
  }
};

export default {
  send2FACode,
  send2FASetupEmail, // ✅ Added this export
  sendWelcomeEmail,
  testEmailService,
  test2FASetupEmail, // ✅ Added this export
  isEmailConfigured
};