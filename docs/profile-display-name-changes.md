# Profile Display Name Changes - Analysis

**Date:** 2025-11-18
**Status:** ANALYSIS COMPLETE

## Current State

### Backend APIs
1. **update-profile.js** ✅
   - Updates global `app_user.display_name`
   - Working correctly, no changes needed

2. **update-personal-competition-name.js** ❌
   - Currently updates `competition_user.personal_name`
   - **NEEDS UPDATE** to use `competition_user.player_display_name` instead

### Frontend (Profile Page)
**Current features:**
- Edit global display_name ✅
- Change password ✅
- Email preferences (global + per-competition) ✅
- Delete account ✅

**Missing:**
- ❌ No UI to edit player_display_name per competition
- ❌ Line 498 references old `personal_name` field in email prefs

## Required Changes

### Backend: Update API (1 file)

**File:** `lmslocal-server/routes/update-personal-competition-name.js`

Changes needed:
1. Replace all `personal_name` with `player_display_name`
2. Update header documentation
3. Update validation (change max length from 100 to match display_name constraints if needed)

Lines to change:
- Line 11: `personal_name` parameter → `player_display_name`
- Line 18: response field → `player_display_name`
- Line 47: request parameter → `player_display_name`
- Line 59-72: validation for `player_display_name`
- Line 105: INSERT statement → `player_display_name`
- Line 111: nameValue variable (OK - internal)
- Line 121: UPDATE statement → `player_display_name`
- Line 137: response field → `player_display_name`

### Frontend: Update Profile Page

**File:** `lmslocal-web/src/app/profile/page.tsx`

**New Section Needed:** Competition Display Names

**Location:** Between "Profile Information" and "Email Preferences" sections

**UI Design:**
```
┌─────────────────────────────────────────────────┐
│ Competition Display Names                       │
├─────────────────────────────────────────────────┤
│ Choose how your name appears in each           │
│ competition. Leave blank to use your profile   │
│ name.                                           │
│                                                 │
│ Competition Name 1                              │
│ [John Competition    ] [Update]                │
│                                                 │
│ Competition Name 2                              │
│ [J Smith            ] [Update]                 │
└─────────────────────────────────────────────────┘
```

**Implementation:**
1. Fetch user's competitions from dashboard API
2. For each competition, show input field with current `player_display_name`
3. Allow editing and saving per competition
4. Call updated `update-personal-competition-name` API (renamed to `update-player-display-name`)

**Also fix:**
- Line 498: Change `comp.personal_name` to `comp.player_display_name`

## API Changes Needed in lib/api.ts

Add new function or update existing:
```typescript
updatePlayerDisplayName(competition_id: number, player_display_name: string)
```

## Testing Checklist

### Backend API
- [ ] Update player_display_name via API
- [ ] Set to NULL (clear name, falls back to global)
- [ ] Validate max length
- [ ] Non-participant can't update
- [ ] Organizer can update their own name

### Frontend
- [ ] List all user's competitions
- [ ] Show current player_display_name
- [ ] Show placeholder if NULL
- [ ] Update name per competition
- [ ] Clear name (set to NULL)
- [ ] Success/error messages
- [ ] Form validation

## Proposed File Structure

```
Backend Changes:
lmslocal-server/routes/update-personal-competition-name.js
→ Replace personal_name with player_display_name (8 occurrences)

Frontend Changes:
lmslocal-web/src/app/profile/page.tsx
→ Add Competition Display Names section
→ Fix line 498 (personal_name → player_display_name)

lmslocal-web/src/lib/api.ts
→ Add/update updatePlayerDisplayName function
```

## Questions to Answer

1. Should we rename the API file from `update-personal-competition-name.js` to `update-player-display-name.js`?
   - **Recommendation:** Keep filename for backward compatibility, just update field names

2. Should player_display_name be required or optional?
   - **Recommendation:** Optional (NULL = use global display_name)

3. Should we validate that player_display_name is unique per competition?
   - **Recommendation:** No - allow duplicates (multiple "John" in same competition is fine)

4. Where to show competition display names UI?
   - **Recommendation:** Profile page, new section between Profile Info and Email Preferences
