# Results Email System - Testing Quick Reference

## Two-Step Process

**STEP 1: Load (Queue) Emails** → `/load-results-email`
**STEP 2: Send Emails** → `/send-email`

---

## STEP 1: /load-results-email

Validates and queues results emails to database (does NOT send).

### Option A: Batch Mode (Auto/Cron)
Finds ALL rounds with calculated results but no emails queued yet.
```json
{}
```

**Auto-detects rounds:**
- Results calculated (player_progress entries exist)
- No results emails queued yet for that round
- Competition not complete
- Results calculated within last 7 days

Returns: `queued_count`, `rounds_processed`

### Option B: Single Round Mode (Manual)
Queue results for specific round after reviewing.
```json
{
  "round_id": 45,
  "competition_id": 12
}
```

**Recipients (Option C):**
- Currently active players
- Players eliminated in THIS specific round only
- Excludes players eliminated in previous rounds

**Check database:** `SELECT * FROM email_queue WHERE status='pending' AND email_type='results'`

---

## STEP 2: /send-email

Processes ALL pending emails from queue (both pick_reminder and results types).

### Process All Pending
```json
{}
```

Sends all emails with `status='pending'` regardless of type.

**Check database:**
- `SELECT * FROM email_queue WHERE status='sent' AND email_type='results'`
- `SELECT * FROM email_tracking WHERE email_type='results'`

---

## Validation Checks (load-results-email)

1. Round and competition exist
2. Results have been calculated (player_progress entries exist)
3. User has valid email (not guest)
4. Email preferences allow "results" emails (global + competition)
5. Not already queued/sent for this round
6. User is active OR was eliminated in THIS round (Option C)

---

## Email Content (Simple Format)

- Your pick: Team name
- Result: Win/Loss/Draw/No pick
- Outcome message with colored indicator
- Status: Still in (lives remaining) OR Eliminated
- Button: "View Full Results"

---

## Testing Workflow

1. Calculate results for a round using existing API
2. Call `/load-results-email` with round_id and competition_id
3. Check `email_queue` table for pending results emails
4. Call `/send-email` to send all pending
5. Check `email_tracking` for sent results
6. Verify emails received

---

## Notes

- Results emails sent AFTER admin calculates and reviews results
- Manual trigger only (no cron for results)
- Players who didn't pick still get results email
- Eliminated players from previous rounds do NOT get emails
