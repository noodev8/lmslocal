/*
=======================================================================================================================================
Email Service - Resend Integration
=======================================================================================================================================
Purpose: Handle email sending for verification and password reset using Resend API
=======================================================================================================================================
*/

const { Resend } = require('resend');

/*
The subject lives with the service that queues the email, not here, because the tracking row is
written there before the template is built and the two have to say the same thing.
*/
const { SUBJECT: JOIN_LMS_SUBJECT } = require('./joinLms');
const { subjectFor: createdCompSubjectFor } = require('./createdComp');
const { subjectFor: joinCompSubjectFor } = require('./joinComp');
const { subjectFor: gameStartSubjectFor } = require('./gameStartReminder');
const { subjectFor: fixtureReminderSubjectFor } = require('./fixtureReminder');
const { subjectFor: resultReminderSubjectFor } = require('./resultReminder');
const { subjectFor: gameCompleteSubjectFor } = require('./gameComplete');
const { subjectFor: roundOverSubjectFor } = require('./roundOver');
const { subjectFor: hintSubjectFor } = require('./hints');
const { isOptedOut } = require('./emailPreference');

const resend = new Resend(process.env.RESEND_API_KEY);

// Where a test send is redirected. Overridable so this is not a hardcoded personal address.
const TEST_RECIPIENT = process.env.EMAIL_TEST_RECIPIENT || 'aandreou25@gmail.com';

/**
 * The single point every email leaves through.
 *
 * This replaces a hardcoded `emailData.to = [...]` that sat in a wrapper called by only five of
 * the twelve senders. The other seven - including pick reminder, results and welcome - called
 * resend.emails.send directly and so were never redirected at all, despite the comment claiming
 * ALL EMAILS. Anyone reading that line reasonably concluded nothing could reach a real inbox;
 * three of the live player emails always could.
 *
 * Test mode is now a parameter rather than a line to comment out, so it can be driven from the
 * admin screen per send, and there is one place to check rather than twelve.
 *
 * @param {object} emailData - payload for resend.emails.send
 * @param {object} [options]
 * @param {boolean} [options.testMode] - redirect to the test address instead of the real one
 * @param {string} [options.testRecipient] - override the test address
 */
const deliver = async (emailData, options = {}) => {
  const { testMode = false, testRecipient = TEST_RECIPIENT } = options;

  /*
  The opt-out check, here and not in the callers.

  Every candidate query already excludes people who have unsubscribed, but that is a decision made
  at QUEUE time and this is a promise about SEND time. Three ways an unsubscribed person could
  still be emailed without this:

    - a queued email waits days before /send-email drains it, and they unsubscribe in between
    - the legacy senders (results, competition_announcement, update_scores_mid_round_tip) queue
      rows without consulting any candidate query
    - anything new that sends directly, which is what happened last time a rule lived in the
      callers rather than at the exit

  Recipient and email type come off the payload itself - `to` and the email_type tag - so no
  caller has to pass anything, and a sender that forgets is not a hole. A payload with no
  email_type tag is treated as transactional and always sent; that is the right default for
  password resets and verification, and it means this can never silently swallow account mail.

  Deliberately applied in test mode too. Test mode is for seeing what a send would do, and an
  opted-out recipient is part of what it would do.
  */
  const recipient = Array.isArray(emailData.to) ? emailData.to[0] : emailData.to;
  const emailType = emailData.tags?.find((t) => t.name === 'email_type')?.value || null;
  const taggedCompetition = emailData.tags?.find((t) => t.name === 'competition_id')?.value;
  const competitionId = taggedCompetition ? Number(taggedCompetition) : null;

  if (emailType && (await isOptedOut(recipient, emailType, competitionId))) {
    console.log('Suppressed - recipient opted out:', { email_type: emailType, competition_id: competitionId });
    return { suppressed: true, reason: 'opted_out' };
  }

  /*
  Everything goes out from a noreply address, so without this a reply lands nowhere - a player
  answering "I can't see my fixtures" would get silence, and often not even a bounce. Set here
  rather than in each template so no sender can forget it.

  Only filled in when the caller has not set its own: the contact form deliberately replies to
  the person who wrote in, not to us.
  */
  const replyTo = process.env.EMAIL_REPLY_TO;
  if (replyTo && !emailData.reply_to) {
    emailData = { ...emailData, reply_to: replyTo };
  }

  if (!testMode) {
    return await resend.emails.send(emailData);
  }

  /*
  Subject is prefixed as well as the recipient swapped. Test copies of an email land in the same
  inbox as real ones for whoever is testing, and without the marker there is no way to tell a
  redirected send from a genuine one after the fact.
  */
  return await resend.emails.send({
    ...emailData,
    to: [testRecipient],
    subject: `[TEST] ${emailData.subject}`
  });
};

/*
Kept so the senders that already read as sendEmail(...) do not all have to change. New code
should call deliver directly.
*/
const sendEmail = async (emailData, options = {}) => deliver(emailData, options);

/*
Who operates the service. UK PECR requires marketing mail to identify the sender and give a
valid address, and the same details are on every signed-out page for the same reason - see
lmslocal-web/src/components/public/PublicFooter.tsx. Kept in step with that file by hand;
there is no shared source between the server and the web app.
*/
const COMPANY = {
  name: 'Noodev8 Ltd',
  number: '16222537',
  address: '3 Cumberland Place, Welshpool, SY21 7SB'
};

/**
 * The footer every email ends with: who we are, and how to stop receiving this.
 *
 * Shared rather than pasted into each template because it carries the legal identification -
 * fourteen copies would mean fourteen places to miss when the company details change, and the
 * one that got missed would be the one still sending.
 *
 * @param {string|null} unsubscribeUrl - omit for transactional mail, which is not unsubscribable
 * @returns {{html: string, text: string}}
 */
const buildEmailFooter = (unsubscribeUrl = null) => {
  const html = `
    <div style="background-color: #f8fafc; padding: 20px 30px; border-top: 1px solid #e2e8f0;">
      <p style="color: #94a3b8; font-size: 12px; margin: 0 0 4px 0;">
        LMS Local - Last Man Standing Competitions
      </p>
      ${unsubscribeUrl ? `
      <p style="font-size: 12px; margin: 0 0 12px 0;">
        <a href="${unsubscribeUrl}" style="color: #2563eb; text-decoration: underline;">Unsubscribe</a>
      </p>
      ` : ''}
      <p style="color: #cbd5e1; font-size: 11px; line-height: 1.5; margin: 0;">
        ${COMPANY.name}, company number ${COMPANY.number}<br>
        ${COMPANY.address}
      </p>
    </div>
  `;

  const text = `---
LMS Local - Last Man Standing Competitions
${unsubscribeUrl ? `\nUnsubscribe: ${unsubscribeUrl}\n` : ''}
${COMPANY.name}, company number ${COMPANY.number}
${COMPANY.address}`;

  return { html, text };
};

/**
 * Normalise a Resend response into a result the callers can trust.
 *
 * Resend RESOLVES with { data: { id }, error } rather than throwing, so a rejected send looks
 * identical to a successful one unless `error` is checked explicitly. Every caller here used to
 * hardcode `success: true` on any resolved promise and read `result.id`, which does not exist —
 * the id lives at `result.data.id`. The effect was that bounced and rejected sends were recorded
 * as sent, with a null message id, and nobody could tell the difference afterwards.
 */
const readSendResult = (result) => {
  /*
  deliver() refused to send because the recipient has unsubscribed. Neither a success nor a
  failure: nothing went wrong, and nothing was sent. Callers that record an outcome must treat it
  as its own thing - marking it sent would put a message id of null against an email nobody got,
  and marking it failed would have the queue retry it forever against someone's explicit wish.
  */
  if (result?.suppressed) {
    return { success: false, suppressed: true, error: 'Recipient has unsubscribed from this email' };
  }

  if (result?.error) {
    const message = result.error.message || result.error.name || String(result.error);
    return { success: false, error: message };
  }

  const messageId = result?.data?.id || result?.id || null;
  return { success: true, messageId, resend_message_id: messageId };
};

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

    return readSendResult(result);

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
    // Use PLAYER_FRONTEND_URL (web app) instead of EMAIL_VERIFICATION_URL
    const resetUrl = `${process.env.PLAYER_FRONTEND_URL}/reset-password?token=${token}`;
    
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

    // Resend SDK v2+ returns { data: { id }, error } format
    const messageId = result?.data?.id || result?.id || 'unknown';

    // Log only in development to avoid cluttering production logs
    if (process.env.NODE_ENV !== 'production') {
      console.log('✅ Password reset email sent:', {
        messageId,
        recipient: email,
        displayName
      });
    }

    return readSendResult(result);

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

    return readSendResult(result);

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
    return readSendResult(result);

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
/**
 * Build the pick reminder email without sending it.
 *
 * Split out from sendPickReminderEmail so the admin screen can show the operator exactly what
 * would go out. A preview rendered from a second copy of the markup would drift from the real
 * thing the first time either was edited, which makes the preview worse than none at all.
 *
 * @param {string} email - recipient, shown in the plain-text footer
 * @param {object} templateData - as built by services/pickReminder.js
 * @returns {{subject: string, html: string, text: string, from: string, headers: object, tags: object[]}}
 */
