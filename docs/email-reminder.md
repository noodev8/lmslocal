# Pick Reminder Emails

## Finding Players Who Haven't Picked

Run this SQL against the database to get a deduplicated list of emails for active players who haven't picked. Players in multiple competitions only appear once — we just point them to the app.

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
WHERE c.id IN (142, 144)   -- change competition IDs as needed
    AND p.id IS NULL
ORDER BY u.email;
```

Export results as CSV with header `email`, save as `reminder.csv` in project root.

## Sending Reminders

### Option A: API System (Two-Step)

1. **Queue**: `POST /load-pick-reminder` with empty body `{}` — finds all eligible players (17 validation checks: active, not eliminated, hasn't picked, round not locked, email prefs respected, not already queued, etc.)
2. **Send**: `POST /send-email` with empty body `{}` — processes the pending queue

Check queue status: `SELECT * FROM email_queue WHERE status='pending'`

### Option B: One-Off Script

```bash
cd lmslocal-server
node send-reminder.js          # dry run - preview email, list recipients
node send-reminder.js --send   # live - sends to all recipients
```

Reads from `reminder.csv` in project root. Sends directly via Resend (bypasses queue/email_queue table).

## Key Files

| File | Purpose |
|------|---------|
| `lmslocal-server/routes/load-pick-reminder.js` | API: queues reminder emails to `email_queue` table |
| `lmslocal-server/routes/send-email.js` | API: sends pending emails from queue |
| `lmslocal-server/send-reminder.js` | One-off script: sends directly from CSV |
| `lmslocal-server/services/emailService.js` | Core email service (Resend) |
| `lmslocal-server/routes/get-unpicked-players.js` | API: returns unpicked player names (no emails) |

## Warning: Test Override

`emailService.js` line 19 redirects ALL emails to `aandreou25@gmail.com`. For production sends, either comment that line out or use Resend directly (as the one-off script does).

## Schema Notes

- Users table: `app_user` (not `users`)
- Players in competition: `competition_user` (status: `active` / `out`)
- Current round: `MAX(round_number)` from `round` table
- Picks: `pick` table joined on `competition_id`, `round_id`, `user_id`
- Email queue: `email_queue` table (status: `pending` / `sent` / `failed`)
- Email prefs: `email_preference` table (users can opt out globally or per-competition)
