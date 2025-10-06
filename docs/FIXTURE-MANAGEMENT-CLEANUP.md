# Fixture Management Cleanup Plan

## Overview
This document outlines the plan to disable manual fixture management from the frontend, as fixtures and results are now managed via the automated fixture service (fixture_load staging table + push APIs).

---

## Frontend Components to Disable

### 1. **Game Dashboard** (`/lmslocal-web/src/app/game/[id]/page.tsx`)

   **Fixtures Button** (lines 854-867)
   - The entire button component that navigates to fixtures management

   **handleFixturesClick function** (lines 176-214)
   - The click handler that routes to `/fixtures` or `/results` based on round state

   **Action**: Comment out the button and handler function

---

### 2. **Fixtures Management Page** (`/lmslocal-web/src/app/game/[id]/fixtures/page.tsx`)

   **Status**: Entire file needs review

   **Purpose**: Screen where organizers manually create rounds and add fixtures

   **Action**: Need to read this file first to understand what it does, then disable the entire page

---

### 3. **Results Submission Page** (`/lmslocal-web/src/app/game/[id]/results/page.tsx`)

   **Status**: Entire file needs review

   **Purpose**: Screen where organizers manually submit match results

   **Action**: Need to read this file first to understand dependencies, then disable the entire page

---

## Backend APIs Analysis

### APIs to KEEP (Used by Automated Fixture Service & Players)

#### Automated Service APIs:
- ✅ `/admin/push-fixtures-to-competitions.js` - Pushes fixtures from fixture_load to competitions (BOT_MAGIC_2025 auth)
- ✅ `/admin/push-results-to-competitions.js` - Pushes results from fixture_load to competitions (BOT_MAGIC_2025 auth)

#### Player-Facing APIs (Read-Only):
- ✅ `/get-rounds.js` - Players view rounds in competition
- ✅ `/get-fixtures.js` - Players view fixtures for making picks
- ✅ `/get-player-current-round.js` - Players check current round status
- ✅ `/get-round-history.js` - Players view their pick history

---

### APIs to DISABLE (Organizer Manual Management)

These APIs were used for manual fixture/result management by organizers:

- ❌ `/create-round.js` - Manual round creation (replaced by push-fixtures-to-competitions)
- ❌ `/add-fixtures-bulk.js` - Manual bulk fixture upload (replaced by fixture_load staging)
- ❌ `/submit-results.js` - Manual result submission (replaced by push-results-to-competitions)
- ❌ `/update-round.js` - Manual round editing
- ❌ `/reset-fixtures.js` - Manual fixture reset
- ❌ `/set-fixture-result.js` - Manual individual result setting

**Action**: Add "DISABLED" comments to these files, but leave code intact for potential future use
<AA> REM Out code as well to ensure the whole app compiles and passes ESLint without it
---

### APIs to CHECK (Unclear Usage)

Need to verify if these are used by players or only organizers:

- ⚠️ `/get-calculated-fixtures.js` - Need to check if players use this
- ⚠️ `/get-fixture-pick-count.js` - Need to check if used in player views
- ⚠️ `/organiser-mid-round-submit-tip.js` - Check if this is for manual management

**Action**: Review each file to determine if player-facing or organizer-facing

---

## Implementation Strategy

### Phase 1: Frontend Cleanup
1. Comment out Fixtures button on game dashboard
2. Comment out handleFixturesClick function
3. Read fixtures page to understand functionality
4. Read results page to understand functionality
5. Disable both pages (either comment entire file or add "Feature Disabled" message)
<AA> Comment entire file

### Phase 2: Backend Audit
1. Review "APIs to CHECK" list to determine keep/disable
2. Add "DISABLED - Manual fixture management" comments to header of disabled APIs
3. Leave actual code intact (commented or not) for potential future restoration

### Phase 3: Documentation
1. Update CLAUDE.md to reflect that fixture management is backend-only
2. Update any relevant API documentation
3. Keep this document as reference for restoration if needed

---

## Restoration Plan (If Needed in Future)

If we decide to bring back manual fixture management:

1. Remove comments from Fixtures button and handler
2. Re-enable fixtures and results pages
3. Remove "DISABLED" markers from backend APIs
4. Update CLAUDE.md accordingly

---

## Notes

- **Safer Approach**: Disable frontend access only, leave backend APIs commented but intact
- **fixture_load Table**: Continue to use as staging area for fixture service
- **BOT_MAGIC_2025 Auth**: Keep this pattern for cron/automated execution
- **No Breaking Changes**: Players should see no difference - they never had access to these screens anyway

---

## Questions to Address

1. Are there any other pages that link to fixtures management?
2. Should we show a message if someone manually navigates to /fixtures or /results?
3. Do we want to completely remove the route files or just disable them?
<AA> 1 - Im not sure, but start with the ones you have identified. 2 - No message, we will remove these in due course. 3 - remark the whole whole code in the route files. append filename with -delete and remove the route link from the server code.