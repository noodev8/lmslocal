/**
 * Temporary utility: Send pick reminder emails to players who haven't picked yet.
 * Reads emails from ../reminder.csv and sends via Resend.
 *
 * Usage:
 *   node send-reminder.js              # Dry run (no emails sent)
 *   node send-reminder.js --send       # Actually send emails
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);
const DRY_RUN = !process.argv.includes('--send');
const PREVIEW_EMAIL = 'aandreou25@gmail.com';

const FROM_ADDRESS = `${process.env.EMAIL_NAME} <${process.env.EMAIL_FROM}>`;
const SUBJECT = 'Pick Reminder - Get your pick in!';

function buildHtml(email) {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Pick Reminder - LMS Local</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; margin: 0; padding: 0; background-color: #f8fafc;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 0;">

          <!-- Header -->
          <div style="background-color: #1e293b; padding: 30px 20px; text-align: center;">
            <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 600;">LMS Local</h1>
            <p style="color: #cbd5e1; margin: 8px 0 0 0; font-size: 14px;">Last Man Standing</p>
          </div>

          <!-- Main Content -->
          <div style="padding: 40px 30px;">

            <h2 style="color: #0f172a; margin: 0 0 16px 0; font-size: 20px; font-weight: 600;">Hi there,</h2>

            <p style="color: #334155; font-size: 16px; margin: 0 0 24px 0; line-height: 1.5;">
              Just a friendly reminder - the next round locks at <strong>8pm this Friday night</strong>.
            </p>

            <div style="background: #f1f5f9; border-left: 4px solid #475569; padding: 20px; margin: 0 0 30px 0;">
              <p style="margin: 0 0 8px 0; color: #0f172a; font-size: 16px; font-weight: 600;">
                Don't forget to get your pick in before the deadline!
              </p>
              <p style="margin: 0; color: #475569; font-size: 15px;">
                Picks lock at 8pm Friday - make sure you're not caught out.
              </p>
            </div>

            <div style="margin: 40px 0;">
              <a href="${process.env.PLAYER_FRONTEND_URL}"
                 style="display: block; background-color: #475569; color: #ffffff; padding: 16px 32px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px; text-align: center;">
                Make Your Pick
              </a>
            </div>

            <p style="color: #64748b; font-size: 14px; margin: 0; line-height: 1.5;">
              Good luck!
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
}

function buildText() {
  return `
LMS Local - Pick Reminder

Hi there,

Just a friendly reminder - the next round kicks off at 8pm this Friday night.

Don't forget to get your pick in before the deadline!
Picks lock at 8pm Friday - make sure you're not caught out.

Make your pick: ${process.env.PLAYER_FRONTEND_URL}

Good luck!

---
LMS Local - Last Man Standing Competitions
  `.trim();
}

async function main() {
  // Read CSV
  const csvPath = path.join(__dirname, '..', 'reminder.csv');
  const csvContent = fs.readFileSync(csvPath, 'utf-8');
  const emails = csvContent
    .split('\n')
    .map(line => line.replace(/"/g, '').trim())
    .filter(line => line && line !== 'email' && line.includes('@'));

  console.log(`Found ${emails.length} emails to send to.`);

  if (DRY_RUN) {
    console.log(`\n*** DRY RUN - sending single preview to ${PREVIEW_EMAIL} ***\n`);
    try {
      const result = await resend.emails.send({
        from: FROM_ADDRESS,
        to: [PREVIEW_EMAIL],
        subject: `[PREVIEW] ${SUBJECT}`,
        html: buildHtml(PREVIEW_EMAIL),
        text: buildText(),
      });
      const messageId = result?.data?.id || result?.id || 'unknown';
      console.log(`Preview sent to ${PREVIEW_EMAIL} (id: ${messageId})`);
      console.log(`\nRecipient list that --send would email:`);
      emails.forEach(e => console.log(`  ${e}`));
    } catch (err) {
      console.error(`FAILED to send preview: ${err.message}`);
    }
    return;
  }

  console.log('\n*** LIVE MODE - sending emails ***\n');

  let sent = 0;
  let failed = 0;

  for (const email of emails) {

    try {
      const result = await resend.emails.send({
        from: FROM_ADDRESS,
        to: [email],
        subject: SUBJECT,
        html: buildHtml(email),
        text: buildText(),
      });

      const messageId = result?.data?.id || result?.id || 'unknown';
      console.log(`Sent to ${email} (id: ${messageId})`);
      sent++;

      // Small delay between sends to be polite to the API
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (err) {
      console.error(`FAILED to send to ${email}: ${err.message}`);
      failed++;
    }
  }

  console.log(`\nDone. Sent: ${sent}, Failed: ${failed}`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
