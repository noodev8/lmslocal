# Pick Reminder Email System - Testing Quick Reference

## Active Competitions

| ID  | Competition Name           |
|-----|----------------------------|
| 142 | FREE 200                   |
| 144 | 20 Rnd 3 Rollover          |

---

## Quick Query: Players Who Haven't Picked

Active players (non-guest) who haven't picked in the current open round for comps 142 and 144:

```sql
SELECT DISTINCT
    u.email,
    u.display_name,
    c.id AS competition_id,
    c.name AS competition_name,
    r.round_number
FROM competition c
INNER JOIN round r
    ON r.competition_id = c.id
    AND r.lock_time IS NOT NULL
    AND r.lock_time > NOW()
INNER JOIN competition_user cu
    ON cu.competition_id = c.id
    AND cu.status = 'active'
INNER JOIN app_user u
    ON u.id = cu.user_id
    AND u.email IS NOT NULL
    AND u.email != ''
    AND u.email NOT LIKE '%@lms-guest.com'
LEFT JOIN pick p
    ON p.user_id = u.id
    AND p.round_id = r.id
WHERE c.id IN (142, 144)
    AND p.id IS NULL
ORDER BY c.name, u.display_name;
```

---

## Two-Step Process

**STEP 1: Load (Queue) Emails** → `/load-pick-reminder`
**STEP 2: Send Emails** → `/send-email`

---

## STEP 1: /load-pick-reminder

Validates and queues emails to database (does NOT send).

### 1. Batch Mode (Cron)
Queues all validated candidates.
{}

### 2. Single User (With Validation)
Queues only if user passes all 17 checks.
{"user_id": 123, "round_id": 67, "competition_id": 45, "validate": true}

### 3. Single User (Force Queue)
Bypasses all checks. Queues regardless.
{"user_id": 123, "round_id": 67, "competition_id": 45, "validate": false}

**Check database:** `SELECT * FROM email_queue WHERE status='pending'`

---

## STEP 2: /send-email

Processes pending emails from queue and sends them.

### Process All Pending
Sends all emails with status='pending'.
{}

**Check database:**
- `SELECT * FROM email_queue WHERE status='sent'`
- `SELECT * FROM email_tracking`

