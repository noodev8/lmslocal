# Organizer Fixture Management APIs - COMPLETED ✅

## Summary

Successfully created 4 new backend API routes for organizer-managed competitions (where `fixture_service = false`). These APIs allow competition organizers to manage fixtures and results for their individual competitions without affecting other competitions.

---

## Files Created

### Backend API Routes

1. **`lmslocal-server/routes/organizer-add-fixtures.js`**
   - Adds/replaces fixtures for a competition's current round
   - Auto-creates rounds if needed
   - Verifies organizer authorization
   - Prevents changes to automated competitions

2. **`lmslocal-server/routes/organizer-get-fixtures-for-results.js`**
   - Gets all fixtures from current round
   - Returns result status for each fixture
   - Calculates statistics (total, pending, completed)

3. **`lmslocal-server/routes/organizer-set-result.js`**
   - Sets result for a single fixture
   - Converts result type (home_win/away_win/draw) to team codes
   - Does NOT process eliminations (separate step)

4. **`lmslocal-server/routes/organizer-process-results.js`**
   - Processes all unprocessed results for current round
   - Handles player eliminations based on picks
   - Processes no-pick penalties
   - Checks for competition completion
   - Updates player lives and status

### Server Registration

**Modified**: `lmslocal-server/server.js`
- Added route imports (lines 110-114)
- Registered routes (lines 306-310)
- Syntax validated ✅

---

## API Endpoints

### 1. Add Fixtures
**Endpoint**: `POST /organizer-add-fixtures`
**Auth**: JWT required (organizer only)

**Request**:
```json
{
  "competition_id": 123,
  "kickoff_time": "2025-10-25T15:00:00Z",
  "fixtures": [
    {
      "home_team_short": "ARS",
      "away_team_short": "CHE"
    }
  ]
}
```

**Success Response**:
```json
{
  "return_code": "SUCCESS",
  "round_id": 5,
  "round_number": 5,
  "fixtures_added": 10,
  "message": "10 fixtures added to Round 5"
}
```

**Return Codes**:
- `SUCCESS`
- `MISSING_FIELDS`
- `UNAUTHORIZED`
- `COMPETITION_NOT_FOUND`
- `AUTOMATED_COMPETITION`
- `COMPETITION_COMPLETE`
- `SERVER_ERROR`

---

### 2. Get Fixtures for Results
**Endpoint**: `POST /organizer-get-fixtures-for-results`
**Auth**: JWT required (organizer only)

**Request**:
```json
{
  "competition_id": 123
}
```

**Success Response**:
```json
{
  "return_code": "SUCCESS",
  "round_id": 5,
  "round_number": 5,
  "fixtures": [
    {
      "id": 456,
      "home_team_short": "ARS",
      "away_team_short": "CHE",
      "home_team": "Arsenal",
      "away_team": "Chelsea",
      "kickoff_time": "2025-10-25T15:00:00Z",
      "result": null
    }
  ],
  "total_fixtures": 10,
  "fixtures_with_results": 3,
  "fixtures_pending": 7
}
```

**Return Codes**:
- `SUCCESS`
- `MISSING_FIELDS`
- `UNAUTHORIZED`
- `COMPETITION_NOT_FOUND`
- `NO_ROUNDS`
- `SERVER_ERROR`

---

### 3. Set Single Result
**Endpoint**: `POST /organizer-set-result`
**Auth**: JWT required (organizer only)

**Request**:
```json
{
  "fixture_id": 456,
  "result": "home_win"
}
```

**Valid result values**: `"home_win"`, `"away_win"`, `"draw"`

**Success Response**:
```json
{
  "return_code": "SUCCESS",
  "fixture_id": 456,
  "result": "ARS",
  "message": "Result saved"
}
```

**Return Codes**:
- `SUCCESS`
- `MISSING_FIELDS`
- `INVALID_RESULT`
- `UNAUTHORIZED`
- `FIXTURE_NOT_FOUND`
- `SERVER_ERROR`

---

### 4. Process Results
**Endpoint**: `POST /organizer-process-results`
**Auth**: JWT required (organizer only)

**Request**:
```json
{
  "competition_id": 123
}
```

**Success Response**:
```json
{
  "return_code": "SUCCESS",
  "fixtures_processed": 10,
  "players_eliminated": 3,
  "no_pick_penalties": 2,
  "competition_status": "active",
  "active_players_remaining": 5,
  "message": "Round processed successfully"
}
```

**Return Codes**:
- `SUCCESS`
- `MISSING_FIELDS`
- `UNAUTHORIZED`
- `COMPETITION_NOT_FOUND`
- `NO_ROUNDS`
- `NO_RESULTS_TO_PROCESS`
- `SERVER_ERROR`

---

## Security Features

### Authorization Checks
All APIs verify:
1. ✅ User is authenticated (JWT token)
2. ✅ User is the organizer of the competition (`competition.organiser_id = user_id`)
3. ✅ Competition exists
4. ✅ Competition is not automated (`fixture_service = false`)

### Competition Isolation
- ✅ Organizers can ONLY access their own competitions
- ✅ No cross-competition access possible
- ✅ Automated competitions (`fixture_service = true`) are protected

### Data Integrity
- ✅ All operations use database transactions
- ✅ Audit log entries created for all actions
- ✅ No-pick penalties only applied when ALL fixtures are processed
- ✅ Competition completion only checked when round is fully processed

