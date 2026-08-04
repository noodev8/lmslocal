# Personal Name Migration Plan

**Date:** 2025-11-18
**Status:** PLANNING - DO NOT IMPLEMENT YET

## Overview

Implement competition-specific display names using the existing `competition_user.personal_name` column, which is currently unused (all rows NULL).

## Business Requirements

### Current State
- `app_user.display_name` - Global display name set at registration
- `competition_user.personal_name` - Exists but always NULL (unused)
- Display name is the same across all competitions

### Desired State
- `app_user.display_name` - Global display name (unchanged)
- `competition_user.personal_name` - Competition-specific display name
- Users can have different display names in different competitions
- Default behavior: Copy `app_user.display_name` to `competition_user.personal_name` when joining

## Database Schema

### Existing Tables (No Changes Needed)
```sql
-- app_user table
display_name VARCHAR(100) NOT NULL  -- Global name

-- competition_user table
personal_name VARCHAR(100)  -- Competition-specific name (currently all NULL)
```

**Note:** Schema already supports this feature - no migrations needed!

## Implementation Plan

### Phase 1: Update Join Competition Logic ✅

**Files to Modify:**

#### 1. `lmslocal-server/routes/join-competition-by-code.js`
**Line 231-234** - Update INSERT statement:

**Current:**
```javascript
const joinQuery = `
  INSERT INTO competition_user (competition_id, user_id, status, lives_remaining, joined_at)
  VALUES ($1, $2, 'active', $3, NOW())
  RETURNING id, status, lives_remaining, joined_at
`;

const joinResult = await client.query(joinQuery, [
  data.competition_id,
  user_id,
  data.lives_per_player
]);
```

**New:**
```javascript
const joinQuery = `
  INSERT INTO competition_user (
    competition_id, user_id, status, lives_remaining, joined_at, personal_name
  )
  SELECT $1, $2, 'active', $3, NOW(), u.display_name
  FROM app_user u
  WHERE u.id = $2
  RETURNING id, status, lives_remaining, joined_at, personal_name
`;

const joinResult = await client.query(joinQuery, [
  data.competition_id,
  user_id,
  data.lives_per_player
]);
```

#### 2. `lmslocal-server/routes/add-offline-player.js`
**Line 225-234** - Update INSERT statement:

**Current:**
```javascript
await client.query(`
  INSERT INTO competition_user (
    competition_id, user_id, status, lives_remaining, joined_at
  )
  VALUES ($1, $2, 'active', $3, NOW())
`, [competition_id, newPlayer.id, competition.lives_per_player]);
```

**New:**
```javascript
await client.query(`
  INSERT INTO competition_user (
    competition_id, user_id, status, lives_remaining, joined_at, personal_name
  )
  VALUES ($1, $2, 'active', $3, NOW(), $4)
`, [competition_id, newPlayer.id, competition.lives_per_player, newPlayer.display_name]);
```

**Note:** We already have `newPlayer.display_name` from line 204, so we can pass it directly.

### Phase 2: Backfill Existing Data ✅

**SQL Script to backfill NULL personal_name values:**

```sql
-- Backfill all existing competition_user rows with personal_name from app_user.display_name
UPDATE competition_user cu
SET personal_name = u.display_name
FROM app_user u
WHERE cu.user_id = u.id
  AND cu.personal_name IS NULL;

-- Verify backfill
SELECT
  COUNT(*) as total_rows,
  COUNT(personal_name) as rows_with_personal_name,
  COUNT(*) - COUNT(personal_name) as rows_still_null
FROM competition_user;
```

**Expected Result:**
- All existing competition_user rows get their personal_name populated from app_user.display_name
- All future joins automatically populate personal_name

### Phase 3: Update Frontend Display Logic (FUTURE - NOT NOW)

**Files that will need updates later:**
- Any components displaying player names in competition context
- Should prefer `competition_user.personal_name` over `app_user.display_name`
- Dashboard, standings, player lists, etc.

**Note:** This can be done later since personal_name will match display_name initially.

## Other Join Paths to Check

**Potential other files that might add users to competitions:**
- `bot-join.js` - Check if this adds to competition_user
- Any admin bulk import functionality
- Competition creation (if organizer auto-joins)

## Testing Plan

### Test Cases

1. **New user joins via invite code**
   - Verify personal_name = app_user.display_name

2. **Admin adds offline player**
   - Verify personal_name = provided display_name

3. **User already in competition (re-join)**
   - Verify personal_name unchanged (don't overwrite existing value)

4. **Backfill script**
   - Run on test data
   - Verify all NULL rows updated
   - Verify data integrity (names match)

5. **User changes global display_name later**
   - personal_name should remain unchanged (competition-specific)

## Rollback Plan

If issues arise:
```sql
-- Revert all personal_name to NULL
UPDATE competition_user SET personal_name = NULL;
```

Code changes can be reverted via git.

## Questions to Address Before Implementation

1. ❓ **Other join paths** - Are there other routes that add users to competition_user?
2. ❓ **Re-join behavior** - If user already in competition, should we update personal_name or leave it?
3. ❓ **Future UI** - Where will users edit their personal_name per competition?

## Next Steps

1. ✅ Review this plan
2. ⏳ Search for other files that insert into competition_user
3. ⏳ Decide on re-join behavior
4. ⏳ Implement Phase 1 changes
5. ⏳ Test on development
6. ⏳ Run backfill script on production
7. ⏳ Monitor for issues

## Notes

- **No breaking changes** - All existing functionality continues to work
- **Backward compatible** - If personal_name is NULL, can fall back to display_name
- **Data already exists** - No schema migration needed
- **Low risk** - Isolated change to two files + one SQL script
