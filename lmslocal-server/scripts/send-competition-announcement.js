/*
=======================================================================================================================================
Script: send-competition-announcement.js
=======================================================================================================================================
Purpose: Send competition announcement email to players using Resend API
Usage:
  node scripts/send-competition-announcement.js --dry-run          # Preview only, no emails sent
  node scripts/send-competition-announcement.js --limit 5          # Send to first 5 players
  node scripts/send-competition-announcement.js                    # Send to all real players
=======================================================================================================================================
*/

require('dotenv').config();
const { Resend } = require('resend');
const fs = require('fs');
const path = require('path');

const resend = new Resend(process.env.RESEND_API_KEY);

// Parse command line arguments
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const limitIndex = args.indexOf('--limit');
const limit = limitIndex !== -1 ? parseInt(args[limitIndex + 1], 10) : null;

// Rate limiting: 1000ms between emails (1 per second to be safe)
const DELAY_MS = 1000;

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const loadPlayersFromCSV = () => {
  const csvPath = path.join(__dirname, '..', '..', 'players.csv');
  const content = fs.readFileSync(csvPath, 'utf-8');
  const lines = content.trim().split('\n');

  // Skip header row
  const emails = lines.slice(1).map(line => line.trim()).filter(email => email);

  // Filter out bots and test emails
  const realEmails = emails.filter(email => {
    if (email.startsWith('bot_')) return false;
    if (email.endsWith('@lms-guest.com')) return false;
    if (email.endsWith('@test.com')) return false;
    return true;
  });

  return realEmails;
};

