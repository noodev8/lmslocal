# Organizer Fixture & Results Management System - Implementation Plan

## Overview

Build a new, clean fixture and results management system for competition organizers (where `fixture_service = false`). This system will be inspired by the existing admin pages but scoped to individual competitions.

---

## System Architecture

### Two Parallel Systems

```
┌─────────────────────────────────────────────────────────────┐
│ GLOBAL ADMIN SYSTEM (fixture_service = true)                │
│ Routes: /admin-fixtures, /admin-results                     │
│ Tables: fixture_load (staging) → push to competitions       │
│ User: You (super admin)                                     │
│ Status: ✅ Working, no changes needed                       │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ ORGANIZER SYSTEM (fixture_service = false) [NEW]            │
│ Routes: /game/[id]/organizer-fixtures, organizer-results    │
│ Tables: round, fixture (direct write, no staging)           │
│ User: Competition organizer only                            │
│ Status: 🔨 To be built                                      │
└─────────────────────────────────────────────────────────────┘
```

### Key Design Principles

1. **Zero Impact on Global Admin**: Existing admin system remains unchanged
2. **Competition-Scoped**: Organizers can ONLY manage their own competition
3. **Modern UX**: Copy the click-to-select interface from admin pages
4. **Authorization**: Verify user is competition organizer on every request
5. **Auto-Create Rounds**: Don't require manual round creation - create automatically
6. **Direct Database**: Write to `round` and `fixture` tables (no staging)

---

## Phase 1: Backend API Routes

### 1.1 Create `organizer-add-fixtures.js`

**Location**: `lmslocal-server/routes/organizer-add-fixtures.js`

**Purpose**: Add/replace fixtures for a competition's current or new round

**Request Payload**:
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

**Logic Flow**:
1. Verify JWT token and extract `user_id`
2. Verify user is organizer of competition (check `competition.organiser_id = user_id`)
3. Find current round (latest incomplete round) OR create new round
4. Delete any existing fixtures in that round (replace operation)
5. Insert new fixtures with team lookups
6. Return round info and fixture count

**Error Codes**:
- `UNAUTHORIZED` - Not the organizer
- `VALIDATION_ERROR` - Missing/invalid fields
- `COMPETITION_NOT_FOUND` - Competition doesn't exist
- `SERVER_ERROR` - Database error

**Key Code Patterns**:
```javascript
// Authorization check
const verifyResult = await query(`
  SELECT organiser_id, name, status, fixture_service
  FROM competition
  WHERE id = $1
`, [competition_id]);

if (verifyResult.rows[0].organiser_id !== user_id) {
  return res.json({
    return_code: "UNAUTHORIZED",
    message: "Only the competition organiser can manage fixtures"
  });
}

// Prevent changes to automated competitions
if (verifyResult.rows[0].fixture_service === true) {
  return res.json({
    return_code: "VALIDATION_ERROR",
    message: "This competition uses automated fixture service. Contact admin to add fixtures."
  });
}
```

---

### 1.2 Create `organizer-get-fixtures-for-results.js`

**Location**: `lmslocal-server/routes/organizer-get-fixtures-for-results.js`

**Purpose**: Get all fixtures from the current round that need results entered

**Request Payload**:
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
      "kickoff_time": "2025-10-25T15:00:00Z",
      "result": null
    }
  ],
  "total_fixtures": 10,
  "fixtures_with_results": 3,
  "fixtures_pending": 7
}
```

**Logic Flow**:
1. Verify JWT token and organizer authorization
2. Get current round (latest round by round_number)
3. Get all fixtures from that round
4. Calculate stats (total, completed, pending)
5. Return fixture list

**Error Codes**: Same as above

---

### 1.3 Create `organizer-set-result.js`

**Location**: `lmslocal-server/routes/organizer-set-result.js`

**Purpose**: Set result for a single fixture (home_win, away_win, or draw)

**Request Payload**:
```json
{
  "fixture_id": 456,
  "result": "home_win"
}
```

**Success Response**:
```json
{
  "return_code": "SUCCESS",
  "fixture_id": 456,
  "result": "ARS",
  "message": "Result saved"
}
```

**Logic Flow**:
1. Verify JWT token
2. Get fixture and verify user is organizer of the competition
3. Convert result type to team short name:
   - `home_win` → home_team_short (e.g., "ARS")
   - `away_win` → away_team_short (e.g., "CHE")
   - `draw` → "DRAW"
4. Update fixture.result field
5. Return confirmation

**Important**: This ONLY sets the result field - it does NOT process eliminations. That happens separately.

**Error Codes**: Same as above + `FIXTURE_NOT_FOUND`

---

### 1.4 Create `organizer-process-results.js`

**Location**: `lmslocal-server/routes/organizer-process-results.js`

**Purpose**: Process all results for the current round (eliminations, no-picks, competition completion)

**Request Payload**:
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
  "message": "Round processed successfully"
}
```

