# Player Display Name Implementation - Summary

**Date:** 2025-11-18
**Status:** CODE COMPLETE - READY FOR TESTING

## What Changed

Replaced `personal_name` with new field `player_display_name` in `competition_user` table to allow users to have different display names per competition.

## Database Migration

**File:** `/docs/add-player-display-name-migration.sql`

**Steps:**
1. Add column: `ALTER TABLE competition_user ADD COLUMN player_display_name VARCHAR(100);`
2. Backfill: `UPDATE competition_user cu SET player_display_name = u.display_name FROM app_user u WHERE cu.user_id = u.id`
3. Verify: All rows should have player_display_name populated

## Code Changes

### Join APIs (Populate player_display_name on join)

1. ✅ **join-competition-by-code.js** - Lines 232, 236
2. ✅ **add-offline-player.js** - Lines 232, 235
3. ✅ **create-competition.js** - Lines 280, 282
4. ✅ **bot-join.js** - Lines 235, 237

### Display APIs (Show player_display_name instead of app_user.display_name)

5. ✅ **get-standings-group.js** - Lines 294, 343
6. ✅ **get-competition-players.js** - Lines 176, 218, 227, 269 (both queries + WHERE + ORDER BY)
7. ✅ **search-players.js** - Lines 173, 227, 228
8. ✅ **get-unpicked-players.js** - Lines 155, 162
9. ✅ **get-promote-data.js** - Line 366
10. ✅ **get-player-history.js** - Line 144

## Testing Checklist

### 1. Database Migration
- [ ] Run migration SQL script
- [ ] Verify all rows have player_display_name populated
- [ ] Check that no rows have NULL

### 2. Join Functionality
- [ ] User joins via invite code → player_display_name populated
- [ ] Admin adds offline player → player_display_name populated
- [ ] Organizer joins as player → player_display_name populated
- [ ] Bot joins → player_display_name populated

### 3. Display Functionality
- [ ] Standings page shows player_display_name
- [ ] Player list (admin) shows player_display_name
- [ ] Search players returns player_display_name
- [ ] Unpicked players list shows player_display_name
- [ ] Leaflet/promote data shows player_display_name
- [ ] Player history shows player_display_name

### 4. Edge Cases
- [ ] NULL player_display_name shows as NULL (error visible)
- [ ] Search by player_display_name works
- [ ] Sort by player_display_name works alphabetically

## Rollback Plan

If issues arise:

### Revert Code
```bash
git revert <commit-hash>
```

### Revert Database (if needed)
```sql
-- Remove column
ALTER TABLE competition_user DROP COLUMN player_display_name;
```

## Next Steps (Future)

1. Create UI for users to update their player_display_name per competition
2. Consider adding update-personal-competition-name.js enhancements
3. Add validation for player_display_name length/content

## Files Modified

**Backend Routes (10 files):**
- join-competition-by-code.js
- add-offline-player.js
- create-competition.js
- bot-join.js
- get-standings-group.js
- get-competition-players.js
- search-players.js
- get-unpicked-players.js
- get-promote-data.js
- get-player-history.js

**Documentation (3 files):**
- add-player-display-name-migration.sql
- player-display-name-implementation-summary.md
- personal-name-display-analysis.md (outdated - kept for reference)

## Important Notes

- **No COALESCE** - NULLs are visible for easier debugging
- **personal_name field** - Still exists, reverted to NULL, can be used for something else
- **No frontend changes** - APIs still return field named `display_name`
- **Backward compatible** - Old data works after backfill script
