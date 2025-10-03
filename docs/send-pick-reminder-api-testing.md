# Send Pick Reminder API - Testing Quick Reference

### 1. Preview Mode
Returns candidate list. Does NOT send emails.
{"preview_only": true}


### 2. Single User (With Validation)
Sends only if user passes all 17 checks.
{"user_id": 123, "round_id": 67, "competition_id": 45, "validate": true}


### 3. Single User (Force Send)
Bypasses all checks. Sends regardless.
{"user_id": 123, "round_id": 67, "competition_id": 45, "validate": false}


### 4. Batch Mode (Cron)
Sends to all validated candidates.
{}