**Logic Flow**:
1. Verify JWT token and organizer authorization
2. Get current round and all fixtures with results
3. For each fixture with result (and not yet processed):
   - Get all picks for that fixture
   - Determine outcome (WIN/LOSE) based on pick vs result
   - Update pick.outcome
   - Insert player_progress record
   - Deduct lives if LOSE
   - Mark fixture as processed
4. Process no-pick penalties (players who didn't pick)
5. Check if competition is complete (≤1 active player)
6. Return processing summary

**Key Pattern**: Copy logic from old `submit-results.js.delete` lines 166-311

---

## Phase 2: Frontend Pages

### 2.1 Create Organizer Fixtures Page

**Location**: `lmslocal-web/src/app/game/[id]/organizer-fixtures/page.tsx`

**Design**: Copy UX from `/admin-fixtures/page.tsx` but adapt for single competition

**UI Components**:
1. **Header**: "Manage Fixtures - [Competition Name]"
2. **Kickoff Date/Time Selector**
3. **Team Selection Grid**: Click-to-select interface
   - Show available teams from competition's team_list
   - Track used teams (can't use same team twice)
   - Select home → select away → fixture auto-creates
4. **Pending Fixtures List**: Show fixtures before saving
5. **Save Button**: Submit all fixtures at once
6. **Success/Error Messages**

**Key Differences from Admin Page**:
- No access code (uses JWT auth)
- No gameweek concept (just current round)
- No "Push Fixtures" button (saves directly)
- Shows only teams from this competition's team_list

**State Management**:
```typescript
const [kickoffDate, setKickoffDate] = useState('');
const [kickoffTime, setKickoffTime] = useState('15:00');
const [pendingFixtures, setPendingFixtures] = useState<Fixture[]>([]);
const [usedTeams, setUsedTeams] = useState<Set<string>>(new Set());
const [activeSide, setActiveSide] = useState<'home' | 'away'>('home');
const [selectedHomeTeam, setSelectedHomeTeam] = useState<string | null>(null);
```

**API Call**:
```typescript
const handleSaveFixtures = async () => {
  const response = await axios.post('/organizer-add-fixtures', {
    competition_id: parseInt(competitionId),
    kickoff_time: `${kickoffDate}T${kickoffTime}:00Z`,
    fixtures: pendingFixtures
  });

  if (response.data.return_code === 'SUCCESS') {
    // Show success, redirect to dashboard
  }
};
```

---

### 2.2 Create Organizer Results Page

**Location**: `lmslocal-web/src/app/game/[id]/organizer-results/page.tsx`

**Design**: Copy UX from `/admin-results/page.tsx` but for single competition

**UI Components**:
1. **Header**: "Enter Results - Round [N]"
2. **Fixtures List**: Each fixture shows:
   - Team names
   - Kickoff time
   - Three buttons: [Home Win] [Draw] [Away Win]
   - Instant save on click
   - Show checkmark when result entered
3. **Progress Indicator**: "7 of 10 results entered"
4. **Process Results Button**: Only enabled when ALL results entered
5. **Success/Error Messages**

**Key Differences from Admin Page**:
- No access code (uses JWT auth)
- No "Push Results" button (processes directly)
- Shows only current round's fixtures
- Auto-loads fixtures on mount

**State Management**:
```typescript
const [fixtures, setFixtures] = useState<Fixture[]>([]);
const [roundInfo, setRoundInfo] = useState<{ round_id: number; round_number: number } | null>(null);
const [processing, setProcessing] = useState(false);
```

**API Calls**:
```typescript
// Load fixtures
const loadFixtures = async () => {
  const response = await axios.post('/organizer-get-fixtures-for-results', {
    competition_id: parseInt(competitionId)
  });
  setFixtures(response.data.fixtures);
  setRoundInfo({ round_id: response.data.round_id, round_number: response.data.round_number });
};

// Set single result
const handleSetResult = async (fixtureId: number, result: 'home_win' | 'away_win' | 'draw') => {
  await axios.post('/organizer-set-result', {
    fixture_id: fixtureId,
    result: result
  });
  // Update local state to show checkmark
  setFixtures(prev => prev.map(f =>
    f.id === fixtureId ? { ...f, result_entered: result } : f
  ));
};

// Process all results
const handleProcessResults = async () => {
  setProcessing(true);
  const response = await axios.post('/organizer-process-results', {
    competition_id: parseInt(competitionId)
  });
  if (response.data.return_code === 'SUCCESS') {
    // Show success message, redirect to dashboard
    router.push(`/game/${competitionId}`);
  }
  setProcessing(false);
};
```

---

## Phase 3: Dashboard Integration

### 3.1 Update Game Dashboard

**Location**: `lmslocal-web/src/app/game/[id]/page.tsx`

**Changes Required**:

1. **Add Conditional Buttons** (after line 200, where old fixtures button was commented out):

```typescript
{/* Organizer Fixture Management - Only show if manual mode */}
{isOrganiser && competition.fixture_service === false && (
  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
    {/* Manage Fixtures Card */}
    <button
      onClick={() => router.push(`/game/${competitionId}/organizer-fixtures`)}
      className="p-6 bg-white rounded-lg shadow hover:shadow-md transition-shadow text-left"
    >
      <div className="flex items-center gap-3">
        <CalendarIcon className="h-8 w-8 text-blue-600" />
        <div>
          <h3 className="font-semibold text-lg">Manage Fixtures</h3>
          <p className="text-sm text-gray-600">Add or update round fixtures</p>
        </div>
      </div>
    </button>

    {/* Enter Results Card */}
    <button
      onClick={() => router.push(`/game/${competitionId}/organizer-results`)}
      className="p-6 bg-white rounded-lg shadow hover:shadow-md transition-shadow text-left"
    >
      <div className="flex items-center gap-3">
        <CheckCircleIcon className="h-8 w-8 text-green-600" />
        <div>
          <h3 className="font-semibold text-lg">Enter Results</h3>
          <p className="text-sm text-gray-600">Record fixture outcomes</p>
        </div>
      </div>
    </button>
  </div>
)}
```

2. **Import Required Icons**:
```typescript
import { CalendarIcon, CheckCircleIcon } from '@heroicons/react/24/outline';
```

3. **Ensure `fixture_service` field in competition data**:
Check that `get-user-dashboard.js` returns `fixture_service` field.

---

## Phase 4: API Client Updates

### 4.1 Update `lmslocal-web/src/lib/api.ts`

**Add New API Functions**:

```typescript
// Organizer Fixture APIs
export const organizerApi = {
  // Add fixtures to competition
  addFixtures: (competition_id: number, kickoff_time: string, fixtures: Array<{home_team_short: string, away_team_short: string}>) =>
    axiosInstance.post('/organizer-add-fixtures', { competition_id, kickoff_time, fixtures }),

  // Get fixtures needing results
  getFixturesForResults: (competition_id: number) =>
    axiosInstance.post('/organizer-get-fixtures-for-results', { competition_id }),

  // Set single fixture result
  setResult: (fixture_id: number, result: 'home_win' | 'away_win' | 'draw') =>
    axiosInstance.post('/organizer-set-result', { fixture_id, result }),

  // Process all results for round
  processResults: (competition_id: number) =>
    axiosInstance.post('/organizer-process-results', { competition_id })
};
```

---

## Phase 5: Backend Route Registration

### 5.1 Update `lmslocal-server/server.js`

**Add Route Registrations** (around line 100, with other route registrations):

```javascript
// Organizer fixture/results management (manual competitions only)
app.use('/organizer-add-fixtures', require('./routes/organizer-add-fixtures'));
app.use('/organizer-get-fixtures-for-results', require('./routes/organizer-get-fixtures-for-results'));
app.use('/organizer-set-result', require('./routes/organizer-set-result'));
app.use('/organizer-process-results', require('./routes/organizer-process-results'));
```

---

## Phase 6: Testing Strategy

### 6.1 Backend API Testing (Use Postman or curl)

**Test 1: Authorization Check**
```bash
# Should fail - not organizer
curl -X POST http://localhost:3015/organizer-add-fixtures \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer WRONG_USER_TOKEN" \
  -d '{"competition_id": 123, "kickoff_time": "...", "fixtures": []}'
# Expected: return_code = "UNAUTHORIZED"
```

**Test 2: Add Fixtures**
```bash
curl -X POST http://localhost:3015/organizer-add-fixtures \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ORGANIZER_TOKEN" \
  -d '{
    "competition_id": 123,
    "kickoff_time": "2025-10-25T15:00:00Z",
    "fixtures": [
      {"home_team_short": "ARS", "away_team_short": "CHE"},
      {"home_team_short": "LIV", "away_team_short": "MUN"}
    ]
  }'
# Expected: return_code = "SUCCESS", fixtures_added = 2
```

**Test 3: Get Fixtures for Results**
```bash
curl -X POST http://localhost:3015/organizer-get-fixtures-for-results \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ORGANIZER_TOKEN" \
  -d '{"competition_id": 123}'
# Expected: return_code = "SUCCESS", fixtures array returned
```

**Test 4: Set Result**
```bash
curl -X POST http://localhost:3015/organizer-set-result \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ORGANIZER_TOKEN" \
  -d '{"fixture_id": 456, "result": "home_win"}'
# Expected: return_code = "SUCCESS"
```

**Test 5: Process Results**
```bash
curl -X POST http://localhost:3015/organizer-process-results \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ORGANIZER_TOKEN" \
  -d '{"competition_id": 123}'
# Expected: return_code = "SUCCESS", players_eliminated > 0
```

### 6.2 Frontend Testing

**Setup Test Competition**:
1. Create competition with `fixture_service = false`
2. Login as organizer
3. Navigate to `/game/[id]`

**Test Checklist**:
- [ ] Buttons appear on dashboard (organizer, manual mode)
- [ ] Buttons DO NOT appear if `fixture_service = true`
- [ ] Buttons DO NOT appear for non-organizer participants
- [ ] Click "Manage Fixtures" → page loads
- [ ] Select teams → fixtures appear in pending list
- [ ] Save fixtures → success message + redirect
- [ ] Click "Enter Results" → fixtures load
- [ ] Click result buttons → checkmarks appear
- [ ] All results entered → "Process Results" button enabled
- [ ] Process results → players eliminated correctly
- [ ] Check database: `pick.outcome`, `player_progress`, `competition_user.lives_remaining`

### 6.3 Database Verification Queries

**After adding fixtures**:
```sql
SELECT * FROM round WHERE competition_id = 123 ORDER BY round_number DESC LIMIT 1;
SELECT * FROM fixture WHERE round_id = [round_id] ORDER BY kickoff_time;
```

**After setting results**:
```sql
SELECT id, home_team_short, away_team_short, result, processed
FROM fixture
WHERE round_id = [round_id];
```

**After processing results**:
```sql
-- Check picks were updated
SELECT p.id, p.team, p.outcome, au.display_name
FROM pick p
JOIN app_user au ON p.user_id = au.id
WHERE p.round_id = [round_id];

-- Check player lives
SELECT cu.user_id, au.display_name, cu.lives_remaining, cu.status
FROM competition_user cu
JOIN app_user au ON cu.user_id = au.id
WHERE cu.competition_id = 123;

-- Check player_progress records
SELECT pp.*, au.display_name
FROM player_progress pp
JOIN app_user au ON pp.player_id = au.id
WHERE pp.competition_id = 123 AND pp.round_id = [round_id];
```

### 6.4 Edge Case Testing

**Test Scenario 1: Fixture Service Toggle**
- Create competition with `fixture_service = true`
- Verify buttons DO NOT appear
- Update to `fixture_service = false` via database
- Refresh page → buttons should appear

**Test Scenario 2: Non-Organizer Access**
- Try to access `/game/[id]/organizer-fixtures` as participant
- Should redirect or show error

**Test Scenario 3: Replace Fixtures**
- Add 10 fixtures
- Add 5 different fixtures (should replace, not append)
- Verify only 5 fixtures exist in round

**Test Scenario 4: No-Pick Penalties**
- Create round with 2 players
- Player 1 makes pick, Player 2 does not
- Process results
- Verify Player 2 loses a life

**Test Scenario 5: Competition Completion**
- Create competition with 2 players
- Player 1 picks winner, Player 2 picks loser
- Process results
- Verify competition status = 'COMPLETE'

---

## Phase 7: Documentation Updates

### 7.1 Update CLAUDE.md

Add section:
```markdown
### Fixture & Result Management

**Two Systems**:

1. **Automated (fixture_service = true)**:
   - Admin manages via `/admin-fixtures` and `/admin-results`
   - Fixtures stored in `fixture_load` staging table
   - Pushed to all subscribed competitions
   - Organizers have NO fixture management buttons

2. **Manual (fixture_service = false)**:
   - Organizers manage via `/game/[id]/organizer-fixtures` and `/organizer-results`
   - Fixtures written directly to `round` and `fixture` tables
   - Scoped to individual competition only
   - Organizers see fixture management buttons on dashboard
```

### 7.2 Create Help Documentation

Create help page: `/lmslocal-web/src/app/help/guides/managing-fixtures-organizers/page.tsx`

Content:
- How to add fixtures
- How to enter results
- How to process eliminations
- When to use manual vs automated mode

---

## Implementation Order (Step-by-Step)

### Step 1: Backend Routes (Day 1-2)
1. ✅ Create `organizer-add-fixtures.js`
2. ✅ Create `organizer-get-fixtures-for-results.js`
3. ✅ Create `organizer-set-result.js`
4. ✅ Create `organizer-process-results.js`
5. ✅ Register routes in `server.js`
6. ✅ Test all routes with Postman/curl

### Step 2: API Client (Day 2)
7. ✅ Add `organizerApi` functions to `api.ts`
8. ✅ Test API calls from frontend dev tools

### Step 3: Frontend Pages (Day 3-4)
9. ✅ Create `organizer-fixtures/page.tsx`
10. ✅ Create `organizer-results/page.tsx`
11. ✅ Test pages in isolation

### Step 4: Dashboard Integration (Day 4)
12. ✅ Add conditional buttons to game dashboard
13. ✅ Test button visibility logic

### Step 5: End-to-End Testing (Day 5)
14. ✅ Complete full workflow test
15. ✅ Test all edge cases
16. ✅ Verify database state at each step

### Step 6: Documentation (Day 5)
17. ✅ Update CLAUDE.md
18. ✅ Create help documentation
19. ✅ Add inline code comments

---

## Rollback Plan

If issues arise, rollback is simple:

1. **Remove route registrations** from `server.js`
2. **Delete new route files** (`organizer-*.js`)
3. **Delete new frontend pages** (`organizer-fixtures/`, `organizer-results/`)
4. **Remove buttons** from game dashboard

**Zero impact on existing system** - admin fixtures continue working unchanged.

---

## Future Enhancements (Post-MVP)

1. **Bulk Import**: Upload CSV of fixtures
2. **Fixture Templates**: Save common fixture sets
3. **Result Notifications**: Email players when results processed
4. **Round History**: View past rounds and results
5. **Fixture Editing**: Edit individual fixtures after creation
6. **Lock Time Override**: Custom lock times per fixture

---

## Success Criteria

✅ Organizers can add fixtures to their competition
✅ Organizers can enter results for their competition
✅ Results processing eliminates players correctly
✅ No impact on automated competitions (fixture_service = true)
✅ No impact on global admin system
✅ System is scoped - organizers cannot affect other competitions
✅ UI is clean and matches admin page quality

---

## Questions / Clarifications Needed

1. **Round Auto-Creation**: Should we auto-create rounds, or require manual creation first?
   - **Recommendation**: Auto-create for simplicity

2. **Multiple Rounds**: Can organizers have multiple incomplete rounds at once?
   - **Recommendation**: No - only one active round at a time

3. **Fixture Editing**: Should organizers be able to edit fixtures after creation?
   - **Recommendation**: Yes - by replacing all fixtures (like admin system)

4. **Result Editing**: Can organizers change results after processing?
   - **Recommendation**: No - results are final once processed

5. **Competition Switching**: Can we toggle `fixture_service` mid-competition?
   - **Recommendation**: No - lock on creation to avoid confusion

---

**Ready to proceed?** Let me know if you want me to start building, or if you need any clarifications on this plan!
