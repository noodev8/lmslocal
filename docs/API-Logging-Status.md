# API Logging Status

Last updated: 2025-11-09

This document tracks which API routes implement the API logging utility for performance monitoring.

## Summary
- Total APIs: 69
- With Logging: 41
- Without Logging: 28

## API Routes

| API Route | File Name | Has Logging | Notes |
|-----------|-----------|-------------|-------|
| /add-offline-player | add-offline-player.js | ❌ No | |
| /admin-add-fixtures | admin-add-fixtures.js | ✅ Yes | |
| /admin-get-fixtures-for-results | admin-get-fixtures-for-results.js | ✅ Yes | |
| /admin-set-pick | admin-set-pick.js | ❌ No | |
| /admin-set-result | admin-set-result.js | ✅ Yes | |
| /admin/push-fixtures-to-competitions | admin/push-fixtures-to-competitions.js | ✅ Yes | |
| /admin/push-results-to-competitions | admin/push-results-to-competitions.js | ✅ Yes | |
| /bot-join | bot-join.js | ❌ No | |
| /bot-pick | bot-pick.js | ❌ No | |
| /change-password | change-password.js | ❌ No | |
| /check-user-type | check-user-type.js | ❌ No | |
| /create-checkout-session | create-checkout-session.js | ❌ No | |
| /create-competition | create-competition.js | ❌ No | |
| /deduct-credit | deduct-credit.js | ❌ No | |
| /delete-account | delete-account.js | ❌ No | |
| /delete-competition | delete-competition.js | ✅ Yes | |
| /forgot-password | forgot-password.js | ❌ No | |
| /get-allowed-teams | get-allowed-teams.js | ✅ Yes | |
| /get-billing-history | get-billing-history.js | ❌ No | |
| /get-competition-players | get-competition-players.js | ✅ Yes | Added 2025-11-09 |
| /get-competition-standings | get-competition-standings.js | ❌ No | |
| /get-current-pick | get-current-pick.js | ✅ Yes | |
| /get-email-preferences | get-email-preferences.js | ✅ Yes | |
| /get-fixture-pick-count | get-fixture-pick-count.js | ✅ Yes | |
| /get-fixtures | get-fixtures.js | ✅ Yes | |
| /get-pick-statistics | get-pick-statistics.js | ❌ No | |
| /get-player-current-round | get-player-current-round.js | ❌ No | |
| /get-player-history | get-player-history.js | ✅ Yes | Added 2025-11-09 |
| /get-promote-data | get-promote-data.js | ❌ No | |
| /get-round-history | get-round-history.js | ❌ No | |
| /get-round-results-breakdown | get-round-results-breakdown.js | ❌ No | |
| /get-round-statistics | get-round-statistics.js | ✅ Yes | Added 2025-11-09 |
| /get-rounds | get-rounds.js | ✅ Yes | |
| /get-standings-group | get-standings-group.js | ✅ Yes | |
| /get-standings-summary | get-standings-summary.js | ✅ Yes | |
| /get-teams | get-teams.js | ✅ Yes | |
| /get-unpicked-players | get-unpicked-players.js | ✅ Yes | |
| /get-user-credits | get-user-credits.js | ❌ No | |
| /get-user-dashboard | get-user-dashboard.js | ✅ Yes | |
| /hide-competition | hide-competition.js | ✅ Yes | |
| /join-competition-by-code | join-competition-by-code.js | ❌ No | |
| /load-pick-reminder | load-pick-reminder.js | ✅ Yes | |
| /load-results-email | load-results-email.js | ✅ Yes | |
| /load-welcome-competition | load-welcome-competition.js | ✅ Yes | |
| /login | login.js | ❌ No | |
| /organizer-add-fixtures | organizer-add-fixtures.js | ✅ Yes | |
| /organizer-get-fixtures-for-results | organizer-get-fixtures-for-results.js | ✅ Yes | |
| /organizer-process-results | organizer-process-results.js | ✅ Yes | |
| /organizer-set-result | organizer-set-result.js | ✅ Yes | |
| /organizer-update-player-permissions | organizer-update-player-permissions.js | ✅ Yes | |
| /register | register.js | ❌ No | |
| /remove-player | remove-player.js | ❌ No | |
| /resend-verification | resend-verification.js | ❌ No | |
| /reset-competition | reset-competition.js | ✅ Yes | |
| /reset-password | reset-password.js | ❌ No | |
| /search-players | search-players.js | ✅ Yes | |
| /send-email | send-email.js | ✅ Yes | |
| /set-pick | set-pick.js | ✅ Yes | |
| /stripe-webhook | stripe-webhook.js | ✅ Yes | |
| /submit-onboarding-application | submit-onboarding-application.js | ❌ No | |
| /team-lists | team-lists.js | ❌ No | |
| /unhide-player | unhide-player.js | ✅ Yes | |
| /unselect-pick | unselect-pick.js | ✅ Yes | |
| /update-competition | update-competition.js | ✅ Yes | |
| /update-email-preferences-batch | update-email-preferences-batch.js | ✅ Yes | |
| /update-personal-competition-name | update-personal-competition-name.js | ✅ Yes | |
| /update-player-lives | update-player-lives.js | ✅ Yes | |
| /update-player-status | update-player-status.js | ✅ Yes | |
| /update-profile | update-profile.js | ❌ No | |
| /validate-promo-code | validate-promo-code.js | ❌ No | |
| /verify-email | verify-email.js | ❌ No | GET route - HTML response |

## Implementation Pattern

Routes with logging typically include:
```javascript
const { logApiCall } = require('../utils/apiLogger');

router.post('/', verifyToken, async (req, res) => {
  logApiCall('route-name');
  // ... route handler code
});
```

## Routes Without Logging (28 APIs)

These routes currently do not implement the API logging utility:

### Authentication & User Management (8)
- change-password.js
- forgot-password.js
- login.js
- register.js
- resend-verification.js
- reset-password.js
- update-profile.js
- verify-email.js (GET route with HTML response)

### Player & Competition Management (8)
- add-offline-player.js
- check-user-type.js
- get-competition-standings.js
- join-competition-by-code.js
- remove-player.js
- submit-onboarding-application.js
- team-lists.js
- validate-promo-code.js

### Game Data & Statistics (5)
- get-pick-statistics.js
- get-player-current-round.js
- get-round-history.js
- get-round-results-breakdown.js
- get-promote-data.js

### Billing & Credits (4)
- create-checkout-session.js
- deduct-credit.js
- get-billing-history.js
- get-user-credits.js

### Admin/Bot Operations (3)
- admin-set-pick.js
- bot-join.js
- bot-pick.js

### Account Management (1)
- delete-account.js

## Recommendations

1. **High Priority** - Add logging to frequently-used routes:
   - login.js (not critical - app-level auth)
   - register.js (not critical - app-level auth)
   - get-player-current-round.js (check if actively used)

2. **Medium Priority** - Add logging to game mechanics routes:
   - get-round-history.js
   - join-competition-by-code.js
   - get-promote-data.js
   - get-round-results-breakdown.js

3. **Low Priority** - Add logging to admin/utility routes:
   - Bot operations (bot-join.js, bot-pick.js)
   - Billing operations (already have payment provider logging)
   - Email-related verification routes

## Notes

- The `verify-email.js` route uses GET method and returns HTML responses, which may require special logging considerations
- Some routes without logging may be legacy or rarely used
- Stripe webhook (`stripe-webhook.js`) has logging implemented
- Admin fixture/result management routes have logging implemented
