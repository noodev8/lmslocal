# Personal Name Display Analysis

**Date:** 2025-11-18
**Status:** ANALYSIS COMPLETE - NO CHANGES YET

## Summary

We need to change all competition-related APIs to display `competition_user.personal_name` instead of `app_user.display_name`.

## Current Pattern (WRONG)

```sql
SELECT
  u.id,
  u.display_name,  -- ❌ Using global name
  cu.status,
  cu.lives_remaining
FROM competition_user cu
INNER JOIN app_user u ON cu.user_id = u.id
```

## New Pattern (CORRECT)

```sql
SELECT
  u.id,
  COALESCE(cu.personal_name, u.display_name) as display_name,  -- ✅ Use personal name with fallback
  cu.status,
  cu.lives_remaining
FROM competition_user cu
INNER JOIN app_user u ON cu.user_id = u.id
```

**Why COALESCE?**
- Provides fallback to global display_name if personal_name is NULL
- Backward compatibility if backfill script wasn't run
- Safety measure for edge cases

## Files That Need Updates

### CRITICAL - Player Display in Competitions

#### 1. **get-standings-group.js**
**Line 294:** `au.display_name`
**Line 343:** `ORDER BY au.display_name ASC`
**Change to:**
```sql
COALESCE(cu.personal_name, au.display_name) as display_name
ORDER BY COALESCE(cu.personal_name, au.display_name) ASC
```

#### 2. **get-competition-players.js**
**Lines 176, 227:** `u.display_name`
**Lines 147, 218:** Search filter `LOWER(u.display_name) LIKE LOWER($2)`
**Lines 219, 270:** `ORDER BY u.display_name ASC`
**Change to:**
```sql
COALESCE(cu.personal_name, u.display_name) as display_name
AND (LOWER(COALESCE(cu.personal_name, u.display_name)) LIKE LOWER($2) OR LOWER(u.email) LIKE LOWER($2))
ORDER BY COALESCE(cu.personal_name, u.display_name) ASC
```

#### 3. **get-promote-data.js** (Leaflet generation)
Need to check - likely displays player names on promotional materials

#### 4. **get-player-history.js**
Need to check - shows player's pick history

#### 5. **search-players.js**
Need to check - searches for players in competition

#### 6. **get-unpicked-players.js**
Need to check - shows players who haven't picked yet

#### 7. **get-round-statistics.js** (if exists)
Need to check - may show who picked what teams

### MEDIUM PRIORITY - Admin/Management Functions

#### 8. **organizer-update-player-permissions.js**
May display player names when updating permissions

#### 9. **update-player-status.js**
May display player names in response

#### 10. **update-player-lives.js**
May display player names in response

#### 11. **remove-player.js**
May return player data in response

#### 12. **update-payment-status.js**
May display player names when updating payment

### LOW PRIORITY - Email/Notifications

#### 13. **load-pick-reminder.js**
Email templates - should use personal_name

#### 14. **load-results-email.js**
Email templates - should use personal_name

#### 15. **load-welcome-competition.js**
Email templates - should use personal_name

### NON-COMPETITION CONTEXT (DO NOT CHANGE)

These should still use `app_user.display_name`:
- **login.js** - User authentication
- **register.js** - User registration
- **update-profile.js** - Profile management
- **forgot-password.js** - Password reset
- **reset-password.js** - Password reset
- **change-password.js** - Password change
- **verify-email.js** - Email verification
- **delete-account.js** - Account deletion

## Testing Strategy

For each updated file, test:

1. **Display Test**
   - Create user with display_name "John Global"
   - Join competition (should set personal_name = "John Global")
   - Change personal_name to "John Competition" (via update-personal-competition-name.js)
   - Verify API returns "John Competition" not "John Global"

2. **Search Test**
   - Search for "Competition" should find "John Competition"
   - Search for "Global" should NOT find the player (only searching personal_name)

3. **Ordering Test**
   - Players should be ordered by personal_name alphabetically

4. **Fallback Test**
   - Manually set personal_name to NULL in database
   - Verify API returns display_name as fallback

## API Update Pattern

### Before:
```javascript
const playersQuery = `
  SELECT
    u.id,
    u.display_name,
    cu.status
  FROM competition_user cu
  INNER JOIN app_user u ON cu.user_id = u.id
  WHERE cu.competition_id = $1
  ORDER BY u.display_name ASC
`;
```

### After:
```javascript
const playersQuery = `
  SELECT
    u.id,
    COALESCE(cu.personal_name, u.display_name) as display_name,
    cu.status
  FROM competition_user cu
  INNER JOIN app_user u ON cu.user_id = u.id
  WHERE cu.competition_id = $1
  ORDER BY COALESCE(cu.personal_name, u.display_name) ASC
`;
```

## Rollout Plan

1. ✅ Update join APIs to populate personal_name (DONE)
2. ✅ Run backfill script (DONE)
3. ⏳ Update display APIs (READY TO START)
4. ⏳ Test each API individually
5. ⏳ Deploy to production
6. ⏳ Monitor for issues

## Notes

- **Frontend**: No changes needed if API responses use `display_name` field
- **Performance**: COALESCE adds negligible overhead
- **Backward Compatible**: Falls back to display_name if personal_name is NULL
- **Search**: Must update WHERE clauses to search personal_name instead of display_name
