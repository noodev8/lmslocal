/*
Test script for payment confirmation email
Run with: node test-payment-email.js
*/

require('dotenv').config();
const { sendPaymentConfirmationEmail } = require('./services/emailService');

async function testPaymentEmail() {
  try {
    console.log('🧪 Testing payment confirmation email...');
    console.log('📧 Resend API Key configured:', process.env.RESEND_API_KEY ? 'YES' : 'NO');
    console.log('🌐 Email URL:', process.env.EMAIL_VERIFICATION_URL);

    // Test payment confirmation email function
    const result = await sendPaymentConfirmationEmail(
      'aandreou25@gmail.com', // Replace with your email
      'Test User',
      'starter', // or 'pro'
      199.00,
      new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString() // 1 year from now
    );

    console.log('📊 Full result object:', result);

    if (result.success) {
      console.log('✅ Payment confirmation email sent successfully!');
      console.log('🆔 Message ID:', result.messageId);
      console.log('📧 Check your inbox at: aandreou25@gmail.com');
      console.log('📁 If not in inbox, check spam/junk folder');
    } else {
      console.log('❌ Failed to send email:', result.error);
    }
  } catch (error) {
    console.error('❌ Error testing email:', error);
  }
}

testPaymentEmail();