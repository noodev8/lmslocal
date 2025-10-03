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

              <p style="color: #2563eb; font-weight: bold; margin: 20px 0;">
                🎉 Your plan upgrade is now active!
              </p>

              <p style="color: #6b7280; font-size: 14px; margin-top: 25px;">
                Your increased player limits are now active and ready to use.
              </p>

              <p style="color: #6b7280; font-size: 12px; margin-top: 20px;">
                Questions? Contact us at lmslocal@noodev8.com (please don't reply to this email)
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

      Your plan upgrade is now active!

      Questions? Contact us at lmslocal@noodev8.com (please don't reply to this email)

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

/**
 * Send pick reminder email to player
 * @param {string} email - User's email address
 * @param {object} templateData - All data needed for email template
 * @returns {Object} Result object with success status
 */
const sendPickReminderEmail = async (email, templateData) => {
  try {
    // Extract template data for easier access
    const {
      user_display_name,
      competition_name,
      organizer_name,
      round_number,
      lock_time,
      fixtures,
      teams_used,
      competition_id,
      round_id,
      email_tracking_id
    } = templateData;

    // Format lock time to readable format
    const lockDate = new Date(lock_time);
    const formattedLockTime = lockDate.toLocaleDateString('en-GB', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      hour: '2-digit',
      minute: '2-digit'
    });

    // Build fixtures list HTML with teams used indicators
    const fixturesHtml = fixtures.map((f, index) => {
      // Check if either team has been used already
      const homeTeamUsed = teams_used && teams_used.includes(f.home_team_short);
      const awayTeamUsed = teams_used && teams_used.includes(f.away_team_short);

      return `
      <div style="padding: 14px 16px; ${index < fixtures.length - 1 ? 'border-bottom: 1px solid #e2e8f0;' : ''}">
        <span style="color: ${homeTeamUsed ? '#94a3b8' : '#0f172a'}; font-weight: 500; font-size: 15px; ${homeTeamUsed ? 'text-decoration: line-through;' : ''}">${f.home_team}</span>
        <span style="color: #94a3b8; margin: 0 10px; font-size: 14px;">vs</span>
        <span style="color: ${awayTeamUsed ? '#94a3b8' : '#0f172a'}; font-weight: 500; font-size: 15px; ${awayTeamUsed ? 'text-decoration: line-through;' : ''}">${f.away_team}</span>
      </div>
      `;
    }).join('');

    // Teams used section removed - now shown inline with strikethrough in fixtures list
    let teamsUsedHtml = '';

    // Build the make pick URL using PLAYER_FRONTEND_URL
    // Route is /game/[id]/pick where [id] is the competition_id
    const makePickUrl = `${process.env.PLAYER_FRONTEND_URL}/game/${competition_id}/pick?email_id=${email_tracking_id}`;

    // HTML email content
    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Pick Reminder - ${competition_name}</title>
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; margin: 0; padding: 0; background-color: #f8fafc;">
          <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 0;">

            <!-- Header -->
            <div style="background-color: #1e293b; padding: 30px 20px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 600;">LMS Local</h1>
              <p style="color: #cbd5e1; margin: 8px 0 0 0; font-size: 14px;">${competition_name}</p>
            </div>

            <!-- Main Content -->
            <div style="padding: 40px 30px;">

              <!-- Greeting -->
              <h2 style="color: #0f172a; margin: 0 0 16px 0; font-size: 20px; font-weight: 600;">Hi ${user_display_name},</h2>

              <!-- Main Message -->
              <p style="color: #334155; font-size: 16px; margin: 0 0 24px 0; line-height: 1.5;">
                Time to make your pick for Round ${round_number}.
              </p>

              <!-- Key Info Box -->
              <div style="background: #f1f5f9; border-left: 4px solid #475569; padding: 20px; margin: 0 0 30px 0;">
                <p style="margin: 0 0 12px 0; color: #0f172a; font-size: 15px;"><strong>Deadline:</strong> ${formattedLockTime}</p>
                <p style="margin: 0; color: #475569; font-size: 14px;">Organised by ${organizer_name}</p>
              </div>

              <!-- Fixtures Section -->
              <div style="margin: 0 0 30px 0;">
                <h3 style="color: #0f172a; margin: 0 0 16px 0; font-size: 16px; font-weight: 600;">Round ${round_number} Fixtures</h3>
                <div style="border: 1px solid #e2e8f0; border-radius: 6px; overflow: hidden;">
                  ${fixturesHtml}
                </div>
              </div>

              <!-- Call to Action Button -->
              <div style="margin: 40px 0;">
                <a href="${makePickUrl}"
                   style="display: block; background-color: #475569; color: #ffffff; padding: 16px 32px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px; text-align: center;">
                  Make Your Pick
                </a>
              </div>

              <!-- Sign Off -->
              <p style="color: #64748b; font-size: 14px; margin: 0; line-height: 1.5;">
                Good luck,<br>
                ${organizer_name}
              </p>

            </div>

            <!-- Footer -->
            <div style="background-color: #f8fafc; padding: 20px 30px; border-top: 1px solid #e2e8f0;">
              <p style="color: #94a3b8; font-size: 12px; margin: 0 0 4px 0;">
                LMS Local - Last Man Standing Competitions
              </p>
              <p style="color: #cbd5e1; font-size: 11px; margin: 0;">
                ${email}
              </p>
            </div>

          </div>
        </body>
      </html>
    `;

    // Plain text version for email clients that don't support HTML
    // Build fixtures list for plain text with used team indicators
    const fixturesText = fixtures.map(f => {
      const homeTeamUsed = teams_used && teams_used.includes(f.home_team_short);
      const awayTeamUsed = teams_used && teams_used.includes(f.away_team_short);

      let homeTeam = f.home_team;
      let awayTeam = f.away_team;

      // Add [USED] marker for teams already picked
      if (homeTeamUsed) homeTeam = `${homeTeam} [USED]`;
      if (awayTeamUsed) awayTeam = `${awayTeam} [USED]`;

      return `  • ${homeTeam} vs ${awayTeam}`;
    }).join('\n');

    const textContent = `
${competition_name} - Pick Reminder

Hi ${user_display_name},

Time to make your pick for Round ${round_number}.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

DEADLINE: ${formattedLockTime}
ORGANISED BY: ${organizer_name}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

ROUND ${round_number} FIXTURES:

${fixturesText}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Make your pick here:
${makePickUrl}

Good luck,
${organizer_name}

---
LMS Local - Last Man Standing Competitions
${email}
    `;

    // Send email via Resend
    const result = await resend.emails.send({
      from: `${organizer_name} via LMS Local <${process.env.EMAIL_FROM}>`,
      to: [email],
      subject: `${organizer_name} (${competition_name}): Pick reminder for Round ${round_number}`,
      html: htmlContent,
      text: textContent,
      headers: {
        'X-Entity-Ref-ID': email_tracking_id, // For webhook correlation
      },
      tags: [
        { name: 'email_type', value: 'pick_reminder' },
        { name: 'competition_id', value: String(competition_id) },
        { name: 'round_id', value: String(round_id) }
      ]
    });

    // Resend returns { data: { id: '...' }, error: null } format
    const resendMessageId = result?.data?.id || result?.id || 'unknown';

    return {
      success: true,
      messageId: resendMessageId,
      resend_message_id: resendMessageId
    };

  } catch (error) {
    console.error('Failed to send pick reminder email:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Send results email after round completion
 * @param {string} email - User's email address
 * @param {object} templateData - Email template data including round results
 */
const sendResultsEmail = async (email, templateData) => {
  try {
    // Extract template data for easier access
    const {
      user_display_name,
      competition_name,
      competition_status,
      organizer_name,
      round_number,
      user_pick,
      pick_result,
      user_outcome,
      lives_remaining,
      new_status,
      active_player_count,
      competition_id,
      email_tracking_id
    } = templateData;

    // Determine outcome message and styling based on result
    let outcomeMessage = '';
    let outcomeColor = '';
    let outcomeIcon = '';

    if (pick_result === 'no_pick') {
      outcomeMessage = 'You did not make a pick for this round.';
      outcomeColor = '#dc2626'; // red
      outcomeIcon = '⚠️';
    } else if (pick_result === 'win') {
      outcomeMessage = 'Your pick won! You advance to the next round.';
      outcomeColor = '#16a34a'; // green
      outcomeIcon = '✅';
    } else if (pick_result === 'draw') {
      outcomeMessage = 'Your pick drew. You lost a life but remain in the competition.';
      outcomeColor = '#ea580c'; // orange
      outcomeIcon = '⚠️';
    } else if (pick_result === 'loss') {
      outcomeMessage = 'Your pick lost.';
      outcomeColor = '#dc2626'; // red
      outcomeIcon = '❌';
    }

    // Additional status messaging - different for complete vs active competitions
    let statusMessage = '';

    if (competition_status === 'complete') {
      // Competition has ended - show final results
      if (new_status === 'active') {
        // Player survived to the end AND competition is complete
        // This can ONLY mean they are the sole winner
        statusMessage = '<p style="color: #16a34a; font-size: 20px; font-weight: 700; margin: 20px 0 0 0;">🏆 Congratulations! You won the competition!</p>';
      } else {
        // new_status === 'eliminated'
        // Player was eliminated in final round
        // Check if competition ended in DRAW (zero survivors)
        if (active_player_count === 0) {
          statusMessage = '<p style="color: #ea580c; font-size: 18px; font-weight: 600; margin: 20px 0 0 0;">Competition complete - Result: Draw! No winners.</p>';
        } else {
          // Someone else won, this player was eliminated
          statusMessage = '<p style="color: #dc2626; font-size: 16px; font-weight: 600; margin: 20px 0 0 0;">You have been eliminated. Competition complete.</p>';
        }
      }
    } else {
      // Normal round (competition not complete) - existing logic
      if (new_status === 'eliminated') {
        statusMessage = '<p style="color: #dc2626; font-size: 16px; font-weight: 600; margin: 20px 0 0 0;">You have been eliminated from the competition.</p>';
      } else if (new_status === 'active') {
        statusMessage = `<p style="color: #16a34a; font-size: 16px; font-weight: 600; margin: 20px 0 0 0;">You are still in! Lives remaining: ${lives_remaining}</p>`;
      }
    }

    // Build the view competition URL
    const viewCompetitionUrl = `${process.env.PLAYER_FRONTEND_URL}/game/${competition_id}?email_id=${email_tracking_id}`;

    // HTML email content - Simple format as requested
    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Round ${round_number} Results - ${competition_name}</title>
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; margin: 0; padding: 0; background-color: #f8fafc;">
          <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 0;">

            <!-- Header -->
            <div style="background-color: #1e293b; padding: 30px 20px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 600;">LMS Local</h1>
              <p style="color: #cbd5e1; margin: 8px 0 0 0; font-size: 14px;">${competition_name}</p>
            </div>

            <!-- Main Content -->
            <div style="padding: 40px 30px;">

              <!-- Greeting -->
              <h2 style="color: #0f172a; margin: 0 0 16px 0; font-size: 20px; font-weight: 600;">Hi ${user_display_name},</h2>

              <!-- Main Message -->
              <p style="color: #334155; font-size: 16px; margin: 0 0 24px 0; line-height: 1.5;">
                Round ${round_number} results are in.
              </p>

              <!-- Results Box -->
              <div style="background: #f1f5f9; border-left: 4px solid ${outcomeColor}; padding: 24px; margin: 0 0 24px 0;">
                <p style="margin: 0 0 12px 0; color: #0f172a; font-size: 15px;">
                  <strong>${outcomeIcon} Your Pick:</strong> ${user_pick}
                </p>
                <p style="margin: 0; color: ${outcomeColor}; font-size: 16px; font-weight: 600;">
                  ${outcomeMessage}
                </p>
                ${statusMessage}
              </div>

              <!-- Organizer Info -->
              <p style="color: #64748b; font-size: 14px; margin: 0 0 30px 0;">
                Organised by ${organizer_name}
              </p>

              <!-- Call to Action Button -->
              <div style="margin: 40px 0;">
                <a href="${viewCompetitionUrl}"
                   style="display: block; background-color: #475569; color: #ffffff; padding: 16px 32px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px; text-align: center;">
                  View Full Results
                </a>
              </div>

              <!-- Sign Off -->
              <p style="color: #64748b; font-size: 14px; margin: 30px 0 0 0;">
                Good luck in future rounds!
              </p>

            </div>

            <!-- Footer -->
            <div style="background-color: #f8fafc; padding: 20px; text-align: center; border-top: 1px solid #e2e8f0;">
              <p style="color: #94a3b8; font-size: 12px; margin: 0;">
                LMS Local - Last Man Standing Competitions
              </p>
            </div>

          </div>
        </body>
      </html>
    `;

    // Plain text version
    const textContent = `
      ${competition_name} - Round ${round_number} Results

      Hi ${user_display_name},

      Round ${round_number} results are in.

      ${outcomeIcon} Your Pick: ${user_pick}
      ${outcomeMessage}

      ${new_status === 'eliminated' ? 'You have been eliminated from the competition.' : `You are still in! Lives remaining: ${lives_remaining}`}

      Organised by ${organizer_name}

      View full results: ${viewCompetitionUrl}

      Good luck in future rounds!

      ---
      LMS Local - Last Man Standing Competitions
    `;

    // Send email via Resend
    const result = await resend.emails.send({
      from: `${process.env.EMAIL_NAME} <${process.env.EMAIL_FROM}>`,
      to: [email],
      subject: `${organizer_name} (${competition_name}): Round ${round_number} Results`,
      html: htmlContent,
      text: textContent,
    });

    return {
      success: true,
      resend_message_id: result.id
    };

  } catch (error) {
    console.error('Failed to send results email:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

module.exports = {
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendPlayerMagicLink,
  sendPaymentConfirmationEmail,
  sendPickReminderEmail,
  sendResultsEmail
};