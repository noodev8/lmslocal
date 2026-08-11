# Email Operations

How to actually send email. For what we send and why, see `README.md` and `email-outline.xlsx`.

## Test mode

Every email leaves through one function, `deliver()` in `services/emailService.js`:

```js
deliver(emailData, { testMode: true })   // -> test address, subject prefixed [TEST]
deliver(emailData, { testMode: false })  // -> the real recipient
```

Test mode redirects to `EMAIL_TEST_RECIPIENT` (default `aandreou25@gmail.com`) and prefixes the
subject, so a redirected copy is distinguishable from a genuine one in the same inbox.

`deliver` defaults to **live**, because the transactional senders must always reach the user — a
redirected password reset is a broken product. Safety comes from the callers instead: the admin
screen sends the flag explicitly on every request, and `/admin/send-emails` treats an absent
`test_mode` as true.

**Historical note worth knowing.** Until 2026-08-11 this was a hardcoded
`emailData.to = ['aandreou25@gmail.com']` inside a wrapper commented `ALL EMAILS REDIRECTED`.
That wrapper was called by only five of the twelve senders; pick reminder, results, welcome,
verification, password reset, magic link and payment confirmation called Resend directly and were
never redirected. Anyone reading that line concluded nothing could reach a real inbox, and three
live player emails always could.

## Environment

`lmslocal-server/.env`:

```
RESEND_API_KEY=re_xxxx
EMAIL_FROM=noreply@email.noodev8.com
EMAIL_NAME=Last Man Standing
PLAYER_FRONTEND_URL=https://lmslocal.vercel.app
```

## Sending via the queue

Two steps, both manual — nothing drains the queue on a schedule.

1. **Queue** — `POST /load-pick-reminder` with `{}`. Finds eligible players and writes to
   `email_queue`. It applies the eligibility checks itself (active, not eliminated, hasn't picked,
   round not locked, preferences respected, not already queued).
2. **Send** — `POST /send-email` with `{}`. Drains pending rows, dispatching on `email_type`.

Check what's waiting:

```sql
SELECT email_type, status, count(*) FROM email_queue GROUP BY 1,2;
```

The other `load-*` routes (`load-results-email`, `load-welcome-competition`,
`load-competition-announcement`) follow the same pattern.

## Sending a one-off script

For announcements or anything the queue doesn't cover. Bypasses `email_queue`, `email_preference`,
and `email_tracking` — so it also bypasses unsubscribes. Check preferences yourself in the SQL if
the audience isn't already opted in.

`lmslocal-server/send-reminder.js` is the working example (Round 2 pick reminder, Feb 2026).

```bash
cd lmslocal-server
node send-reminder.js          # dry run — previews to the test address, lists recipients
node send-reminder.js --send   # live
```

Template:

```js
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);
const DRY_RUN = !process.argv.includes('--send');

async function main() {
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
      // Resend RESOLVES on failure rather than throwing — check result.error, and the id
      // lives at result.data.id, not result.id.
      if (result?.error) throw new Error(result.error.message);
      console.log(`Sent: ${email} (${result?.data?.id})`);
      await new Promise(r => setTimeout(r, 500)); // rate limit
    } catch (err) {
      console.error(`FAIL: ${email} - ${err.message}`);
    }
  }
}

main().catch(console.error);
```

Always dry run first.

## The shared footer

`buildEmailFooter(unsubscribeUrl)` in `emailService.js` returns `{ html, text }` for the block
every email ends with:

```
LMS Local - Last Man Standing Competitions
Unsubscribe                                 <- blue, omitted when no URL is passed
Noodev8 Ltd, company number 16222537
3 Cumberland Place, Welshpool, SY21 7SB
```

Shared rather than pasted into each template because it carries the legal identification — UK
PECR wants marketing mail to identify the sender and give a valid address. Fourteen copies would
mean fourteen places to miss when a detail changes, and the one that got missed would be the one
still sending.

