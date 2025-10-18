# Testing the Organizer Fixture Management System

## Quick Start

### 1. Start Both Servers

**Terminal 1 - Backend**:
```bash
cd lmslocal-server
npm start
```

**Terminal 2 - Frontend**:
```bash
cd lmslocal-web
npm run dev
```

Wait for both to start, then open `http://localhost:3000`

---

## 2. Setup Test Competition

### Option A: Create New Competition
1. Login to your account
2. Click "Create Competition"
3. Fill in details
4. **IMPORTANT**: Set up competition WITHOUT enabling fixture service
5. Invite yourself as a player (or add guest player)

### Option B: Use Existing Competition
Update an existing competition in database:
```sql
UPDATE competition
SET fixture_service = false
WHERE id = YOUR_COMPETITION_ID;
```

---

## 3. Test Workflow

### Step 1: Add Fixtures ✅

1. **Navigate to competition dashboard**
   - Go to `/game/[id]`
   - You should see two new buttons:
     - **Fixtures** (blue icon)
     - **Results** (green icon)

2. **Click "Fixtures" button**
   - Redirects to `/game/[id]/organizer-fixtures`
   - Should see team selection grid

3. **Select kickoff date/time**
   - Pick tomorrow's date
   - Set time to 15:00

4. **Add fixtures by clicking teams**
   - Click "ARS" (Arsenal) → becomes HOME team
   - Click "CHE" (Chelsea) → becomes AWAY team
   - New fixture row auto-created
   - Continue adding 4-5 fixtures

5. **Save fixtures**
   - Click "Save Fixtures" button
   - Should see success message
   - Redirects back to dashboard

### Step 2: Enter Results ✅

1. **Click "Results" button on dashboard**
   - Redirects to `/game/[id]/organizer-results`
   - Should see list of all fixtures

2. **Enter results for each fixture**
   - For first fixture: Click "Arsenal Win" button
     - Button turns green with checkmark
   - For second fixture: Click "Draw" button
   - For third fixture: Click "Chelsea Win" button
   - Continue for all fixtures

3. **Process results**
   - When all results entered, "Process Results" button enables
   - Click "Process Results"
   - Confirm dialog appears
   - Click OK
   - Should see success message with:
     - Fixtures processed count
     - Players eliminated count
     - No-pick penalties count
     - Active players remaining
   - Redirects to dashboard after 2 seconds

### Step 3: Verify Results ✅

1. **Check dashboard**
   - Player count should reflect eliminations
   - If only 1 player left, competition should be COMPLETE

2. **Check database** (optional):
```sql
-- Check player lives
SELECT au.display_name, cu.lives_remaining, cu.status
FROM competition_user cu
JOIN app_user au ON cu.user_id = au.id
WHERE cu.competition_id = YOUR_COMPETITION_ID;

-- Check player progress
SELECT au.display_name, pp.round_id, pp.chosen_team, pp.outcome
FROM player_progress pp
JOIN app_user au ON pp.player_id = au.id
WHERE pp.competition_id = YOUR_COMPETITION_ID
ORDER BY pp.round_id, au.display_name;

-- Check fixtures
SELECT * FROM fixture
WHERE competition_id = YOUR_COMPETITION_ID
ORDER BY round_id, kickoff_time;
```

---

## Expected Behavior

### Automated Competitions (fixture_service = true)
- ❌ NO "Fixtures" button visible
- ❌ NO "Results" button visible
- ✅ Only standard organizer buttons (Settings, Players, etc.)

### Manual Competitions (fixture_service = false)
- ✅ "Fixtures" button visible (blue icon)
- ✅ "Results" button visible (green icon)
- ✅ Clicking Fixtures → fixture management page
- ✅ Clicking Results → results entry page

### Non-Organizers
- ❌ NO "Fixtures" button (even if fixture_service = false)
- ❌ NO "Results" button
- ❌ Direct URL access blocked (redirects to dashboard)

---

## Common Issues & Fixes

### Issue: Buttons don't appear
**Check**:
- Are you the organizer? (`competition.is_organiser = true`)
- Is `fixture_service = false` in database?
- Clear browser cache and refresh

**Fix**:
```sql
-- Verify competition settings
SELECT id, name, organiser_id, fixture_service
FROM competition
WHERE id = YOUR_COMPETITION_ID;

-- Set to manual mode if needed
UPDATE competition
SET fixture_service = false
WHERE id = YOUR_COMPETITION_ID;
```

### Issue: "Unauthorized" error
**Check**:
- Are you logged in?
- Are you the organizer?
- Is JWT token valid?

**Fix**:
- Logout and login again
- Check browser console for errors

### Issue: No fixtures load in Results page
**Check**:
- Did you add fixtures first?
- Does round exist?

**Fix**:
- Go to Fixtures page and add fixtures first

### Issue: Process Results button stays disabled
**Check**:
- Have you entered results for ALL fixtures?
- Any fixtures missing results?

**Fix**:
- Scroll through all fixtures
- Make sure each has a green checkmark
- Enter missing results

---

## Testing Checklist

### Basic Flow
- [ ] Login as organizer
- [ ] Navigate to manual competition dashboard
- [ ] See Fixtures and Results buttons
- [ ] Click Fixtures button
- [ ] Add 5+ fixtures
- [ ] Save successfully
- [ ] Click Results button
- [ ] Enter all results
- [ ] Process results successfully
- [ ] Verify eliminations

### Edge Cases
- [ ] Try to access as non-organizer (should redirect)
- [ ] Try automated competition (buttons should not appear)
- [ ] Try entering partial results and process (should be disabled)
- [ ] Try adding fixtures with invalid date (should error)
- [ ] Try processing with no fixtures (should error)

### Authorization
- [ ] Logout and try to access pages (should redirect to login)
- [ ] Access as participant (should redirect to dashboard)
- [ ] Access automated competition's organizer-fixtures (should redirect)

---

## API Testing (Optional)

### Test with curl (requires JWT token)

**Get JWT Token**:
1. Login via frontend
2. Open browser dev tools → Application → Local Storage
3. Copy `jwt_token` value

**Test Add Fixtures**:
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

**Expected Response**:
```json
{
  "return_code": "SUCCESS",
  "round_id": 5,
  "round_number": 5,
  "fixtures_added": 2,
  "message": "2 fixtures added to Round 5"
}
```

---

## Success Criteria

**You'll know it's working when**:
1. ✅ Buttons appear for manual competitions only
2. ✅ Buttons hidden for automated competitions
3. ✅ Can add fixtures successfully
4. ✅ Can enter results successfully
5. ✅ Can process results successfully
6. ✅ Players are eliminated correctly
7. ✅ No-pick penalties are applied
8. ✅ Competition completes with 1 player left

---

## Next Steps After Testing

1. **If tests pass**: System is ready for production
2. **If bugs found**: Document issues and report
3. **If all good**: Update CLAUDE.md with new features

---

## Need Help?

**Check these files**:
- `ORGANIZER-SYSTEM-COMPLETE.md` - Full documentation
- `ORGANIZER-APIS-COMPLETE.md` - API reference
- `ORGANIZER-FIXTURE-SYSTEM-IMPLEMENTATION-PLAN.md` - Implementation details

**Common SQL queries** are in the "Verify Results" section above.

**Frontend errors** will appear in browser console (F12).

**Backend errors** will appear in terminal where you ran `npm start`.

---

**Ready?** Start both servers and begin testing! 🚀