const getEmailContent = () => {
  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Last Man Standing - £200 Prize Competition</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; margin: 0; padding: 0; background-color: #f8fafc;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 0;">

          <!-- Header -->
          <div style="background-color: #1e293b; padding: 30px 20px; text-align: center;">
            <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 600;">Last Man Standing</h1>
            <p style="color: #fbbf24; margin: 12px 0 0 0; font-size: 20px; font-weight: 600;">£200 Prize Competition</p>
          </div>

          <!-- Main Content -->
          <div style="padding: 40px 30px;">

            <!-- Greeting -->
            <p style="color: #334155; font-size: 16px; margin: 0 0 24px 0; line-height: 1.5;">
              Hi everyone,
            </p>

            <!-- Main Message -->
            <p style="color: #334155; font-size: 16px; margin: 0 0 24px 0; line-height: 1.5;">
              We're excited to announce that our <strong>FREE Last Man Standing competition</strong> is kicking off this weekend with a <strong>£200 cash prize</strong> up for grabs!
            </p>

            <!-- Player Count -->
            <div style="background: #f1f5f9; border-left: 4px solid #16a34a; padding: 16px 20px; margin: 0 0 24px 0;">
              <p style="margin: 0; color: #0f172a; font-size: 16px;">
                <strong>Over 20 players have joined</strong> - and only one will walk away with the full prize pot.
              </p>
            </div>

            <!-- Lock Time -->
            <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 16px 20px; margin: 0 0 24px 0;">
              <p style="margin: 0; color: #0f172a; font-size: 16px;">
                <strong>Round 1 Lock Time:</strong> Saturday 31st Jan at 3pm
              </p>
            </div>

            <!-- Fixtures Section -->
            <div style="margin: 0 0 30px 0;">
              <h3 style="color: #0f172a; margin: 0 0 16px 0; font-size: 18px; font-weight: 600;">Round 1 Fixtures</h3>
              <div style="border: 1px solid #e2e8f0; border-radius: 6px; overflow: hidden;">
                <div style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0;">Brighton vs Everton</div>
                <div style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0;">Leeds vs Arsenal</div>
                <div style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0;">Wolves vs Bournemouth</div>
                <div style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0;">Chelsea vs West Ham</div>
                <div style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0;">Liverpool vs Newcastle</div>
                <div style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0;">Aston Villa vs Brentford</div>
                <div style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0;">Man Utd vs Fulham</div>
                <div style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0;">Nottm Forest vs Crystal Palace</div>
                <div style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0;">Tottenham vs Man City</div>
                <div style="padding: 12px 16px;">Sunderland vs Burnley</div>
              </div>
            </div>

            <!-- How It Works -->
            <div style="margin: 0 0 24px 0;">
              <h3 style="color: #0f172a; margin: 0 0 12px 0; font-size: 16px; font-weight: 600;">How it works</h3>
              <p style="color: #334155; font-size: 15px; margin: 0; line-height: 1.6;">
                Pick one team each round. If your team wins, you advance. If they lose or draw, you're out. You can only use each team once throughout the competition.
              </p>
            </div>

            <!-- Important Notice -->
            <div style="background: #fef2f2; border-left: 4px solid #dc2626; padding: 16px 20px; margin: 0 0 30px 0;">
              <p style="margin: 0; color: #0f172a; font-size: 15px; line-height: 1.6;">
                <strong>Important:</strong> A draw counts as elimination - there's no splitting the prize. If no single player remains at the end of the competition, no one wins. The last man standing takes the full £200!
              </p>
            </div>

            <!-- Call to Action Button -->
            <div style="margin: 40px 0; text-align: center;">
              <a href="https://lmslocal.co.uk"
                 style="display: inline-block; background-color: #16a34a; color: #ffffff; padding: 16px 32px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;">
                Make Your Pick
              </a>
            </div>

            <!-- Reminder -->
            <p style="color: #334155; font-size: 15px; margin: 0 0 24px 0; line-height: 1.5;">
              Make sure you get your Round 1 pick in before the 3pm lock time on Saturday.
            </p>

            <!-- Sign Off -->
            <p style="color: #334155; font-size: 15px; margin: 0; line-height: 1.5;">
              Good luck to all!
            </p>

          </div>

          <!-- Footer -->
          <div style="background-color: #f8fafc; padding: 20px 30px; border-top: 1px solid #e2e8f0; text-align: center;">
            <p style="color: #64748b; font-size: 13px; margin: 0 0 8px 0; font-style: italic;">
              Entry is 18+ only.
            </p>
            <p style="color: #94a3b8; font-size: 12px; margin: 0;">
              LMS Local - Last Man Standing Competitions
            </p>
          </div>

        </div>
      </body>
    </html>
  `;

  const textContent = `
Last Man Standing - £200 Prize Competition
===========================================

Hi everyone,

We're excited to announce that our FREE Last Man Standing competition is kicking off this weekend with a £200 cash prize up for grabs!

Over 20 players have joined - and only one will walk away with the full prize pot.

Round 1 Lock Time: Saturday 31st Jan at 3pm

Round 1 Fixtures:
- Brighton vs Everton
- Leeds vs Arsenal
- Wolves vs Bournemouth
- Chelsea vs West Ham
- Liverpool vs Newcastle
- Aston Villa vs Brentford
- Man Utd vs Fulham
- Nottm Forest vs Crystal Palace
- Tottenham vs Man City
- Sunderland vs Burnley

How it works: Pick one team each round. If your team wins, you advance. If they lose or draw, you're out. You can only use each team once throughout the competition.

Important: A draw counts as elimination - there's no splitting the prize. If no single player remains at the end of the competition, no one wins. The last man standing takes the full £200!

Make your pick here: https://lmslocal.co.uk

Make sure you get your Round 1 pick in before the 3pm lock time on Saturday.

Good luck to all!

---
Entry is 18+ only.
LMS Local - Last Man Standing Competitions
  `;

  return { htmlContent, textContent };
};

const sendCompetitionAnnouncement = async () => {
  // Load players
  let players = loadPlayersFromCSV();
  console.log(`\nLoaded ${players.length} real player emails (excluded bots and test emails)\n`);

  // Apply limit if specified
  if (limit && limit > 0) {
    players = players.slice(0, limit);
    console.log(`Limited to first ${limit} players\n`);
  }

  if (isDryRun) {
    console.log('=== DRY RUN MODE - No emails will be sent ===\n');
    console.log('Would send to:');
    players.forEach((email, i) => console.log(`  ${i + 1}. ${email}`));
    console.log(`\nTotal: ${players.length} emails`);
    console.log(`Estimated time: ${Math.ceil(players.length * DELAY_MS / 1000)} seconds`);
    return;
  }

  const { htmlContent, textContent } = getEmailContent();

  console.log(`Sending to ${players.length} players...`);
  console.log(`Rate limit: ${DELAY_MS}ms between emails (2/sec)\n`);

  let sent = 0;
  let failed = 0;
  const failedEmails = [];

  for (let i = 0; i < players.length; i++) {
    const email = players[i];

    try {
      const result = await resend.emails.send({
        from: `${process.env.EMAIL_NAME} <${process.env.EMAIL_FROM}>`,
        to: [email],
        subject: 'Last Man Standing - £200 Prize Competition Starts Saturday 31st January!',
        html: htmlContent,
        text: textContent,
      });

      sent++;
      console.log(`✓ [${i + 1}/${players.length}] ${email}`);
    } catch (error) {
      failed++;
      failedEmails.push({ email, error: error.message });
      console.log(`✗ [${i + 1}/${players.length}] ${email} - ${error.message}`);
    }

    // Rate limiting - wait before next email (except for last one)
    if (i < players.length - 1) {
      await sleep(DELAY_MS);
    }
  }

  console.log('\n=== SUMMARY ===');
  console.log(`Sent: ${sent}`);
  console.log(`Failed: ${failed}`);

  if (failedEmails.length > 0) {
    console.log('\nFailed emails:');
    failedEmails.forEach(f => console.log(`  - ${f.email}: ${f.error}`));
  }
};

// Run the script
sendCompetitionAnnouncement();