Pass `null` for transactional mail: a password reset is not unsubscribable, so it gets the
company block without the link.

The company details are duplicated in `lmslocal-web/src/components/public/PublicFooter.tsx` with
nothing keeping the two in step. Change both.

## Who a reply reaches

`EMAIL_FROM` must be on the Resend-verified domain (`email.noodev8.com`), so it is a noreply
address. `EMAIL_REPLY_TO` needs no verification and is where replies actually land
(`lmslocal8@gmail.com`).

`deliver()` fills in `reply_to` on every send, but **only when the caller has not set one** — the
contact form deliberately replies to whoever wrote in. Without this, a player answering "I can't
see my fixtures" reaches nobody, often without even a bounce.

## Recipient SQL

Active players who haven't picked in a round that's still open:

```sql
SELECT DISTINCT u.email
FROM competition c
INNER JOIN round r ON r.competition_id = c.id
    AND r.lock_time IS NOT NULL AND r.lock_time > NOW()
INNER JOIN competition_user cu ON cu.competition_id = c.id AND cu.status = 'active'
INNER JOIN app_user u ON u.id = cu.user_id
    AND u.email IS NOT NULL AND u.email != ''
    AND u.email NOT LIKE '%@lms-guest.com'
LEFT JOIN pick p ON p.user_id = u.id AND p.round_id = r.id
WHERE c.id IN (142, 144)   -- change competition IDs
    AND p.id IS NULL
ORDER BY u.email;
```

Export as CSV with header `email`, save as `reminder.csv` in the project root.

Run it with `node db/query.js "..."` from `lmslocal-server/` — see `lmslocal-server/db/README.md`.
This is the live production database.

Schema notes that bite:

- Users are `app_user`, not `users`
- Membership is `competition_user`; elimination is `status` (`active` / `out`), **not**
  `lives_remaining`
- Current round is `MAX(round_number)` from `round` — there is no current-round column on
  `competition`
- Picks join on `competition_id`, `round_id`, `user_id`
- Guest accounts use `@lms-guest.com` addresses and must be excluded
- `email_preference` is singular, keyed on `(user_id, competition_id, email_type)`;
  `competition_id IS NULL` means global. `email_type = 'all'` is the global opt-out.

## Template styling

All templates are inline HTML in `emailService.js`. Shared structure:

- **Header**: `background-color: #1e293b`, white text, centered
- **Body**: `padding: 40px 30px`
- **Info boxes**: `background: #f1f5f9; border-left: 4px solid #475569`
- **CTA button**: `background-color: #475569`, white text, `border-radius: 6px`
- **Footer**: `background-color: #f8fafc`, light grey text
- **Font stack**: `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif`

Note this is the older slate palette, not the "pools coupon" design system the signed-out web
pages use (`docs/design-system.md`). Whether emails migrate is an open question.

## Key files

| File | Purpose |
|---|---|
| `services/emailService.js` | All senders and templates. `deliver()` is the single exit point; `buildEmailFooter()` the shared footer. |
| `services/emailPreference.js` | Groups, opt-out SQL, unsubscribe tokens |
| `services/pickReminder.js` | Who gets a pick reminder, and its template data |
| `routes/send-email.js` | Drains `email_queue`, dispatches by `email_type` |
| `routes/load-pick-reminder.js` | Queues pick reminders |
| `routes/load-results-email.js` | Queues results emails |
| `routes/load-welcome-competition.js` | Queues competition welcome |
| `routes/load-competition-announcement.js` | Queues organiser announcements |
| `routes/get-email-preferences.js` | Reads `email_preference` |
| `routes/update-email-preferences-batch.js` | Writes `email_preference` |
| `routes/process-mobile-notifications.js` | Drains `mobile_notification_queue` (push) |
| `services/fcmService.js` | Firebase push delivery |
| `send-reminder.js` | One-off script example |
