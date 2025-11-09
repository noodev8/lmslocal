# API Logging Status

Last updated: 2025-11-09

This document tracks which API routes implement the API logging utility for performance monitoring.

## Summary
- Total APIs: 69
- With Logging: 46
- Without Logging: 23

## APIs WITH Logging (46 routes) ✅

| API Route | File Name | Notes |
|-----------|-----------|-------|
| /admin-add-fixtures | admin-add-fixtures.js | |
| /admin-get-fixtures-for-results | admin-get-fixtures-for-results.js | |
| /admin-set-result | admin-set-result.js | |
| /admin/push-fixtures-to-competitions | admin/push-fixtures-to-competitions.js | |
| /admin/push-results-to-competitions | admin/push-results-to-competitions.js | |
| /check-user-type | check-user-type.js | Added 2025-11-09 |
| /delete-competition | delete-competition.js | |
| /get-allowed-teams | get-allowed-teams.js | |
| /get-competition-players | get-competition-players.js | Added 2025-11-09 |
| /get-current-pick | get-current-pick.js | |
| /get-email-preferences | get-email-preferences.js | |
| /get-fixture-pick-count | get-fixture-pick-count.js | |
| /get-fixtures | get-fixtures.js | |
| /get-pick-statistics | get-pick-statistics.js | Added 2025-11-09 |
| /get-player-history | get-player-history.js | Added 2025-11-09 |
| /get-promote-data | get-promote-data.js | Added 2025-11-09 |
| /get-round-history | get-round-history.js | Added 2025-11-09 |
| /get-round-results-breakdown | get-round-results-breakdown.js | Added 2025-11-09 |
| /get-round-statistics | get-round-statistics.js | Added 2025-11-09 |
| /get-rounds | get-rounds.js | |
| /get-standings-group | get-standings-group.js | |
| /get-standings-summary | get-standings-summary.js | |
| /get-teams | get-teams.js | |
| /get-unpicked-players | get-unpicked-players.js | |
| /get-user-dashboard | get-user-dashboard.js | |
| /hide-competition | hide-competition.js | |
| /load-pick-reminder | load-pick-reminder.js | |
| /load-results-email | load-results-email.js | |
| /load-welcome-competition | load-welcome-competition.js | |
| /organizer-add-fixtures | organizer-add-fixtures.js | |
| /organizer-get-fixtures-for-results | organizer-get-fixtures-for-results.js | |
| /organizer-process-results | organizer-process-results.js | |
| /organizer-set-result | organizer-set-result.js | |
| /organizer-update-player-permissions | organizer-update-player-permissions.js | |
| /reset-competition | reset-competition.js | |
| /search-players | search-players.js | |
| /send-email | send-email.js | |
| /set-pick | set-pick.js | |
| /stripe-webhook | stripe-webhook.js | |
| /unhide-player | unhide-player.js | |
| /unselect-pick | unselect-pick.js | |
| /update-competition | update-competition.js | |
| /update-email-preferences-batch | update-email-preferences-batch.js | |
| /update-personal-competition-name | update-personal-competition-name.js | |
| /update-player-lives | update-player-lives.js | |
| /update-player-status | update-player-status.js | |

---

## APIs WITHOUT Logging (23 routes) ❌

| API Route | File Name | Category | Priority |
|-----------|-----------|----------|----------|
| /get-player-current-round | get-player-current-round.js | Game Data | Check if used |
| /team-lists | team-lists.js | Setup | Low |
| /add-offline-player | add-offline-player.js | Player Management | Medium |
| /admin-set-pick | admin-set-pick.js | Admin Operations | Low |
| /bot-join | bot-join.js | Bot Operations | Low |
| /bot-pick | bot-pick.js | Bot Operations | Low |
| /change-password | change-password.js | Auth/User Management | Low |
| /create-checkout-session | create-checkout-session.js | Billing | Low |
| /create-competition | create-competition.js | Competition Setup | Medium |
| /deduct-credit | deduct-credit.js | Billing | Low |
| /delete-account | delete-account.js | User Management | Low |
| /forgot-password | forgot-password.js | Auth/User Management | Low |
| /get-billing-history | get-billing-history.js | Billing | Low |
| /get-user-credits | get-user-credits.js | Billing | Low |
| /join-competition-by-code | join-competition-by-code.js | Competition Setup | Medium |
| /login | login.js | Auth | Low |
| /register | register.js | Auth | Low |
| /remove-player | remove-player.js | Player Management | Low |
| /resend-verification | resend-verification.js | Auth/User Management | Low |
| /reset-password | reset-password.js | Auth/User Management | Low |
| /submit-onboarding-application | submit-onboarding-application.js | Onboarding | Low |
| /update-profile | update-profile.js | User Management | Low |
| /validate-promo-code | validate-promo-code.js | Billing | Low |
| /verify-email | verify-email.js | Auth (GET route - HTML) | Low |

## Implementation Pattern

Routes with logging typically include:
```javascript
const { logApiCall } = require('../utils/apiLogger');

router.post('/', verifyToken, async (req, res) => {
  logApiCall('route-name');
  // ... route handler code
});
```

## Notes

- All high-frequency competition APIs now have logging coverage
- Remaining routes without logging are primarily one-time operations (setup, join) or admin/auth functions
- The `verify-email.js` route uses GET method and returns HTML responses
- Stripe webhook has logging implemented
- Admin fixture/result management routes have logging implemented