const buildPickReminderEmail = (email, templateData) => {
  {
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
      email_tracking_id,
      /*
      Built by services/pickReminder.js from the recipient's own token. Absent only if the
      account somehow has no token, in which case the footer link and the headers are simply
      omitted rather than rendering a link that would 404.
      */
      unsubscribe
    } = templateData;

    const unsubscribeUrl = unsubscribe?.url || null;
    const footer = buildEmailFooter(unsubscribeUrl);

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

            ${footer.html}

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

${footer.text}
    `;

    return {
      from: `${organizer_name} via LMS Local <${process.env.EMAIL_FROM}>`,
      to: [email],
      subject: `${organizer_name} (${competition_name}): Pick reminder for Round ${round_number}`,
      html: htmlContent,
      text: textContent,
      headers: {
        'X-Entity-Ref-ID': email_tracking_id, // For webhook correlation
        /*
        List-Unsubscribe drives the mail client's own unsubscribe button, which is what Gmail
        and Yahoo have required of bulk senders since Feb 2024. The footer link serves the
        person; this serves the client. Both, not either.
        */
        ...(unsubscribe?.headers || {})
      },
      tags: [
        { name: 'email_type', value: 'pick_reminder' },
        { name: 'competition_id', value: String(competition_id) },
        { name: 'round_id', value: String(round_id) }
      ]
    };
  }
};

/**
 * Send a pick reminder.
 * @param {string} email - User's email address
 * @param {object} templateData - Email template data
 * @param {object} [options] - { testMode, testRecipient }, see deliver()
 */
const sendPickReminderEmail = async (email, templateData, options = {}) => {
  try {
    const result = await deliver(buildPickReminderEmail(email, templateData), options);
    return readSendResult(result);
  } catch (error) {
    console.error('Failed to send pick reminder email:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Build the Join LMS welcome without sending it.
 *
 * Outline row: All | Welcome | Join LMS. Sent once, when someone first has an LMS Local account.
 *
 * One template for both audiences, which is a decision rather than a shortcut. A person registers
 * either by joining someone's competition or by creating their own, and which door they came
 * through says little about what they will do next - a player who joins a pub competition often
 * runs the next one. So the email explains the game once and offers both doors, rather than
 * branching on a signal that goes stale within a week.
 *
 * @param {string} email - recipient
 * @param {object} templateData - as built by services/joinLms.js
 * @returns {{subject: string, html: string, text: string, from: string, headers: object, tags: object[]}}
 */
const buildJoinLmsEmail = (email, templateData) => {
  const {
    user_display_name,
    email_tracking_id,
    /*
    Built by services/joinLms.js from the recipient's own token. Absent only if the account
    somehow has no token, in which case the footer link and the headers are omitted rather than
    rendering a link that would 404.
    */
    unsubscribe
  } = templateData;

  const footer = buildEmailFooter(unsubscribe?.url || null);

  const base = process.env.PLAYER_FRONTEND_URL;
  /*
  The landing page, not /join - there is no bare /join page, only /join/[code], and linking to it
  404s. The landing page carries a sticky "Got a code?" bar at the very top which takes the code
  and forwards to /join/[code], and it works signed in or signed out, which a link out of an email
  has to.
  */
  const joinUrl = `${base}/?email_id=${email_tracking_id}`;
  const createUrl = `${base}/competition/create?email_id=${email_tracking_id}`;
  const howToPlayUrl = `${base}/help/how-to-play`;

  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Welcome to LMS Local</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; margin: 0; padding: 0; background-color: #f8fafc;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 0;">

          <!-- Header -->
          <div style="background-color: #1e293b; padding: 30px 20px; text-align: center;">
            <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 600;">LMS Local</h1>
            <p style="color: #cbd5e1; margin: 8px 0 0 0; font-size: 14px;">Last Man Standing Competitions</p>
          </div>

          <!-- Main Content -->
          <div style="padding: 40px 30px;">

            <h2 style="color: #0f172a; margin: 0 0 16px 0; font-size: 20px; font-weight: 600;">Hi ${user_display_name},</h2>

            <p style="color: #334155; font-size: 16px; margin: 0 0 24px 0; line-height: 1.5;">
              Welcome to LMS Local. Your account is ready.
            </p>

            <!-- How the game works -->
            <div style="background: #f1f5f9; border-left: 4px solid #475569; padding: 20px; margin: 0 0 30px 0;">
              <p style="margin: 0 0 12px 0; color: #0f172a; font-size: 15px; font-weight: 600;">How Last Man Standing works</p>
              <p style="margin: 0 0 10px 0; color: #475569; font-size: 14px;">
                Each round, pick one team you think will win. Win and you go through. Draw or lose and you are out.
              </p>
              <p style="margin: 0; color: #475569; font-size: 14px;">
                The catch: you cannot pick the same team twice until you have used them all. Last one standing wins.
              </p>
            </div>

            <!-- Two doors -->
            <p style="color: #334155; font-size: 16px; margin: 0 0 20px 0; line-height: 1.5;">
              There are two ways to use LMS Local, and plenty of people do both.
            </p>

            <div style="margin: 0 0 20px 0;">
              <a href="${joinUrl}"
                 style="display: block; background-color: #475569; color: #ffffff; padding: 16px 32px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px; text-align: center;">
                Join a competition
              </a>
              <p style="color: #64748b; font-size: 13px; margin: 8px 0 0 0; text-align: center;">
                Got a code from your pub, workplace or club? Enter it here.
              </p>
            </div>

            <div style="margin: 0 0 30px 0;">
              <a href="${createUrl}"
                 style="display: block; background-color: #ffffff; color: #475569; padding: 15px 32px; text-decoration: none; border: 1px solid #cbd5e1; border-radius: 6px; font-weight: 600; font-size: 16px; text-align: center;">
                Run your own competition
              </a>
              <p style="color: #64748b; font-size: 13px; margin: 8px 0 0 0; text-align: center;">
                Set one up for your regulars. Fixtures and results are handled for you.
              </p>
            </div>

            <p style="color: #64748b; font-size: 14px; margin: 0; line-height: 1.5;">
              New to the game? <a href="${howToPlayUrl}" style="color: #2563eb;">How to play</a> covers it in a couple of minutes.
            </p>

          </div>

          ${footer.html}

        </div>
      </body>
    </html>
  `;

  const textContent = `
Welcome to LMS Local

Hi ${user_display_name},

Welcome to LMS Local. Your account is ready.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

HOW LAST MAN STANDING WORKS

Each round, pick one team you think will win. Win and you go through.
Draw or lose and you are out.

The catch: you cannot pick the same team twice until you have used them
all. Last one standing wins.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

There are two ways to use LMS Local, and plenty of people do both.

JOIN A COMPETITION
Got a code from your pub, workplace or club? Enter it here:
${joinUrl}

RUN YOUR OWN COMPETITION
Set one up for your regulars. Fixtures and results are handled for you:
${createUrl}

New to the game? How to play covers it in a couple of minutes:
${howToPlayUrl}

${footer.text}
  `;

  return {
    from: `LMS Local <${process.env.EMAIL_FROM}>`,
    to: [email],
    subject: JOIN_LMS_SUBJECT,
    html: htmlContent,
    text: textContent,
    headers: {
      'X-Entity-Ref-ID': email_tracking_id,
      ...(unsubscribe?.headers || {})
    },
    tags: [{ name: 'email_type', value: 'join_lms' }]
  };
};

/**
 * Send the Join LMS welcome.
 * @param {string} email - recipient
 * @param {object} templateData - as built by services/joinLms.js
 * @param {object} [options] - { testMode, testRecipient }, see deliver()
 */