---

## Processing Logic

### Player Elimination (organizer-process-results.js)

**Step 1: Process picks with results**
```
For each fixture with result:
  - Get all picks for that fixture
  - Determine outcome:
    - result = "DRAW" → outcome = "LOSE" (all players eliminated)
    - pick.team = result → outcome = "WIN"
    - pick.team ≠ result → outcome = "LOSE"
  - Update pick.outcome
  - Insert player_progress record
  - If outcome = "LOSE":
    - Deduct 1 life
    - If lives < 0, set status = 'out'
```

**Step 2: Process no-pick penalties**
```
If ALL fixtures in round are processed:
  - Find active players with no pick for this round
  - For each player:
    - Insert player_progress (chosen_team = "NO-PICK", outcome = "LOSE")
    - Deduct 1 life
    - If lives < 0, set status = 'out'
```

**Step 3: Check competition completion**
```
If active_players <= 1:
  - Update competition.status = 'COMPLETE'
```

---

## Testing Commands

### Test with curl (after starting server)

**1. Add Fixtures**:
```bash
curl -X POST http://localhost:3015/organizer-add-fixtures \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "competition_id": 123,
    "kickoff_time": "2025-10-25T15:00:00Z",
    "fixtures": [
      {"home_team_short": "ARS", "away_team_short": "CHE"},
      {"home_team_short": "LIV", "away_team_short": "MUN"}
    ]
  }'
```

**2. Get Fixtures for Results**:
```bash
curl -X POST http://localhost:3015/organizer-get-fixtures-for-results \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{"competition_id": 123}'
```

**3. Set Result**:
```bash
curl -X POST http://localhost:3015/organizer-set-result \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{"fixture_id": 456, "result": "home_win"}'
```

**4. Process Results**:
```bash
curl -X POST http://localhost:3015/organizer-process-results \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{"competition_id": 123}'
```

---

## Next Steps (Frontend)

To complete the organizer fixture management system, the following frontend work is needed:

### 1. Create Frontend Pages
- [ ] `/game/[id]/organizer-fixtures/page.tsx` - Fixture management UI
- [ ] `/game/[id]/organizer-results/page.tsx` - Results entry UI

### 2. Update API Client
- [ ] Add `organizerApi` functions to `lmslocal-web/src/lib/api.ts`

### 3. Update Dashboard
- [ ] Add conditional buttons to `/game/[id]/page.tsx`
- [ ] Show buttons only if `isOrganiser && fixture_service === false`

### 4. Testing
- [ ] Test with `fixture_service = true` (no buttons should appear)
- [ ] Test with `fixture_service = false` (buttons appear for organizer)
- [ ] Test full workflow: add fixtures → enter results → process → verify eliminations

---

## Database Tables Affected

### Direct Writes
- `round` - Creates/updates rounds
- `fixture` - Adds/deletes/updates fixtures
- `pick` - Updates outcome field
- `player_progress` - Inserts progress records
- `competition_user` - Updates lives_remaining and status
- `competition` - Updates status to COMPLETE
- `audit_log` - Logs organizer actions

### No Changes
- `fixture_load` - Not used (organizers write directly to fixture table)
- `team` - Read-only (for team name lookups)
- `app_user` - Read-only (for authorization checks)

---

## Comparison: Admin vs Organizer Systems

| Feature | Admin System | Organizer System |
|---------|-------------|------------------|
| **Routes** | `/admin-*` | `/organizer-*` |
| **Staging Table** | `fixture_load` | None (direct write) |
| **Push Operation** | Pushes to ALL subscribed competitions | N/A (direct write to one competition) |
| **Access** | Access code (`12221`) | JWT + organizer check |
| **Scope** | Global (all competitions) | Single competition only |
| **UI Pages** | `/admin-fixtures`, `/admin-results` | `/game/[id]/organizer-fixtures`, `/organizer-results` |
| **Competition Filter** | `fixture_service = true` | `fixture_service = false` |

---

## Success Criteria ✅

- [x] 4 new API routes created
- [x] All routes follow API-Rules.md standards
- [x] Authorization checks implemented
- [x] Competition isolation enforced
- [x] Elimination logic ported from old system
- [x] No-pick penalties handled correctly
- [x] Competition completion detection
- [x] Audit logging added
- [x] Routes registered in server.js
- [x] Server syntax validated
- [ ] Frontend pages created (next phase)
- [ ] End-to-end testing completed (next phase)

---

## Files Modified

1. **Created**: `lmslocal-server/routes/organizer-add-fixtures.js` (262 lines)
2. **Created**: `lmslocal-server/routes/organizer-get-fixtures-for-results.js` (127 lines)
3. **Created**: `lmslocal-server/routes/organizer-set-result.js` (122 lines)
4. **Created**: `lmslocal-server/routes/organizer-process-results.js` (329 lines)
5. **Modified**: `lmslocal-server/server.js` (added imports and route registrations)

**Total Lines of Code**: ~840 lines of new backend code

---

## Ready for Frontend Development

The backend is now complete and ready for frontend integration. The next phase will create the UI pages that call these APIs, following the design patterns from the admin fixture pages.

**Status**: ✅ Phase 1 (Backend APIs) COMPLETE
