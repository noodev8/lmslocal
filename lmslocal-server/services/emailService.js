/*
=======================================================================================================================================
Email Service - Resend Integration
=======================================================================================================================================
Purpose: Handle email sending for verification and password reset using Resend API
=======================================================================================================================================
*/

const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);

/**
 * Send email verification link
 * @param {string} email - User's email address
 * @param {string} token - Verification token
 * @param {string} displayName - User's display name
 */
const sendVerificationEmail = async (email, token, displayName) => {
  try {
    const verificationUrl = `${process.env.EMAIL_VERIFICATION_URL}/verify-email?token=${token}`;
    
    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Email Verification - LMS Local</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; margin: 0; padding: 0; background-color: #f4f4f4;">
          <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 20px;">
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="color: #2563eb; margin: 0;">LMS Local</h1>
              <p style="color: #666; margin: 5px 0 0 0;">Last Man Standing Competitions</p>
            </div>
            
            <div style="background: linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%); padding: 30px; border-radius: 10px; text-align: center;">
              <h2 style="color: #1f2937; margin-top: 0;">Verify Your Email Address</h2>
              <p style="color: #4b5563; margin-bottom: 25px;">Hi ${displayName},</p>
              <p style="color: #4b5563; margin-bottom: 25px;">
                Welcome to LMS Local! Please click the button below to verify your email address and activate your account.
              </p>
              
              <a href="${verificationUrl}" 
                 style="display: inline-block; background-color: #2563eb; color: #ffffff; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; margin: 20px 0;">
                Verify Email Address
              </a>
              
              <p style="color: #6b7280; font-size: 14px; margin-top: 25px;">
                This verification link will expire in 24 hours.
              </p>
              
              <p style="color: #6b7280; font-size: 12px; margin-top: 20px;">
                If you didn't create an account with LMS Local, you can safely ignore this email.
              </p>
            </div>
            
            <div style="text-align: center; margin-top: 20px; color: #9ca3af; font-size: 12px;">
              <p>LMS Local - Admin-first Last Man Standing competitions</p>
            </div>
          </div>
        </body>
      </html>
    `;

    const textContent = `
      LMS Local - Verify Your Email Address
      
      Hi ${displayName},
      
      Welcome to LMS Local! Please visit the following link to verify your email address:
      
      ${verificationUrl}
      
      This verification link will expire in 24 hours.
      
      If you didn't create an account with LMS Local, you can safely ignore this email.
      
      ---
      LMS Local - Admin-first Last Man Standing competitions
    `;

    const result = await resend.emails.send({
      from: `${process.env.EMAIL_NAME} <${process.env.EMAIL_FROM}>`,
      to: [email],
      subject: 'Verify your email address - LMS Local',
      html: htmlContent,
      text: textContent,
    });

    return { success: true, messageId: result.id };

  } catch (error) {
    console.error('Failed to send verification email:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Send password reset email
 * @param {string} email - User's email address
 * @param {string} token - Reset token
 * @param {string} displayName - User's display name
 */
const sendPasswordResetEmail = async (email, token, displayName) => {
  try {
    const resetUrl = `${process.env.EMAIL_VERIFICATION_URL}/reset-password?token=${token}`;
    
    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Password Reset - LMS Local</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; margin: 0; padding: 0; background-color: #f4f4f4;">
          <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 20px;">
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="color: #2563eb; margin: 0;">LMS Local</h1>
              <p style="color: #666; margin: 5px 0 0 0;">Last Man Standing Competitions</p>
            </div>
            
            <div style="background: linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%); padding: 30px; border-radius: 10px; text-align: center;">
              <h2 style="color: #1f2937; margin-top: 0;">Reset Your Password</h2>
              <p style="color: #4b5563; margin-bottom: 25px;">Hi ${displayName},</p>
              <p style="color: #4b5563; margin-bottom: 25px;">
                You requested a password reset for your LMS Local account. Click the button below to create a new password.
              </p>
              
              <a href="${resetUrl}" 
                 style="display: inline-block; background-color: #2563eb; color: #ffffff; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; margin: 20px 0;">
                Reset Password
              </a>
              
              <p style="color: #6b7280; font-size: 14px; margin-top: 25px;">
                This reset link will expire in 1 hour for security.
              </p>
              
              <p style="color: #6b7280; font-size: 12px; margin-top: 20px;">
                If you didn't request a password reset, you can safely ignore this email.
              </p>
            </div>
            
            <div style="text-align: center; margin-top: 20px; color: #9ca3af; font-size: 12px;">
              <p>LMS Local - Admin-first Last Man Standing competitions</p>
            </div>
          </div>
        </body>
      </html>
    `;

    const textContent = `
      LMS Local - Reset Your Password
      
      Hi ${displayName},
      
      You requested a password reset for your LMS Local account. Please visit the following link to create a new password:
      
      ${resetUrl}
      
      This reset link will expire in 1 hour for security.
      
      If you didn't request a password reset, you can safely ignore this email.
      
      ---
      LMS Local - Admin-first Last Man Standing competitions
    `;

    const result = await resend.emails.send({
      from: `${process.env.EMAIL_NAME} <${process.env.EMAIL_FROM}>`,
      to: [email],
      subject: 'Reset your password - LMS Local',
      html: htmlContent,
      text: textContent,
    });

    console.log('Password reset email sent successfully:', result.id);
    return { success: true, messageId: result.id };

  } catch (error) {
    console.error('Failed to send password reset email:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Sends a magic link email for player authentication
 * @param {string} email - Recipient email address
 * @param {string} token - Magic link token
 * @param {string} displayName - Player's display name
 * @param {string} competitionName - Competition name
 * @param {string} slug - Competition slug
 * @returns {Object} Result object with success status
 */
const sendPlayerMagicLink = async (email, token, displayName, competitionName, slug) => {
  try {
    const magicLinkUrl = `${process.env.PLAYER_FRONTEND_URL}/play/${slug}?token=${token}`;
    
    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Join ${competitionName} - LMS Local</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 24px;">Welcome to ${competitionName}!</h1>
          </div>
          
          <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #e9ecef;">
            <h2 style="color: #343a40; margin-top: 0;">Hi ${displayName}! 👋</h2>
            
            <p style="font-size: 16px; margin-bottom: 25px;">
              You're ready to join <strong>${competitionName}</strong> and test your football knowledge!
            </p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${magicLinkUrl}" 
                 style="background: #28a745; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block; font-size: 16px;">
                🚀 Join Competition Now
              </a>
            </div>
            
            <div style="background: #e3f2fd; padding: 20px; border-radius: 8px; margin: 25px 0;">
              <h3 style="color: #1976d2; margin-top: 0; font-size: 16px;">What happens next?</h3>
              <ul style="color: #424242; margin: 0; padding-left: 20px;">
                <li>Click the button above to access your competition dashboard</li>
                <li>Make your picks for each round</li>
                <li>Track your progress and see results</li>
                <li>Compete against other players!</li>
              </ul>
            </div>
            
            <p style="font-size: 14px; color: #6c757d; border-top: 1px solid #dee2e6; padding-top: 20px; margin-top: 30px;">
              This magic link will expire in 30 minutes for security. If you didn't request to join this competition, you can safely ignore this email.
            </p>
          </div>
          
          <div style="text-align: center; margin-top: 20px; font-size: 12px; color: #6c757d;">
            <p>LMS Local - Admin-first Last Man Standing competitions</p>
          </div>
        </body>
      </html>
    `;

    const textContent = `
      Welcome to ${competitionName}!
      
      Hi ${displayName},
      
      You're ready to join ${competitionName} and test your football knowledge!
      
      Click this link to join: ${magicLinkUrl}
      
      What happens next?
      - Make your picks for each round
      - Track your progress and see results  
      - Compete against other players!
      
      This magic link will expire in 30 minutes for security.
      
      ---
      LMS Local - Admin-first Last Man Standing competitions
    `;

    const result = await resend.emails.send({
      from: `${process.env.EMAIL_NAME} <${process.env.EMAIL_FROM}>`,
      to: [email],
      subject: `Join ${competitionName} - LMS Local`,
      html: htmlContent,
      text: textContent,
    });

    return { success: true, messageId: result.id };

  } catch (error) {
    console.error('Failed to send player magic link email:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Send payment confirmation email
 * @param {string} email - User's email address
 * @param {string} displayName - User's display name
 * @param {string} planName - Plan name (starter, pro)
 * @param {number} amount - Payment amount
 * @param {string} expiryDate - Plan expiry date
 */
const sendPaymentConfirmationEmail = async (email, displayName, planName, amount, expiryDate) => {
  try {
    const planEmoji = planName === 'starter' ? '🚀' : '🏢';
    const formattedAmount = `£${amount.toFixed(2)}`;
    const formattedExpiry = new Date(expiryDate).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Payment Confirmed - LMS Local</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; margin: 0; padding: 0; background-color: #f4f4f4;">
          <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 20px;">
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="color: #2563eb; margin: 0;">LMS Local</h1>
              <p style="color: #666; margin: 5px 0 0 0;">Last Man Standing Competitions</p>
            </div>

            <div style="background: linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%); padding: 30px; border-radius: 10px; text-align: center;">
              <h2 style="color: #1f2937; margin-top: 0;">${planEmoji} Payment Confirmed!</h2>
              <p style="color: #4b5563; margin-bottom: 25px;">Hi ${displayName},</p>
              <p style="color: #4b5563; margin-bottom: 25px;">
                Thank you for upgrading to the <strong>${planName.charAt(0).toUpperCase() + planName.slice(1)} plan</strong>! Your payment has been processed successfully.
              </p>

              <div style="background: #ffffff; border-radius: 8px; padding: 20px; margin: 25px 0; border: 1px solid #e5e7eb;">
                <h3 style="color: #1f2937; margin-top: 0; font-size: 18px;">Payment Details</h3>
                <div style="text-align: left;">
                  <p style="margin: 8px 0; color: #4b5563;"><strong>Plan:</strong> ${planName.charAt(0).toUpperCase() + planName.slice(1)} ${planEmoji}</p>
                  <p style="margin: 8px 0; color: #4b5563;"><strong>Amount:</strong> ${formattedAmount}</p>
                  <p style="margin: 8px 0; color: #4b5563;"><strong>Valid until:</strong> ${formattedExpiry}</p>
                  <p style="margin: 8px 0; color: #4b5563;"><strong>Access:</strong> 12 months (no auto-renewal)</p>
                </div>
              </div>

              <a href="${process.env.EMAIL_VERIFICATION_URL}/billing"
                 style="display: inline-block; background-color: #2563eb; color: #ffffff; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; margin: 20px 0;">
                View Billing Dashboard
              </a>

              <p style="color: #6b7280; font-size: 14px; margin-top: 25px;">
                Your increased player limits are now active and ready to use.
              </p>

              <p style="color: #6b7280; font-size: 12px; margin-top: 20px;">
                Need help? Reply to this email or contact us at hello@lmslocal.co.uk
              </p>
            </div>

            <div style="text-align: center; margin-top: 20px; color: #9ca3af; font-size: 12px;">
              <p>LMS Local - Admin-first Last Man Standing competitions</p>
            </div>
          </div>
        </body>
      </html>
    `;

    const textContent = `
      LMS Local - Payment Confirmed!

      Hi ${displayName},

      Thank you for upgrading to the ${planName.charAt(0).toUpperCase() + planName.slice(1)} plan! Your payment has been processed successfully.

      Payment Details:
      - Plan: ${planName.charAt(0).toUpperCase() + planName.slice(1)}
      - Amount: ${formattedAmount}
      - Valid until: ${formattedExpiry}
      - Access: 12 months (no auto-renewal)

      Your increased player limits are now active and ready to use.

      View your billing dashboard: ${process.env.EMAIL_VERIFICATION_URL}/billing

      Need help? Reply to this email or contact us at hello@lmslocal.co.uk

      ---
      LMS Local - Admin-first Last Man Standing competitions
    `;

    const result = await resend.emails.send({
      from: `${process.env.EMAIL_NAME} <${process.env.EMAIL_FROM}>`,
      to: [email],
      subject: `Payment confirmed - ${planName.charAt(0).toUpperCase() + planName.slice(1)} plan activated`,
      html: htmlContent,
      text: textContent,
    });

    console.log('Payment confirmation email sent successfully:', result.id);
    return { success: true, messageId: result.id };

  } catch (error) {
    console.error('Failed to send payment confirmation email:', error);
    return { success: false, error: error.message };
  }
};

module.exports = {
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendPlayerMagicLink,
  sendPaymentConfirmationEmail
};