const sendJoinLmsEmail = async (email, templateData, options = {}) => {
  try {
    const result = await deliver(buildJoinLmsEmail(email, templateData), options);
    return readSendResult(result);
  } catch (error) {
    console.error('Failed to send join LMS email:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Build the Created Comp email without sending it.
 *
 * Outline row: Organiser | Welcome | Created Comp. One per competition, to whoever set it up.
 *
 * The organiser saw a confirmation on screen seconds ago, so this is not that. It is the thing
 * they forward: the code and the join link, big enough to read out loud in a pub.
 *
 * @param {string} email - recipient
 * @param {object} templateData - as built by services/createdComp.js
 * @returns {{subject: string, html: string, text: string, from: string, headers: object, tags: object[]}}
 */
const buildCreatedCompEmail = (email, templateData) => {
  const {
    user_display_name,
    competition_name,
    competition_id,
    invite_code,
    fixture_service,
    email_tracking_id,
    unsubscribe
  } = templateData;

  const footer = buildEmailFooter(unsubscribe?.url || null);

  const base = process.env.PLAYER_FRONTEND_URL;
  const joinUrl = `${base}/join/${invite_code}`;
  const manageUrl = `${base}/game/${competition_id}?email_id=${email_tracking_id}`;

  /*
  Only fixture-service competitions have a Ready button, and nothing is pushed to them until it is
  pressed - so for those organisers this is the step between "set up" and "actually running", and
  omitting it leaves them waiting for a round that will never arrive. Organiser-managed
  competitions have no such button and would be told to press something that does not exist.
  */
  const readyHtml = fixture_service ? `
            <div style="background: #f1f5f9; border-left: 4px solid #475569; padding: 20px; margin: 0 0 30px 0;">
              <p style="margin: 0 0 8px 0; color: #0f172a; font-size: 15px; font-weight: 600;">One more step, when you are ready</p>
              <p style="margin: 0; color: #475569; font-size: 14px;">
                Once you have players in, open your competition and press <strong>Ready</strong>. That is what starts
                round one - we will not send fixtures until you say so, however long that takes.
              </p>
            </div>
  ` : '';

  const readyText = fixture_service ? `
ONE MORE STEP, WHEN YOU ARE READY

Once you have players in, open your competition and press Ready. That is what
starts round one - we will not send fixtures until you say so, however long
that takes.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
` : '';

  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${competition_name} is ready to share</title>
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

            <h2 style="color: #0f172a; margin: 0 0 16px 0; font-size: 20px; font-weight: 600;">Hi ${user_display_name},</h2>

            <p style="color: #334155; font-size: 16px; margin: 0 0 24px 0; line-height: 1.5;">
              <strong>${competition_name}</strong> is set up. All it needs now is players.
            </p>

            <!-- The code, which is the point of this email -->
            <div style="border: 1px solid #e2e8f0; border-radius: 6px; padding: 24px; margin: 0 0 24px 0; text-align: center;">
              <p style="margin: 0 0 10px 0; color: #64748b; font-size: 13px; text-transform: uppercase; letter-spacing: 1px;">Your competition code</p>
              <p style="margin: 0 0 18px 0; color: #0f172a; font-size: 32px; font-weight: 700; letter-spacing: 3px;">${invite_code}</p>
              <p style="margin: 0; color: #475569; font-size: 14px;">
                Or send them this link:<br>
                <a href="${joinUrl}" style="color: #2563eb; word-break: break-all;">${joinUrl}</a>
              </p>
            </div>

            <p style="color: #334155; font-size: 15px; margin: 0 0 30px 0; line-height: 1.5;">
              Forward this email, put the code behind the bar, or post the link in your group chat. Anyone with
              it can join - they do not need anything from you first.
            </p>

            ${readyHtml}

            <!-- Call to Action Button -->
            <div style="margin: 0 0 30px 0;">
              <a href="${manageUrl}"
                 style="display: block; background-color: #475569; color: #ffffff; padding: 16px 32px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px; text-align: center;">
                Manage your competition
              </a>
            </div>

          </div>

          ${footer.html}

        </div>
      </body>
    </html>
  `;

  const textContent = `
${competition_name} is ready to share

Hi ${user_display_name},

${competition_name} is set up. All it needs now is players.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

YOUR COMPETITION CODE: ${invite_code}

Or send them this link:
${joinUrl}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Forward this email, put the code behind the bar, or post the link in your
group chat. Anyone with it can join - they do not need anything from you
first.
${readyText}
Manage your competition:
${manageUrl}

${footer.text}
  `;

  return {
    from: `LMS Local <${process.env.EMAIL_FROM}>`,
    to: [email],
    subject: createdCompSubjectFor(competition_name),
    html: htmlContent,
    text: textContent,
    headers: {
      'X-Entity-Ref-ID': email_tracking_id,
      ...(unsubscribe?.headers || {})
    },
    tags: [
      { name: 'email_type', value: 'created_comp' },
      { name: 'competition_id', value: String(competition_id) }
    ]
  };
};

/**
 * Send the Created Comp email.
 * @param {string} email - recipient
 * @param {object} templateData - as built by services/createdComp.js
 * @param {object} [options] - { testMode, testRecipient }, see deliver()
 */
const sendCreatedCompEmail = async (email, templateData, options = {}) => {
  try {
    const result = await deliver(buildCreatedCompEmail(email, templateData), options);
    return readSendResult(result);
  } catch (error) {
    console.error('Failed to send created comp email:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Build the Game Start reminder without sending it.
 *
 * Outline row: Organiser | Game | Game Start reminder. Goes to an organiser whose competition
 * could start today - a round is staged and waiting - but who has never pressed Ready.
 *
 * The whole email hangs on one button, so it says what pressing it does and when the round would
 * be. services/gameStartReminder.js guarantees the offer is real: nobody receives this unless
 * pressing Ready right now would actually produce a round.
 *
 * @param {string} email - recipient
 * @param {object} templateData - as built by services/gameStartReminder.js
 * @returns {{subject: string, html: string, text: string, from: string, headers: object, tags: object[]}}
 */
const buildGameStartReminderEmail = (email, templateData) => {
  const {
    user_display_name,
    competition_name,
    competition_id,
    invite_code,
    starts_at,
    fixture_count,
    player_count,
    email_tracking_id,
    unsubscribe
  } = templateData;

  const footer = buildEmailFooter(unsubscribe?.url || null);

  const startDate = starts_at
    ? new Date(starts_at).toLocaleDateString('en-GB', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        hour: '2-digit',
        minute: '2-digit'
      })
    : null;

  /*
  An organiser with nobody signed up has a different problem from one with a competition full of
  people waiting on them, and telling the first to press Ready would start a competition with no
  players in it. Same email, one honest line either way.
  */
  const playersLine = player_count === 0
    ? 'Nobody has joined yet, so it may be worth sharing your code first - the code is below.'
    : `${player_count} player${player_count === 1 ? ' has' : 's have'} joined and ${player_count === 1 ? 'is' : 'are'} waiting on you.`;

  const readyUrl = `${process.env.PLAYER_FRONTEND_URL}/game/${competition_id}/round?email_id=${email_tracking_id}`;

  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${competition_name} is ready to start</title>
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

            <h2 style="color: #0f172a; margin: 0 0 16px 0; font-size: 20px; font-weight: 600;">Hi ${user_display_name},</h2>

            <p style="color: #334155; font-size: 16px; margin: 0 0 24px 0; line-height: 1.5;">
              <strong>${competition_name}</strong> has not started yet, and there is a round waiting for it.
            </p>

            <div style="background: #f1f5f9; border-left: 4px solid #475569; padding: 20px; margin: 0 0 24px 0;">
              ${startDate ? `<p style="margin: 0 0 12px 0; color: #0f172a; font-size: 15px;"><strong>Round 1 would be ${startDate}</strong>${fixture_count ? `, ${fixture_count} ${fixture_count === 1 ? 'match' : 'matches'}` : ''}</p>` : ''}
              <p style="margin: 0; color: #475569; font-size: 14px;">${playersLine}</p>
            </div>

            <p style="color: #334155; font-size: 15px; margin: 0 0 30px 0; line-height: 1.5;">
              Nothing is sent to your players until you press <strong>Ready</strong>. That is deliberate - we will
              not start a competition on your behalf - but it does mean this one is waiting on you.
            </p>

            <!-- Call to Action Button -->
            <div style="margin: 0 0 24px 0;">
              <a href="${readyUrl}"
                 style="display: block; background-color: #475569; color: #ffffff; padding: 16px 32px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px; text-align: center;">
                Open your competition
              </a>
            </div>

            <p style="color: #64748b; font-size: 14px; margin: 0; line-height: 1.5;">
              Still gathering players? Your code is <strong>${invite_code}</strong>. There is no rush - the
              competition will keep until you are ready.
            </p>

          </div>

          ${footer.html}

        </div>
      </body>
    </html>
  `;

  const textContent = `
${competition_name} is ready to start

Hi ${user_display_name},

${competition_name} has not started yet, and there is a round waiting for it.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${startDate ? `\nROUND 1 WOULD BE: ${startDate}${fixture_count ? ` (${fixture_count} ${fixture_count === 1 ? 'match' : 'matches'})` : ''}\n` : ''}
${playersLine}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Nothing is sent to your players until you press Ready. That is deliberate - we
will not start a competition on your behalf - but it does mean this one is
waiting on you.

Open your competition:
${readyUrl}

Still gathering players? Your code is ${invite_code}. There is no rush - the
competition will keep until you are ready.

${footer.text}
  `;

  return {
    from: `LMS Local <${process.env.EMAIL_FROM}>`,
    to: [email],
    subject: gameStartSubjectFor(competition_name),
    html: htmlContent,
    text: textContent,
    headers: {
      'X-Entity-Ref-ID': email_tracking_id,
      ...(unsubscribe?.headers || {})
    },
    tags: [
      { name: 'email_type', value: 'game_start_reminder' },
      { name: 'competition_id', value: String(competition_id) }
    ]
  };
};

/**
 * Send the Game Start reminder.
 * @param {string} email - recipient
 * @param {object} templateData - as built by services/gameStartReminder.js
 * @param {object} [options] - { testMode, testRecipient }, see deliver()
 */
const sendGameStartReminderEmail = async (email, templateData, options = {}) => {
  try {
    const result = await deliver(buildGameStartReminderEmail(email, templateData), options);
    return readSendResult(result);
  } catch (error) {
    console.error('Failed to send game start reminder email:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Build the Fixture reminder without sending it.
 *
 * Outline row: Organiser | Game | Fixture reminder. Goes to an organiser who supplies their own
 * fixtures, whose last round is settled, and who has not put the next one up.
 *
 * The tone is the difference between this and the game start reminder. That one chases a
 * competition nobody is waiting on yet; this one has players sitting on a finished round with
 * nothing to pick, so it says how many, and it says what the next round is by number.
 *
 * @param {string} email - recipient
 * @param {object} templateData - as built by services/fixtureReminder.js
 * @returns {{subject: string, html: string, text: string, from: string, headers: object, tags: object[]}}
 */
const buildFixtureReminderEmail = (email, templateData) => {
  const {
    user_display_name,
    competition_name,
    competition_id,
    last_round_number,
    next_round_number,
    settled_at,
    active_player_count,
    email_tracking_id,
    unsubscribe
  } = templateData;

  const footer = buildEmailFooter(unsubscribe?.url || null);

  const settledDate = settled_at
    ? new Date(settled_at).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })
    : null;

  const playersLine = `${active_player_count} player${active_player_count === 1 ? '' : 's'} ${active_player_count === 1 ? 'is' : 'are'} still in and waiting for Round ${next_round_number}.`;

  // Straight to the fixture entry form rather than the round screen. They already know what is
  // outstanding - the email just told them - so the click that helps is the one that starts typing.
  const fixturesUrl = `${process.env.PLAYER_FRONTEND_URL}/game/${competition_id}/organizer-fixtures?email_id=${email_tracking_id}`;

  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${competition_name} is waiting on the next round</title>
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

            <h2 style="color: #0f172a; margin: 0 0 16px 0; font-size: 20px; font-weight: 600;">Hi ${user_display_name},</h2>

            <p style="color: #334155; font-size: 16px; margin: 0 0 24px 0; line-height: 1.5;">
              Round ${last_round_number} of <strong>${competition_name}</strong> is settled${settledDate ? ` — you processed it on ${settledDate}` : ''}.
              Round ${next_round_number} needs its fixtures before anyone can pick.
            </p>

            <div style="background: #f1f5f9; border-left: 4px solid #475569; padding: 20px; margin: 0 0 24px 0;">
              <p style="margin: 0; color: #0f172a; font-size: 15px;">${playersLine}</p>
            </div>

            <p style="color: #334155; font-size: 15px; margin: 0 0 30px 0; line-height: 1.5;">
              You add the fixtures for this competition yourself, so nothing appears until you put
              them in. It takes a minute — pick the matches, and your players can pick straight away.
            </p>

            <!-- Call to Action Button -->
            <div style="margin: 0 0 24px 0;">
              <a href="${fixturesUrl}"
                 style="display: block; background-color: #475569; color: #ffffff; padding: 16px 32px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px; text-align: center;">
                Add Round ${next_round_number} fixtures
              </a>
            </div>

            <p style="color: #64748b; font-size: 14px; margin: 0; line-height: 1.5;">
              Finished with this competition? You can leave it — we will stop reminding you once it
              is marked complete.
            </p>

          </div>

          ${footer.html}

        </div>
      </body>
    </html>
  `;

  const textContent = `
${competition_name} is waiting on the next round

Hi ${user_display_name},

Round ${last_round_number} of ${competition_name} is settled${settledDate ? ` - you processed it on ${settledDate}` : ''}.
Round ${next_round_number} needs its fixtures before anyone can pick.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${playersLine}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

You add the fixtures for this competition yourself, so nothing appears until you
put them in. It takes a minute - pick the matches, and your players can pick
straight away.

Add Round ${next_round_number} fixtures:
${fixturesUrl}

Finished with this competition? You can leave it - we will stop reminding you
once it is marked complete.

${footer.text}
  `;

  return {
    from: `LMS Local <${process.env.EMAIL_FROM}>`,
    to: [email],
    subject: fixtureReminderSubjectFor(competition_name),
    html: htmlContent,
    text: textContent,
    headers: {
      'X-Entity-Ref-ID': email_tracking_id,
      ...(unsubscribe?.headers || {})
    },
    tags: [
      { name: 'email_type', value: 'fixture_reminder' },
      { name: 'competition_id', value: String(competition_id) }
    ]
  };
};

/**
 * Send the Fixture reminder.
 * @param {string} email - recipient
 * @param {object} templateData - as built by services/fixtureReminder.js
 * @param {object} [options] - { testMode, testRecipient }, see deliver()
 */
const sendFixtureReminderEmail = async (email, templateData, options = {}) => {
  try {
    const result = await deliver(buildFixtureReminderEmail(email, templateData), options);
    return readSendResult(result);
  } catch (error) {
    console.error('Failed to send fixture reminder email:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Build the Result reminder without sending it.
 *
 * Outline row: Organiser | Game | Result reminder. Goes to an organiser whose latest round has
 * been played and not settled - the competition is frozen until they act.
 *
 * The copy branches on how far they got. An organiser who has typed every result and not pressed
 * Process is one button from done, and telling them to "add your results" would read as if we had
 * not looked. See services/resultReminder.js for where awaiting_processing comes from.
 *
 * @param {string} email - recipient
 * @param {object} templateData - as built by services/resultReminder.js
 * @returns {{subject: string, html: string, text: string, from: string, headers: object, tags: object[]}}
 */
const buildResultReminderEmail = (email, templateData) => {
  const {
    user_display_name,
    competition_name,
    competition_id,
    round_number,
    fixture_count,
    results_entered,
    results_outstanding,
    awaiting_processing,
    last_kickoff,
    active_player_count,
    email_tracking_id,
    unsubscribe
  } = templateData;

  const footer = buildEmailFooter(unsubscribe?.url || null);

  const playedDate = last_kickoff
    ? new Date(last_kickoff).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })
    : null;

  // Three organisers land here: nothing typed in, part way, and done-but-not-processed.
  const progressLine = awaiting_processing
    ? `All ${fixture_count} ${fixture_count === 1 ? 'result is' : 'results are'} in — they just need processing.`
    : results_entered > 0
    ? `${results_entered} of ${fixture_count} results are in, ${results_outstanding} still to go.`
    : `${fixture_count} ${fixture_count === 1 ? 'result' : 'results'} still to go in.`;

  const actionLine = awaiting_processing
    ? 'One button settles the round, works out who is through, and opens the next one.'
    : 'Entering them settles the round, works out who is through, and opens the next one.';

  const buttonLabel = awaiting_processing ? `Process Round ${round_number}` : `Enter Round ${round_number} results`;

  // The round screen, which is where results are both entered and processed - one screen for the
  // whole job, whichever half of it is outstanding. See docs/round-state-machine.md.
  const roundUrl = `${process.env.PLAYER_FRONTEND_URL}/game/${competition_id}/round?email_id=${email_tracking_id}`;

  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${competition_name} is waiting on results</title>
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

            <h2 style="color: #0f172a; margin: 0 0 16px 0; font-size: 20px; font-weight: 600;">Hi ${user_display_name},</h2>

            <p style="color: #334155; font-size: 16px; margin: 0 0 24px 0; line-height: 1.5;">
              Round ${round_number} of <strong>${competition_name}</strong> has been played${playedDate ? ` — the last match was ${playedDate}` : ''},
              and it has not been settled yet.
            </p>

            <div style="background: #f1f5f9; border-left: 4px solid #475569; padding: 20px; margin: 0 0 24px 0;">
              <p style="margin: 0 0 12px 0; color: #0f172a; font-size: 15px;"><strong>${progressLine}</strong></p>
              <p style="margin: 0; color: #475569; font-size: 14px;">
                ${active_player_count} player${active_player_count === 1 ? '' : 's'} ${active_player_count === 1 ? 'is' : 'are'} waiting to find out if they are through.
              </p>
            </div>

            <p style="color: #334155; font-size: 15px; margin: 0 0 30px 0; line-height: 1.5;">
              ${actionLine} Until then nobody is eliminated and the next round cannot open.
            </p>

            <!-- Call to Action Button -->
            <div style="margin: 0 0 24px 0;">
              <a href="${roundUrl}"
                 style="display: block; background-color: #475569; color: #ffffff; padding: 16px 32px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px; text-align: center;">
                ${buttonLabel}
              </a>
            </div>

            <p style="color: #64748b; font-size: 14px; margin: 0; line-height: 1.5;">
              Results are on regulation time — 90 minutes plus stoppage — so extra time and
              penalties do not count.
            </p>

          </div>

          ${footer.html}

        </div>
      </body>
    </html>
  `;

  const textContent = `
${competition_name} is waiting on results

Hi ${user_display_name},

Round ${round_number} of ${competition_name} has been played${playedDate ? ` - the last match was ${playedDate}` : ''},
and it has not been settled yet.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${progressLine}

${active_player_count} player${active_player_count === 1 ? '' : 's'} ${active_player_count === 1 ? 'is' : 'are'} waiting to find out if they are through.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${actionLine} Until then nobody is eliminated and the next round
cannot open.

${buttonLabel}:
${roundUrl}

Results are on regulation time - 90 minutes plus stoppage - so extra time and
penalties do not count.

${footer.text}
  `;

  return {
    from: `LMS Local <${process.env.EMAIL_FROM}>`,
    to: [email],
    subject: resultReminderSubjectFor(competition_name),
    html: htmlContent,
    text: textContent,
    headers: {
      'X-Entity-Ref-ID': email_tracking_id,
      ...(unsubscribe?.headers || {})
    },
    tags: [
      { name: 'email_type', value: 'result_reminder' },
      { name: 'competition_id', value: String(competition_id) }
    ]
  };
};

/**
 * Send the Result reminder.
 * @param {string} email - recipient
 * @param {object} templateData - as built by services/resultReminder.js
 * @param {object} [options] - { testMode, testRecipient }, see deliver()
 */
const sendResultReminderEmail = async (email, templateData, options = {}) => {
  try {
    const result = await deliver(buildResultReminderEmail(email, templateData), options);
    return readSendResult(result);
  } catch (error) {
    console.error('Failed to send result reminder email:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Build the Game Complete email without sending it.
 *
 * Outline row: Player | Game | Game complete. Goes to everyone who took part once a competition
 * has finished - winners and eliminated alike.
 *
 * Three endings, not one: a winner, a share, or nobody left. The last is real rather than
 * defensive - a competition can eliminate its whole remaining field in a single round - and it is
 * the reason this template does not simply congratulate somebody. See services/gameComplete.js.
 *
 * @param {string} email - recipient
 * @param {object} templateData - as built by services/gameComplete.js
 * @returns {{subject: string, html: string, text: string, from: string, headers: object, tags: object[]}}
 */
const buildGameCompleteEmail = (email, templateData) => {
  const {
    user_display_name,
    competition_name,
    competition_id,
    survivor_count,
    winner_names,
    recipient_survived,
    player_count,
    rounds_played,
    email_tracking_id,
    unsubscribe
  } = templateData;

  const footer = buildEmailFooter(unsubscribe?.url || null);

  /*
  The headline and the line under it, by ending. Written out rather than assembled from fragments
  because "you won" and "nobody won" are different sentences, not one sentence with a variable in
  it, and the shared case has to work for the winner and for everyone else.
  */
  let headline;
  let outcomeLine;

  if (survivor_count === 0) {
    headline = 'No winner this time';
    outcomeLine = `Everybody still standing went out in the same round, so ${competition_name} finishes without a winner. It happens — and it is a hard way to end.`;
  } else if (survivor_count === 1) {
    headline = recipient_survived ? 'You won' : `${winner_names} won`;
    outcomeLine = recipient_survived
      ? `You are the last one standing in ${competition_name}. Out of ${player_count} ${player_count === 1 ? 'player' : 'players'}, you are the one who made it.`
      : `${winner_names} is the last one standing in ${competition_name}, out of ${player_count} ${player_count === 1 ? 'player' : 'players'}.`;
  } else {
    headline = recipient_survived ? 'You shared the win' : 'It ends in a draw';
    outcomeLine = recipient_survived
      ? `${competition_name} ends with ${survivor_count} of you still standing, so the win is shared: ${winner_names}.`
      : `${competition_name} ends with ${survivor_count} players still standing, so the win is shared between ${winner_names}.`;
  }

  const standingsUrl = `${process.env.PLAYER_FRONTEND_URL}/game/${competition_id}/standings?email_id=${email_tracking_id}`;

  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${competition_name} has finished</title>
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

            <h2 style="color: #0f172a; margin: 0 0 16px 0; font-size: 20px; font-weight: 600;">Hi ${user_display_name},</h2>

            <div style="background: #f1f5f9; border-left: 4px solid #475569; padding: 20px; margin: 0 0 24px 0;">
              <p style="margin: 0 0 8px 0; color: #0f172a; font-size: 18px; font-weight: 600;">${headline}</p>
              <p style="margin: 0; color: #475569; font-size: 15px;">${outcomeLine}</p>
            </div>

            <p style="color: #334155; font-size: 15px; margin: 0 0 30px 0; line-height: 1.5;">
              That is ${competition_name} done${rounds_played ? ` after ${rounds_played} ${rounds_played === 1 ? 'round' : 'rounds'}` : ''}.
              Thanks for playing.
            </p>

            <!-- Call to Action Button -->
            <div style="margin: 0 0 24px 0;">
              <a href="${standingsUrl}"
                 style="display: block; background-color: #475569; color: #ffffff; padding: 16px 32px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px; text-align: center;">
                See the final table
              </a>
            </div>

          </div>

          ${footer.html}

        </div>
      </body>
    </html>
  `;

  const textContent = `
${competition_name} has finished

Hi ${user_display_name},

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${headline.toUpperCase()}

${outcomeLine}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

That is ${competition_name} done${rounds_played ? ` after ${rounds_played} ${rounds_played === 1 ? 'round' : 'rounds'}` : ''}. Thanks for playing.

See the final table:
${standingsUrl}

${footer.text}
  `;

  return {
    from: `LMS Local <${process.env.EMAIL_FROM}>`,
    to: [email],
    subject: gameCompleteSubjectFor(competition_name),
    html: htmlContent,
    text: textContent,
    headers: {
      'X-Entity-Ref-ID': email_tracking_id,
      ...(unsubscribe?.headers || {})
    },
    tags: [
      { name: 'email_type', value: 'game_complete' },
      { name: 'competition_id', value: String(competition_id) }
    ]
  };
};

/**
 * Send the Game Complete email.
 * @param {string} email - recipient
 * @param {object} templateData - as built by services/gameComplete.js
 * @param {object} [options] - { testMode, testRecipient }, see deliver()
 */
const sendGameCompleteEmail = async (email, templateData, options = {}) => {
  try {
    const result = await deliver(buildGameCompleteEmail(email, templateData), options);
    return readSendResult(result);
  } catch (error) {
    console.error('Failed to send game complete email:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Build the Round Over email without sending it.
 *
 * Outline row: Player | Game | Round Over. The weekly email, sent only once the next round's
 * fixtures exist - see services/roundOver.js for why that is the whole design.
 *
 * Three blocks, in the order a player cares about them: what happened to ME, what happened to
 * everyone else, and what I do next. The last block is either the next round or the ending; a
 * competition cannot be both.
 *
 * @param {string} email - recipient
 * @param {object} templateData - as built by services/roundOver.js
 * @returns {{subject: string, html: string, text: string, from: string, headers: object, tags: object[]}}
 */
const buildRoundOverEmail = (email, templateData) => {
  const {
    user_display_name,
    competition_name,
    competition_id,
    round_number,
    chosen_team,
    outcome,
    missed_pick,
    survived,
    lives_remaining,
    survivors_count,
    out_this_round_count,
    survivors_sample,
    out_this_round_sample,
    competition_complete,
    winner_names,
    is_draw,
    next_round_number,
    next_deadline,
    next_fixtures,
    email_tracking_id,
    unsubscribe
  } = templateData;

  const footer = buildEmailFooter(unsubscribe?.url || null);

  /*
  Block 1 - the recipient's own round, which is the only part of this email they are guaranteed to
  read. Four outcomes, and they are not the same sentence with a word swapped: surviving on a lost
  life is good news and bad news at once, and a missed pick needs naming as a missed pick rather
  than dressed up as a defeat.
  */
  let yourResult;
  if (missed_pick && survived) {
    yourResult = `You did not get a pick in for Round ${round_number}. That cost you a life — you have ${lives_remaining} left, and you are still in.`;
  } else if (missed_pick) {
    yourResult = `You did not get a pick in for Round ${round_number}, and that is you out.`;
  } else if (String(outcome).toUpperCase() === 'WIN' && competition_complete) {
    // No next round to be through to. What it actually won them is the ending block's business,
    // since only that knows whether this was an outright win or a share.
    yourResult = `You picked ${chosen_team} and they won — and that is the last round.`;
  } else if (String(outcome).toUpperCase() === 'WIN') {
    yourResult = `You picked ${chosen_team} and they won. You are through to the next round.`;
  } else if (survived) {
    yourResult = `You picked ${chosen_team} and they did not win. That cost you a life — you have ${lives_remaining} left, and you are still in.`;
  } else {
    yourResult = `You picked ${chosen_team} and they did not win. That is you out of ${competition_name}.`;
  }

  // Block 2 - the round at large. Counts exact, names sampled; see SAMPLE_SIZE in roundOver.js.
  const roundLines = [];
  roundLines.push(`${survivors_count} ${survivors_count === 1 ? 'player is' : 'players are'} still in.`);
  if (out_this_round_count > 0) {
    roundLines.push(`${out_this_round_count} went out this round${out_this_round_sample ? `, including ${out_this_round_sample}` : ''}.`);
  }
  if (survivors_sample && !competition_complete) {
    roundLines.push(`Still standing: ${survivors_sample}${survivors_count > 5 ? ' and others' : ''}.`);
  }

  /*
  Block 3 - what happens next, which is either the next round or the ending. The deadline is the
  next round's lock time and is the single most actionable line in the email, so it is stated in
  full rather than as "soon".
  */
  const deadlineText = next_deadline
    ? new Date(next_deadline).toLocaleDateString('en-GB', {
        weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit'
      })
    : null;

  const fixtureLines = (next_fixtures || []).map((f) => `${f.home} v ${f.away}`);

  let nextHeading;
  let nextBody;
  if (competition_complete) {
    if (is_draw) {
      nextHeading = 'That is the end of it';
      nextBody = winner_names
        ? `${competition_name} finishes with ${survivors_count} players still standing, so the win is shared between ${winner_names}.`
        : `Everybody still standing went out in the same round, so ${competition_name} finishes without a winner.`;
    } else {
      nextHeading = `${winner_names} wins`;
      nextBody = `That is ${competition_name} settled after ${round_number} ${round_number === 1 ? 'round' : 'rounds'}.`;
    }
  } else {
    nextHeading = `Round ${next_round_number}`;
    nextBody = deadlineText
      ? `Picks close ${deadlineText}.`
      : 'Fixtures are up now.';
  }

  const actionUrl = competition_complete
    ? `${process.env.PLAYER_FRONTEND_URL}/game/${competition_id}/standings?email_id=${email_tracking_id}`
    : `${process.env.PLAYER_FRONTEND_URL}/game/${competition_id}/pick?email_id=${email_tracking_id}`;

  const buttonLabel = competition_complete
    ? 'See the final table'
    : survived
    ? `Make your Round ${next_round_number} pick`
    : 'See how it finishes';

  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${competition_name} — Round ${round_number} results</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; margin: 0; padding: 0; background-color: #f8fafc;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 0;">

          <!-- Header -->
          <div style="background-color: #1e293b; padding: 30px 20px; text-align: center;">
            <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 600;">LMS Local</h1>
            <p style="color: #cbd5e1; margin: 8px 0 0 0; font-size: 14px;">${competition_name} — Round ${round_number}</p>
          </div>

          <!-- Main Content -->
          <div style="padding: 40px 30px;">

            <h2 style="color: #0f172a; margin: 0 0 16px 0; font-size: 20px; font-weight: 600;">Hi ${user_display_name},</h2>

            <!-- Block 1: your own result -->
            <div style="background: ${survived ? '#f0fdf4' : '#fef2f2'}; border-left: 4px solid ${survived ? '#16a34a' : '#dc2626'}; padding: 20px; margin: 0 0 24px 0;">
              <p style="margin: 0; color: #0f172a; font-size: 16px;">${yourResult}</p>
            </div>

            <!-- Block 2: the round -->
            <div style="background: #f1f5f9; border-left: 4px solid #475569; padding: 20px; margin: 0 0 24px 0;">
              ${roundLines.map((line) => `<p style="margin: 0 0 8px 0; color: #475569; font-size: 15px;">${line}</p>`).join('')}
            </div>

            <!-- Block 3: what next -->
            <h3 style="color: #0f172a; margin: 0 0 8px 0; font-size: 17px; font-weight: 600;">${nextHeading}</h3>
            <p style="color: #334155; font-size: 15px; margin: 0 0 ${fixtureLines.length ? '12' : '24'}px 0;">${nextBody}</p>

            ${fixtureLines.length ? `
            <ul style="margin: 0 0 24px 0; padding-left: 20px; color: #334155; font-size: 15px;">
              ${fixtureLines.map((line) => `<li style="margin: 0 0 4px 0;">${line}</li>`).join('')}
            </ul>
            ` : ''}

            <!-- Call to Action Button -->
            <div style="margin: 0 0 24px 0;">
              <a href="${actionUrl}"
                 style="display: block; background-color: #475569; color: #ffffff; padding: 16px 32px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px; text-align: center;">
                ${buttonLabel}
              </a>
            </div>

          </div>

          ${footer.html}

        </div>
      </body>
    </html>
  `;

  const textContent = `
${competition_name} - Round ${round_number} results

Hi ${user_display_name},

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${yourResult}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${roundLines.join('\n')}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${nextHeading.toUpperCase()}

${nextBody}
${fixtureLines.length ? '\n' + fixtureLines.map((l) => `  ${l}`).join('\n') + '\n' : ''}
${buttonLabel}:
${actionUrl}

${footer.text}
  `;

  return {
    from: `LMS Local <${process.env.EMAIL_FROM}>`,
    to: [email],
    subject: roundOverSubjectFor(competition_name, round_number),
    html: htmlContent,
    text: textContent,
    headers: {
      'X-Entity-Ref-ID': email_tracking_id,
      ...(unsubscribe?.headers || {})
    },
    tags: [
      { name: 'email_type', value: 'results' },
      { name: 'competition_id', value: String(competition_id) }
    ]
  };
};

/**
 * Send the Round Over email.
 * @param {string} email - recipient
 * @param {object} templateData - as built by services/roundOver.js
 * @param {object} [options] - { testMode, testRecipient }, see deliver()
 */
const sendRoundOverEmail = async (email, templateData, options = {}) => {
  try {
    const result = await deliver(buildRoundOverEmail(email, templateData), options);
    return readSendResult(result);
  } catch (error) {
    console.error('Failed to send round over email:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Build any hint email without sending it.
 *
 * Outline rows: Organiser | Info | Hint - *. ONE builder for every hint, not one per hint - the
 * hints differ only in their words, and those live in services/hints.js where the list is edited.
 * A new hint is an entry there and needs nothing here.
 *
 * The copy arrives already resolved on templateData (heading, body, cta), stored at queue time, so
 * a queued hint renders as it was written even if the list changes before it is sent.
 *
 * @param {string} email - recipient
 * @param {object} templateData - as built by services/hints.js
 * @returns {{subject: string, html: string, text: string, from: string, headers: object, tags: object[]}}
 */
const buildHintEmail = (email, templateData) => {
  const {
    user_display_name,
    competition_name,
    competition_id,
    hint_key,
    heading,
    body,
    cta_label,
    cta_path,
    email_tracking_id,
    unsubscribe
  } = templateData;

  const footer = buildEmailFooter(unsubscribe?.url || null);
  const paragraphs = Array.isArray(body) ? body : [String(body)];
  const ctaUrl = `${process.env.PLAYER_FRONTEND_URL}${cta_path}?email_id=${email_tracking_id}`;

  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${heading}</title>
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

            <h2 style="color: #0f172a; margin: 0 0 16px 0; font-size: 20px; font-weight: 600;">Hi ${user_display_name},</h2>

            <p style="color: #0f172a; font-size: 17px; font-weight: 600; margin: 0 0 16px 0;">${heading}</p>

            ${paragraphs.map((p) => `<p style="color: #334155; font-size: 15px; margin: 0 0 16px 0; line-height: 1.5;">${p}</p>`).join('')}

            <!-- Call to Action Button -->
            <div style="margin: 24px 0;">
              <a href="${ctaUrl}"
                 style="display: block; background-color: #475569; color: #ffffff; padding: 16px 32px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px; text-align: center;">
                ${cta_label}
              </a>
            </div>

            <p style="color: #64748b; font-size: 14px; margin: 0; line-height: 1.5;">
              These are occasional tips for organisers — a handful in total, not a series.
            </p>

          </div>

          ${footer.html}

        </div>
      </body>
    </html>
  `;

  const textContent = `
${heading}

Hi ${user_display_name},

${paragraphs.join('\n\n')}

${cta_label}:
${ctaUrl}

These are occasional tips for organisers - a handful in total, not a series.

${footer.text}
  `;

  return {
    from: `LMS Local <${process.env.EMAIL_FROM}>`,
    to: [email],
    subject: hintSubjectFor(hint_key),
    html: htmlContent,
    text: textContent,
    headers: {
      'X-Entity-Ref-ID': email_tracking_id,
      ...(unsubscribe?.headers || {})
    },
    tags: [
      { name: 'email_type', value: hint_key },
      { name: 'competition_id', value: String(competition_id) }
    ]
  };
};

/**
 * Send a hint.
 * @param {string} email - recipient
 * @param {object} templateData - as built by services/hints.js
 * @param {object} [options] - { testMode, testRecipient }, see deliver()
 */
const sendHintEmail = async (email, templateData, options = {}) => {
  try {
    const result = await deliver(buildHintEmail(email, templateData), options);
    return readSendResult(result);
  } catch (error) {
    console.error('Failed to send hint email:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Escape text destined for an HTML email.
 *
 * Every other template here interpolates values that came from our own database - team names,
 * round numbers - and escaping them would be noise. A broadcast interpolates a sentence somebody
 * typed into a form, so an unescaped `<` is at best a mangled email and at worst markup the
 * operator did not intend to send.
 */
const escapeHtml = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

/**
 * Build an admin broadcast without sending it.
 *
 * Outline row: All | Info | Broadcast from Admin. The operator writes the subject and the message;
 * everything else is the usual chrome plus the unsubscribe footer, which matters more here than
 * anywhere else - this is the one email nobody asked for.
 *
 * Blank lines become paragraphs and single newlines become line breaks, so a message typed into a
 * textarea arrives looking like what was typed. There is no other formatting: no markdown, no
 * HTML pass-through. See escapeHtml.
 *
 * @param {string} email - recipient
 * @param {object} templateData - as built by services/broadcast.js
 * @returns {{subject: string, html: string, text: string, from: string, headers: object, tags: object[]}}
 */
const buildBroadcastEmail = (email, templateData) => {
  const {
    user_display_name,
    subject,
    message,
    competition_id,
    email_tracking_id,
    unsubscribe
  } = templateData;

  const footer = buildEmailFooter(unsubscribe?.url || null);

  const paragraphs = String(message || '')
    .split(/\n\s*\n/)
    .map((block) => escapeHtml(block.trim()).replace(/\n/g, '<br>'))
    .filter(Boolean);

  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${escapeHtml(subject)}</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; margin: 0; padding: 0; background-color: #f8fafc;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 0;">

          <!-- Header -->
          <div style="background-color: #1e293b; padding: 30px 20px; text-align: center;">
            <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 600;">LMS Local</h1>
          </div>

          <!-- Main Content -->
          <div style="padding: 40px 30px;">

            <h2 style="color: #0f172a; margin: 0 0 16px 0; font-size: 20px; font-weight: 600;">Hi ${escapeHtml(user_display_name)},</h2>

            ${paragraphs.map((p) => `<p style="color: #334155; font-size: 15px; margin: 0 0 16px 0; line-height: 1.5;">${p}</p>`).join('')}

          </div>

          ${footer.html}

        </div>
      </body>
    </html>
  `;

  const textContent = `
${subject}

Hi ${user_display_name},

${message}

${footer.text}
  `;

  return {
    from: `LMS Local <${process.env.EMAIL_FROM}>`,
    to: [email],
    subject,
    html: htmlContent,
    text: textContent,
    headers: {
      'X-Entity-Ref-ID': email_tracking_id,
      ...(unsubscribe?.headers || {})
    },
    tags: [
      { name: 'email_type', value: 'broadcast_admin' },
      // Only present for a competition-scoped broadcast; deliver() reads it for per-competition mutes.
      ...(competition_id ? [{ name: 'competition_id', value: String(competition_id) }] : [])
    ]
  };
};

/**
 * Send an admin broadcast.
 * @param {string} email - recipient
 * @param {object} templateData - as built by services/broadcast.js
 * @param {object} [options] - { testMode, testRecipient }, see deliver()
 */
const sendBroadcastEmail = async (email, templateData, options = {}) => {
  try {
    const result = await deliver(buildBroadcastEmail(email, templateData), options);
    return readSendResult(result);
  } catch (error) {
    console.error('Failed to send broadcast email:', error);
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

    // Normalize competition_status to lowercase for comparison
    const normalizedStatus = (competition_status || '').toLowerCase();

    if (normalizedStatus === 'complete') {
      // Competition has ended - show final results
      if (new_status === 'active') {
        // Player survived to the end AND competition is complete
        // This can ONLY mean they are the sole winner
        statusMessage = '<p style="color: #16a34a; font-size: 20px; font-weight: 700; margin: 20px 0 0 0;">🏆 Congratulations! You won the competition!</p>';
      } else {
        // new_status === 'eliminated'
        // Player was eliminated in final round
        // Check if competition ended in DRAW (zero survivors)
        // Convert to number for comparison (could be string from JSON)
        if (parseInt(active_player_count) === 0) {
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

              <!-- Call to Action Button -->
              <div style="margin: 40px 0;">
                <a href="${viewCompetitionUrl}"
                   style="display: block; background-color: #475569; color: #ffffff; padding: 16px 32px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px; text-align: center;">
                  View Full Results
                </a>
              </div>

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

    return readSendResult(result);

  } catch (error) {
    console.error('Failed to send results email:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Build the Join Comp welcome without sending it.
 *
 * Outline row: Player | Welcome | Join Comp. One per membership, when someone joins a competition.
 *
 * Content carried over from the sender this replaces - the rules of the competition they have
 * actually joined, which vary by competition, plus the next deadline if a round is open. What it
 * gains is the unsubscribe footer and headers every comms email now needs, and a send that goes
 * through deliver(): the old one called resend.emails.send directly, so test mode never applied
 * to it.
 *
 * @param {string} email - recipient
 * @param {object} templateData - as built by services/joinComp.js
 * @returns {{subject: string, html: string, text: string, from: string, headers: object, tags: object[]}}
 */
const buildWelcomeCompetitionEmail = (email, templateData) => {
  const {
    user_display_name,
    competition_name,
    organizer_name,
    lives_per_player,
    no_team_twice,
    next_round_number,
    next_round_lock_time,
    competition_id,
    email_tracking_id,
    unsubscribe
  } = templateData;

  const footer = buildEmailFooter(unsubscribe?.url || null);

  // Only shown when a round is actually open. Joining between rounds is normal.
  let nextRoundHtml = '';
  let nextRoundText = '';
  if (next_round_number && next_round_lock_time) {
    const formattedDate = new Date(next_round_lock_time).toLocaleDateString('en-GB', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
    nextRoundHtml = `
            <p style="color: #334155; font-size: 16px; margin: 0 0 24px 0; line-height: 1.5;">
              <strong>Round ${next_round_number}</strong> is open. Make your pick before <strong>${formattedDate}</strong>.
            </p>`;
    nextRoundText = `\nRound ${next_round_number} is open. Make your pick before ${formattedDate}.\n`;
  }

  /*
  0 lives is the knockout format and is the common setting, but "you start with 0 lives" reads as
  a bug rather than a rule. Say what it means instead.
  */
  const livesLine = lives_per_player === 0
    ? 'One wrong pick and you are out - there are no second chances in this one'
    : `You start with <strong>${lives_per_player} ${lives_per_player === 1 ? 'life' : 'lives'}</strong>, so a wrong pick does not end it straight away`;
  const livesLineText = lives_per_player === 0
    ? 'One wrong pick and you are out - there are no second chances in this one'
    : `You start with ${lives_per_player} ${lives_per_player === 1 ? 'life' : 'lives'}, so a wrong pick does not end it straight away`;
  const teamRule = no_team_twice
    ? 'You cannot pick the same team twice'
    : 'You can pick any team more than once';

  const viewCompetitionUrl = `${process.env.PLAYER_FRONTEND_URL}/game/${competition_id}?email_id=${email_tracking_id}`;

  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Welcome to ${competition_name}</title>
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

            <h2 style="color: #0f172a; margin: 0 0 16px 0; font-size: 20px; font-weight: 600;">Hi ${user_display_name},</h2>

            <p style="color: #334155; font-size: 16px; margin: 0 0 24px 0; line-height: 1.5;">
              You are in <strong>${competition_name}</strong>, organised by ${organizer_name}.
            </p>
${nextRoundHtml}
            <!-- The rules of THIS competition, which vary -->
            <div style="background: #f1f5f9; border-left: 4px solid #475569; padding: 20px; margin: 0 0 24px 0;">
              <h3 style="color: #0f172a; margin: 0 0 12px 0; font-size: 16px; font-weight: 600;">How this one is set up</h3>
              <ul style="margin: 0; padding-left: 20px; color: #334155; font-size: 15px; line-height: 1.6;">
                <li>Win and you go through. Draw or lose and you do not.</li>
                <li>${livesLine}</li>
                <li>${teamRule}</li>
                <li>Missing the deadline counts the same as losing</li>
              </ul>
            </div>

            <h3 style="color: #0f172a; margin: 0 0 12px 0; font-size: 18px; font-weight: 600;">How to play</h3>
            <p style="color: #334155; font-size: 15px; margin: 0 0 12px 0; line-height: 1.5;">
              1. <strong>Look at the fixtures</strong> for the round<br>
              2. <strong>Pick one team</strong> you think will win<br>
              3. <strong>Wait for the results</strong><br>
              4. <strong>Be the last one standing</strong>
            </p>

            <!-- Call to Action Button -->
            <div style="margin: 40px 0;">
              <a href="${viewCompetitionUrl}"
                 style="display: block; background-color: #475569; color: #ffffff; padding: 16px 32px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px; text-align: center;">
                ${next_round_number ? 'Make your first pick' : 'View your competition'}
              </a>
            </div>

          </div>

          ${footer.html}

        </div>
      </body>
    </html>
  `;

  const textContent = `
Welcome to ${competition_name}

Hi ${user_display_name},

You are in ${competition_name}, organised by ${organizer_name}.
${nextRoundText}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

HOW THIS ONE IS SET UP

  - Win and you go through. Draw or lose and you do not.
  - ${livesLineText}
  - ${teamRule}
  - Missing the deadline counts the same as losing

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

HOW TO PLAY

  1. Look at the fixtures for the round
  2. Pick one team you think will win
  3. Wait for the results
  4. Be the last one standing

${next_round_number ? 'Make your first pick:' : 'View your competition:'}
${viewCompetitionUrl}

${footer.text}
  `;

  return {
    from: `${organizer_name} via LMS Local <${process.env.EMAIL_FROM}>`,
    to: [email],
    subject: joinCompSubjectFor(competition_name),
    html: htmlContent,
    text: textContent,
    headers: {
      'X-Entity-Ref-ID': email_tracking_id,
      ...(unsubscribe?.headers || {})
    },
    tags: [
      { name: 'email_type', value: 'welcome' },
      { name: 'competition_id', value: String(competition_id) }
    ]
  };
};

/**
 * Send the Join Comp welcome.
 * @param {string} email - recipient
 * @param {object} templateData - as built by services/joinComp.js
 * @param {object} [options] - { testMode, testRecipient }, see deliver()
 */
const sendWelcomeCompetitionEmail = async (email, templateData, options = {}) => {
  try {
    const result = await deliver(buildWelcomeCompetitionEmail(email, templateData), options);
    return readSendResult(result);
  } catch (error) {
    console.error('Failed to send welcome email:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Send organiser tip email
 * @param {Object} templateData - Email template data from queue
 */
const sendOrganiserTipEmail = async (templateData) => {
  try {
    const {
      organiser_email,
      competition_name,
      competition_id,
      tip_title,
      tip_content
    } = templateData;

    const manageUrl = `${process.env.ADMIN_FRONTEND_URL}/game/${competition_id}/manage`;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Organiser Tip - ${competition_name}</title>
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; margin: 0; padding: 0; background-color: #f8fafc;">
          <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 32px;">

            <!-- Header -->
            <div style="text-align: center; margin-bottom: 32px;">
              <h1 style="color: #1e293b; margin: 0; font-size: 24px;">LMS Local</h1>
              <p style="color: #64748b; margin: 8px 0 0 0; font-size: 14px;">Competition Management</p>
            </div>

            <!-- Tip Badge -->
            <div style="background: linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%); padding: 24px; border-radius: 12px; margin-bottom: 24px; border-left: 4px solid #3b82f6;">
              <div style="font-size: 32px; margin-bottom: 12px;">💡</div>
              <h2 style="color: #1e293b; margin: 0 0 16px 0; font-size: 20px;">${tip_title}</h2>
              <div style="color: #475569; font-size: 15px; line-height: 1.6; white-space: pre-line;">${tip_content}</div>
            </div>

            <!-- Competition Context -->
            <div style="background-color: #f8fafc; padding: 16px; border-radius: 8px; margin-bottom: 24px;">
              <p style="color: #64748b; margin: 0; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600;">Competition</p>
              <p style="color: #1e293b; margin: 8px 0 0 0; font-size: 16px; font-weight: 500;">${competition_name}</p>
            </div>

            <!-- CTA Button -->
            <div style="text-align: center; margin: 32px 0;">
              <a href="${manageUrl}"
                 style="display: inline-block; background-color: #1e293b; color: #ffffff; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 15px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                Manage Competition →
              </a>
            </div>

            <!-- Footer -->
            <div style="text-align: center; margin-top: 32px; padding-top: 24px; border-top: 1px solid #e2e8f0;">
              <p style="color: #94a3b8; font-size: 13px; margin: 0;">
                You received this tip because you're the organiser of <strong>${competition_name}</strong>
              </p>
              <p style="color: #cbd5e1; font-size: 12px; margin: 16px 0 0 0;">
                LMS Local - Last Man Standing Competitions
              </p>
            </div>
          </div>
        </body>
      </html>
    `;

    const textContent = `
      LMS Local - Organiser Tip

      ${tip_title}

      ${tip_content}

      Competition: ${competition_name}

      Manage your competition: ${manageUrl}

      ---
      You received this tip because you're the organiser of ${competition_name}
      LMS Local - Last Man Standing Competitions
    `;

    // Send email via Resend
    const result = await sendEmail({
      from: `${process.env.EMAIL_NAME} <${process.env.EMAIL_FROM}>`,
      to: [organiser_email],
      subject: `💡 Tip: ${tip_title}`,
      html: htmlContent,
      text: textContent,
    });

    return readSendResult(result);

  } catch (error) {
    console.error('Failed to send organiser tip email:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Send onboarding application notification to admin
 * @param {Object} applicationData - Application details
 * @returns {Object} Result object with success status
 */
const sendOnboardingNotification = async (applicationData) => {
  try {
    const {
      applicationId,
      venueName,
      venueType,
      contactName,
      email,
      phone,
      estimatedPlayers,
      preferredStartDate,
      description
    } = applicationData;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>New Onboarding Application - LMS Local</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; margin: 0; padding: 0; background-color: #f4f4f4;">
          <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 20px;">
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="color: #10b981; margin: 0;">New Onboarding Application</h1>
              <p style="color: #666; margin: 5px 0 0 0;">LMS Local - Free Launch Package</p>
            </div>

            <div style="background: #f9fafb; padding: 20px; border-radius: 10px; border-left: 4px solid #10b981;">
              <h2 style="color: #1f2937; margin-top: 0;">Application #${applicationId}</h2>

              <h3 style="color: #374151; margin-top: 20px; margin-bottom: 10px;">Venue Information</h3>
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px 0; color: #6b7280; font-weight: bold; width: 40%;">Venue Name:</td>
                  <td style="padding: 8px 0; color: #1f2937;">${venueName}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #6b7280; font-weight: bold;">Venue Type:</td>
                  <td style="padding: 8px 0; color: #1f2937;">${venueType}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #6b7280; font-weight: bold;">Estimated Players:</td>
                  <td style="padding: 8px 0; color: #1f2937;">${estimatedPlayers}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #6b7280; font-weight: bold;">Preferred Start:</td>
                  <td style="padding: 8px 0; color: #1f2937;">${preferredStartDate}</td>
                </tr>
              </table>

              <h3 style="color: #374151; margin-top: 20px; margin-bottom: 10px;">Contact Details</h3>
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px 0; color: #6b7280; font-weight: bold; width: 40%;">Contact Name:</td>
                  <td style="padding: 8px 0; color: #1f2937;">${contactName}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #6b7280; font-weight: bold;">Email:</td>
                  <td style="padding: 8px 0; color: #1f2937;"><a href="mailto:${email}" style="color: #2563eb;">${email}</a></td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #6b7280; font-weight: bold;">Phone:</td>
                  <td style="padding: 8px 0; color: #1f2937;"><a href="tel:${phone}" style="color: #2563eb;">${phone}</a></td>
                </tr>
              </table>

              ${description ? `
              <h3 style="color: #374151; margin-top: 20px; margin-bottom: 10px;">Additional Information</h3>
              <p style="color: #4b5563; background: white; padding: 15px; border-radius: 5px; margin: 0;">${description}</p>
              ` : ''}
            </div>

            <div style="text-align: center; margin-top: 20px; color: #9ca3af; font-size: 12px;">
              <p>LMS Local - Admin-first Last Man Standing competitions</p>
            </div>
          </div>
        </body>
      </html>
    `;

    const textContent = `
      New Onboarding Application - LMS Local

      Application #${applicationId}

      VENUE INFORMATION
      Venue Name: ${venueName}
      Venue Type: ${venueType}
      Estimated Players: ${estimatedPlayers}
      Preferred Start: ${preferredStartDate}

      CONTACT DETAILS
      Contact Name: ${contactName}
      Email: ${email}
      Phone: ${phone}

      ${description ? `ADDITIONAL INFORMATION\n${description}` : ''}
    `;

    const result = await sendEmail({
      from: `${process.env.EMAIL_NAME} <${process.env.EMAIL_FROM}>`,
      to: process.env.ADMIN_EMAIL || 'aandreou25@gmail.com',
      subject: `New Onboarding Application: ${venueName}`,
      html: htmlContent,
      text: textContent
    });

    return readSendResult(result);
  } catch (error) {
    console.error('Failed to send onboarding notification:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Send confirmation email to onboarding applicant
 * @param {string} email - Applicant email
 * @param {string} contactName - Applicant name
 * @returns {Object} Result object with success status
 */
const sendOnboardingConfirmation = async (email, contactName) => {
  try {
    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Application Received - LMS Local</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; margin: 0; padding: 0; background-color: #f4f4f4;">
          <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 20px;">
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="color: #10b981; margin: 0;">LMS Local</h1>
              <p style="color: #666; margin: 5px 0 0 0;">Last Man Standing Competitions</p>
            </div>

            <div style="background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%); padding: 30px; border-radius: 10px; text-align: center;">
              <h2 style="color: #1f2937; margin-top: 0;">Application Received! ✅</h2>
              <p style="color: #4b5563; margin-bottom: 25px;">Hi ${contactName},</p>
              <p style="color: #4b5563; margin-bottom: 25px;">
                Thank you for applying for our free Done-For-You Launch Package! We've received your application and will review it shortly.
              </p>

              <div style="background: white; padding: 20px; border-radius: 8px; margin: 25px 0; border-left: 4px solid #10b981;">
                <h3 style="color: #1f2937; margin-top: 0; font-size: 18px;">What happens next?</h3>
                <ul style="color: #4b5563; text-align: left; margin: 0; padding-left: 20px;">
                  <li style="margin-bottom: 10px;"><strong>Within 24 hours</strong>: We'll review your application and reach out via email or phone</li>
                  <li style="margin-bottom: 10px;"><strong>30-minute call</strong>: We'll discuss your requirements and competition setup</li>
                  <li style="margin-bottom: 10px;"><strong>Full setup</strong>: We'll configure everything for you to get started</li>
                  <li><strong>Ongoing support</strong>: Weekly check-ins throughout your first competition</li>
                </ul>
              </div>

              <p style="color: #6b7280; font-size: 14px; margin-top: 25px;">
                Have questions in the meantime? Feel free to reply to this email.
              </p>
            </div>

            <div style="text-align: center; margin-top: 20px; color: #9ca3af; font-size: 12px;">
              <p>LMS Local - Admin-first Last Man Standing competitions</p>
              <p>We'll be in touch soon!</p>
            </div>
          </div>
        </body>
      </html>
    `;

    const textContent = `
      LMS Local - Application Received

      Hi ${contactName},

      Thank you for applying for our free Done-For-You Launch Package! We've received your application and will review it shortly.

      What happens next?

      - Within 24 hours: We'll review your application and reach out via email or phone
      - 30-minute call: We'll discuss your requirements and competition setup
      - Full setup: We'll configure everything for you to get started
      - Ongoing support: Weekly check-ins throughout your first competition

      Have questions in the meantime? Feel free to reply to this email.

      We'll be in touch soon!

      LMS Local - Admin-first Last Man Standing competitions
    `;

    const result = await sendEmail({
      from: `${process.env.EMAIL_NAME} <${process.env.EMAIL_FROM}>`,
      to: email,
      subject: 'Application Received - LMS Local Free Launch Package',
      html: htmlContent,
      text: textContent
    });

    return readSendResult(result);
  } catch (error) {
    console.error('Failed to send onboarding confirmation:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Send competition announcement email to a user
 * @param {string} email - User's email address
 * @param {object} templateData - All data needed for email template
 * @returns {Object} Result object with success status and resend_message_id
 */
const sendCompetitionAnnouncementEmail = async (email, templateData) => {
  try {
    // Extract template data for easier access
    const {
      user_display_name,
      competition_name,
      access_code,
      competition_id,
      unsubscribe_token,
      email_tracking_id
    } = templateData;

    // Build the join URL from the invite code. This previously pointed at /competition/{slug},
    // a route that does not exist, using a column that was never populated.
    const joinUrl = `${process.env.PLAYER_FRONTEND_URL}/join/${access_code}`;

    // Build unsubscribe URL using EMAIL_VERIFICATION_URL (server-side GET route, same as verify-email)
    const unsubscribeUrl = `${process.env.EMAIL_VERIFICATION_URL}/unsubscribe?token=${unsubscribe_token}`;

    // HTML email content
    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>New Competition: ${competition_name} - LMS Local</title>
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; margin: 0; padding: 0; background-color: #f8fafc;">
          <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 0;">

            <!-- Header -->
            <div style="background-color: #1e293b; padding: 30px 20px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 600;">LMS Local</h1>
              <p style="color: #cbd5e1; margin: 8px 0 0 0; font-size: 14px;">New Competition Available</p>
            </div>

            <!-- Main Content -->
            <div style="padding: 40px 30px;">

              <!-- Greeting -->
              <h2 style="color: #0f172a; margin: 0 0 16px 0; font-size: 20px; font-weight: 600;">Hi ${user_display_name},</h2>

              <!-- Main Message -->
              <p style="color: #334155; font-size: 16px; margin: 0 0 24px 0; line-height: 1.5;">
                A new Last Man Standing competition is starting and you're invited to join!
              </p>

              <!-- Competition Info Box -->
              <div style="background: #f1f5f9; border-left: 4px solid #2563eb; padding: 20px; margin: 0 0 30px 0; border-radius: 0 6px 6px 0;">
                <p style="margin: 0 0 8px 0; color: #0f172a; font-size: 18px; font-weight: 600;">${competition_name}</p>
                <p style="margin: 0; color: #475569; font-size: 14px;">Access Code: <strong>${access_code}</strong></p>
              </div>

              <!-- How to Join -->
              <div style="margin: 0 0 30px 0;">
                <h3 style="color: #0f172a; margin: 0 0 12px 0; font-size: 16px; font-weight: 600;">How to Join</h3>
                <ol style="color: #334155; font-size: 15px; margin: 0; padding-left: 20px; line-height: 1.8;">
                  <li>Click the button below or visit LMS Local</li>
                  <li>Enter access code: <strong>${access_code}</strong></li>
                  <li>Make your pick and you're in!</li>
                </ol>
              </div>

              <!-- Call to Action Button -->
              <div style="margin: 40px 0; text-align: center;">
                <a href="${joinUrl}"
                   style="display: inline-block; background-color: #2563eb; color: #ffffff; padding: 16px 40px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;">
                  Join Competition
                </a>
              </div>

              <!-- Sign Off -->
              <p style="color: #64748b; font-size: 14px; margin: 0; line-height: 1.5;">
                Good luck!<br>
                The LMS Local Team
              </p>

            </div>

            <!-- Footer -->
            <div style="background-color: #f8fafc; padding: 20px 30px; border-top: 1px solid #e2e8f0;">
              <p style="color: #94a3b8; font-size: 12px; margin: 0 0 4px 0;">
                LMS Local - Last Man Standing Competitions
              </p>
              <p style="color: #cbd5e1; font-size: 11px; margin: 0 0 8px 0;">
                ${email}
              </p>
              <p style="margin: 0;">
                <a href="${unsubscribeUrl}" style="color: #94a3b8; font-size: 11px; text-decoration: underline;">
                  Unsubscribe from competition announcements
                </a>
              </p>
            </div>

          </div>
        </body>
      </html>
    `;

    // Plain text version for email clients that don't support HTML
    const textContent = `
New Competition: ${competition_name} - LMS Local

Hi ${user_display_name},

A new Last Man Standing competition is starting and you're invited to join!

COMPETITION: ${competition_name}
ACCESS CODE: ${access_code}

HOW TO JOIN:
1. Visit LMS Local: ${joinUrl}
2. Enter access code: ${access_code}
3. Make your pick and you're in!

Good luck!
The LMS Local Team

---
LMS Local - Last Man Standing Competitions
${email}

Unsubscribe from competition announcements: ${unsubscribeUrl}
    `;

    // Send email via Resend (uses sendEmail wrapper for test override)
    const result = await sendEmail({
      from: `${process.env.EMAIL_NAME} <${process.env.EMAIL_FROM}>`,
      to: [email],
      subject: `New Competition: ${competition_name} - LMS Local`,
      html: htmlContent,
      text: textContent,
      headers: {
        'X-Entity-Ref-ID': email_tracking_id, // For webhook correlation
      },
      tags: [
        { name: 'email_type', value: 'competition_announcement' },
        { name: 'competition_id', value: String(competition_id) }
      ]
    });

    // Resend returns { data: { id: '...' }, error: null } format
    const resendMessageId = result?.data?.id || result?.id || 'unknown';

    return readSendResult(result);

  } catch (error) {
    console.error('Failed to send competition announcement email:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Send a message from the public contact form to the LMSLocal inbox.
 * reply_to is set to the sender so a reply goes straight back to them.
 * @param {object} message - { name, email, subject, body }
 */
const sendContactMessage = async (message) => {
  const { name, email, subject, body } = message;
  const escape = (v) => String(v || '').replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]));

  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head><meta charset="utf-8"><title>Contact message - LMSLocal</title></head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; margin: 0; padding: 20px; background-color: #f4f4f4;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 24px;">
          <h1 style="margin: 0 0 4px 0; font-size: 20px; color: #1C2620;">Contact message</h1>
          <p style="margin: 0 0 20px 0; color: #6b7280; font-size: 14px;">Sent from the help centre</p>
          <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
            <tr><td style="padding: 6px 0; color: #6b7280; width: 90px;">From</td><td style="padding: 6px 0;">${escape(name)}</td></tr>
            <tr><td style="padding: 6px 0; color: #6b7280;">Email</td><td style="padding: 6px 0;"><a href="mailto:${escape(email)}">${escape(email)}</a></td></tr>
            <tr><td style="padding: 6px 0; color: #6b7280;">About</td><td style="padding: 6px 0;">${escape(subject)}</td></tr>
          </table>
          <div style="margin-top: 20px; padding: 16px; background: #f9fafb; border-left: 3px solid #C8341E; white-space: pre-wrap;">${escape(body)}</div>
        </div>
      </body>
    </html>
  `;

  const result = await sendEmail({
    from: `${process.env.EMAIL_NAME} <${process.env.EMAIL_FROM}>`,
    to: ['lmslocal8@gmail.com'],
    reply_to: email,
    subject: `Contact: ${subject} - ${name}`,
    html: htmlContent
  });

  return readSendResult(result);
};

module.exports = {
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendPlayerMagicLink,
  sendPaymentConfirmationEmail,
  buildPickReminderEmail,
  sendPickReminderEmail,
  buildJoinLmsEmail,
  sendJoinLmsEmail,
  buildCreatedCompEmail,
  sendCreatedCompEmail,
  buildWelcomeCompetitionEmail,
  sendWelcomeCompetitionEmail,
  buildGameStartReminderEmail,
  sendGameStartReminderEmail,
  buildFixtureReminderEmail,
  sendFixtureReminderEmail,
  buildResultReminderEmail,
  sendResultReminderEmail,
  buildGameCompleteEmail,
  sendGameCompleteEmail,
  buildRoundOverEmail,
  sendRoundOverEmail,
  buildHintEmail,
  sendHintEmail,
  buildBroadcastEmail,
  sendBroadcastEmail,
  sendResultsEmail,
  sendOrganiserTipEmail,
  sendOnboardingNotification,
  sendOnboardingConfirmation,
  sendCompetitionAnnouncementEmail,
  sendContactMessage
};