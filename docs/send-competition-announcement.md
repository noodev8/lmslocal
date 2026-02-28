# Competition Announcement Email System

## Purpose

Email all registered users about a new competition they can join. No cron automation - run manually via API calls when ready.

---

## Code Files

| File | Purpose |
|------|---------|
| `lmslocal-server/routes/load-competition-announcement.js` | Queue/preview announcement emails (POST) |
| `lmslocal-server/routes/unsubscribe.js` | One-click unsubscribe from email link (GET) |
| `lmslocal-server/services/emailService.js` | `sendCompetitionAnnouncementEmail()` function |
| `lmslocal-server/routes/send-email.js` | Processes queue and dispatches (handles `competition_announcement` type) |
| `lmslocal-server/routes/update-email-preferences-batch.js` | `competition_announcement` in `validEmailTypes` array |
| `lmslocal-server/server.js` | Route registration for `/load-competition-announcement` and `/unsubscribe` |

---

## Three-Step Process

**STEP 1: Preview recipients (dry run)** -> `POST /load-competition-announcement`
**STEP 2: Queue the emails** -> `POST /load-competition-announcement`
**STEP 3: Send the emails** -> `POST /send-email`

---

## STEP 1: Preview Recipients (Dry Run)

Returns JSON list of users who would receive the email. Review before queuing.

```json
POST /load-competition-announcement
{
  "competition_id": 123,
  "dry_run": true
}
```

**Response includes:** `recipient_count`, `recipients` array with `user_id`, `email`, `display_name`.

**Who is included:** All `app_user` rows with a valid email (not null, not empty, not `@lms-guest.com`) who are NOT already in the competition and have NOT opted out of `all` or `competition_announcement` emails.

---

## STEP 2: Queue the Emails

Same endpoint without `dry_run`. Inserts into `email_queue` and `email_tracking`.

```json
POST /load-competition-announcement
{
  "competition_id": 123
}
```

**Response includes:** `queued_count`, `failed_count`, `competition_name`.

**Check database:** `SELECT * FROM email_queue WHERE email_type='competition_announcement' AND status='pending'`

---

## STEP 3: Send the Emails

Processes all pending emails from the queue and sends via Resend.

```json
POST /send-email
{}
```

**Note:** The test override on line 19 of `emailService.js` redirects ALL emails to the test address during testing. Comment it out for production sends.

**Check database:**
- `SELECT * FROM email_queue WHERE email_type='competition_announcement' AND status='sent'`
- `SELECT * FROM email_tracking WHERE email_type='competition_announcement'`

---

## Unsubscribe Flow

Each email contains an unsubscribe link at the bottom:
`GET /unsubscribe?token=<jwt>`

1. User clicks unsubscribe link in email
2. JWT is decoded (signed with `JWT_SECRET`, no expiry)
3. Preference saved: `email_preference` row with `user_id`, `competition_id=0`, `email_type='competition_announcement'`, `enabled=false`
4. HTML confirmation page shown to user
5. Next time you run the announcement, that user is excluded from recipients

---

## Verification Checklist

1. Find/create a test competition and note its `competition_id`
2. Run dry run to see the recipient list
3. Queue with dry run off (emails go to test address due to emailService override)
4. Run `POST /send-email`
5. Check the email arrives with correct content, access code, join link, and unsubscribe link
6. Click unsubscribe link, verify HTML confirmation page appears
7. Run dry run again, verify the unsubscribed user is now excluded

---

## Useful SQL Queries

### Find competition ID by name
```sql
SELECT id, name, slug, access_code, status FROM competition WHERE name ILIKE '%keyword%';
```

### Check queued announcements
```sql
SELECT eq.id, eq.user_id, u.email, u.display_name, eq.status, eq.created_at
FROM email_queue eq
JOIN app_user u ON u.id = eq.user_id
WHERE eq.email_type = 'competition_announcement'
ORDER BY eq.created_at DESC;
```

### Check who has unsubscribed from announcements
```sql
SELECT ep.user_id, u.email, u.display_name, ep.enabled, ep.updated_at
FROM email_preference ep
JOIN app_user u ON u.id = ep.user_id
WHERE ep.email_type = 'competition_announcement'
  AND ep.competition_id = 0;
```

### Count eligible recipients for a competition (without using the API)
```sql
SELECT COUNT(*)
FROM app_user u
WHERE u.email IS NOT NULL
  AND u.email != ''
  AND u.email NOT LIKE '%@lms-guest.com'
  AND NOT EXISTS (SELECT 1 FROM competition_user cu WHERE cu.user_id = u.id AND cu.competition_id = 123)
  AND NOT EXISTS (SELECT 1 FROM email_preference ep WHERE ep.user_id = u.id AND ep.competition_id = 0 AND ep.email_type = 'all' AND ep.enabled = false)
  AND NOT EXISTS (SELECT 1 FROM email_preference ep WHERE ep.user_id = u.id AND ep.competition_id = 0 AND ep.email_type = 'competition_announcement' AND ep.enabled = false);
```
