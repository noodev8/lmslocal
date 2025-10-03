# Pick Reminder Email System - Testing Quick Reference

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

