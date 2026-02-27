# Email Utility Guide

Quick reference for building one-off email scripts (reminders, announcements, etc).

## Key Files

| File | Purpose |
|------|---------|
| `lmslocal-server/services/emailService.js` | Main email service (has test override - see warning below) |
| `lmslocal-server/.env` | Resend API key and email config |
| `lmslocal-server/send-reminder.js` | Example one-off script (Round 2 pick reminder, Feb 2026) |

## Environment Variables

All in `lmslocal-server/.env`:

```
RESEND_API_KEY=re_xxxx           # Resend API key
EMAIL_FROM=noreply@email.noodev8.com  # Sender address
EMAIL_NAME=Last Man Standing     # Sender display name
PLAYER_FRONTEND_URL=https://lmslocal.vercel.app  # For "Make Your Pick" links
```

## Warning: Test Override in emailService.js

Line 19 of `emailService.js` redirects ALL emails to a test address:

```js
emailData.to = ['aandreou25@gmail.com']; // COMMENT OUT FOR PRODUCTION
```

**For one-off scripts, use Resend directly** to avoid this:

```js
require('dotenv').config();
const { Resend } = require('resend');
const resend = new Resend(process.env.RESEND_API_KEY);
```

## Minimal Script Template

```js
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);
const DRY_RUN = !process.argv.includes('--send');

async function main() {
  // 1. Load recipients (CSV with "email" header)
  const csv = fs.readFileSync(path.join(__dirname, '..', 'reminder.csv'), 'utf-8');
  const emails = csv.split('\n')
    .map(line => line.replace(/"/g, '').trim())
    .filter(line => line && line !== 'email' && line.includes('@'));

  console.log(`${emails.length} recipients. ${DRY_RUN ? 'DRY RUN' : 'SENDING'}\n`);

  for (const email of emails) {
    if (DRY_RUN) { console.log(`[DRY] ${email}`); continue; }

    try {
      const result = await resend.emails.send({
        from: `${process.env.EMAIL_NAME} <${process.env.EMAIL_FROM}>`,
        to: [email],
        subject: 'Your subject here',
        html: '<p>Your HTML here</p>',
        text: 'Your plain text here',
      });
      console.log(`Sent: ${email} (${result?.data?.id || result?.id})`);
      await new Promise(r => setTimeout(r, 500)); // rate limit delay
    } catch (err) {
      console.error(`FAIL: ${email} - ${err.message}`);
    }
  }
}

main().catch(console.error);
```

## Getting the Recipient List

Use SQL to generate a CSV of distinct emails. Common pattern - active players who haven't picked for the current round:

```sql
SELECT DISTINCT au.email
FROM competition_user cu
JOIN app_user au ON au.id = cu.user_id
JOIN round r ON r.competition_id = cu.competition_id
    AND r.round_number = (
        SELECT MAX(r2.round_number)
        FROM round r2
        WHERE r2.competition_id = cu.competition_id
    )
LEFT JOIN pick p ON p.competition_id = cu.competition_id
    AND p.round_id = r.id
    AND p.user_id = cu.user_id
WHERE cu.competition_id IN (142, 144)  -- change competition IDs as needed
    AND cu.status = 'active'
    AND p.id IS NULL
ORDER BY au.email;
```

Export as CSV with header `email`, save as `reminder.csv` in the project root.

**Key schema notes:**
- Users table is `app_user` (not `users`)
- Players in a competition are in `competition_user` (status: `active` / `out`)
- Elimination is tracked by `status`, not `lives_remaining`
- Current round = `MAX(round_number)` from `round` table (no current-round field on `competition`)
- Picks are in the `pick` table, joined on `competition_id`, `round_id`, and `user_id`

## Email Styling

All existing emails use the same template structure. Key styles:

- **Header**: `background-color: #1e293b`, white text, centered
- **Body**: `padding: 40px 30px`
- **Info boxes**: `background: #f1f5f9; border-left: 4px solid #475569`
- **CTA button**: `background-color: #475569`, white text, `border-radius: 6px`
- **Footer**: `background-color: #f8fafc`, light grey text
- **Font stack**: `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif`

## Running

```bash
cd lmslocal-server
node send-reminder.js          # dry run - sends one preview to aandreou25@gmail.com, lists all recipients
node send-reminder.js --send   # live - actually sends to all recipients
```

Always dry run first to check the email looks right in your inbox.
