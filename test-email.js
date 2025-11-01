// test-email.js (in your project root)
import dotenv from 'dotenv';
dotenv.config();

import { send2FACode } from './src/utils/emailService.js';

async function testEmail() {
  try {
    console.log('🧪 Testing email service...\n');
    
    const result = await send2FACode('cralsdale@gmail.com', '123456');
    
    console.log('\n🎉 SUCCESS! Email sent:');
    console.log('✅ Check your email inbox');
    console.log('✅ Check your spam folder');
    console.log(`✅ Message ID: ${result.messageId}`);
    
  } catch (error) {
    console.log('\n💥 FAILED:');
    console.log(`❌ ${error.message}`);
    
    if (error.message.includes('EAUTH') || error.message.includes('authentication')) {
      console.log('\n🔐 AUTHENTICATION FIX:');
      console.log('1. Go to: https://myaccount.google.com/security');
      console.log('2. Enable 2-Factor Authentication');
      console.log('3. Generate App Password: Security → App passwords');
      console.log('4. Select "Mail" and "Other" (name: "Pomodoro App")');
      console.log('5. Use the 16-character password in your .env file');
    }
  }
}

testEmail();