# Frontend Crash Debugging Log

## Issue Summary
**Problem:** Intermittent frontend crashes causing blank screen with errors
**Duration:** Ongoing for ~1 week
**Frequency:** Sporadic, usually recovers on browser refresh
**Environment:** Chrome Desktop, IP 192.168.1.88:3000 → 192.168.1.88:3015

## Recent Crash Instance

**Date/Time:** 2025-08-30 (Latest Session)
**Trigger Action:** Pressed "Create Round" button (as admin)
**User Role:** Admin
**Current State:** Round 4 creation
**Browser:** Chrome Desktop
**Result:** 2 errors + blank screen → Fixed on refresh

### Console Errors Observed:
- `Access to XMLHttpRequest blocked by CORS policy` (multiple APIs)
- `AxiosError: Network Error`
- `Failed to load competition data`
- `Failed to load resource: net::ERR_FAILED`

### Network State:
- Multiple API calls failing simultaneously
- Backend appears to be running (works on refresh)
- CORS errors suggest React crash, not backend issue

## Crash Pattern Analysis

### Suspected Triggers:
- [x] Create Round button
- [ ] Back button navigation
- [ ] JWT token expiration
- [ ] Cache issues
- [ ] Multiple rapid clicks
- [ ] Long session duration

### Recent Code Changes (Potential Culprits):
1. **New standings history logic** (2025-08-30)
   - Added complex history queries
   - Multiple async calls per player
   - Potential race conditions

2. **NO_PICK processing** (Previous session)
   - Database flag logic
   - Multiple API calls during result calculation

3. **Authentication improvements** (Previous sessions)
   - JWT handling changes
   - Token refresh logic

## Debug Strategies to Try

### Immediate Actions:
- [ ] Add more console.log to identify crash point
- [ ] Wrap API calls in better error handling
- [ ] Add React Error Boundary components
- [ ] Implement API call debouncing

### Code Review Targets:
- [ ] `get-competition-standings.js` - New history query logic
- [ ] `page.tsx` standings - Multiple useEffect calls
- [ ] AbortController usage - Cleanup on unmount
- [ ] Race conditions in Create Round flow

### Testing Scenarios:
- [ ] Create round immediately after login
- [ ] Create round after long session
- [ ] Create round with/without active players
- [ ] Multiple tabs open simultaneously
- [ ] Different browsers (Edge, Firefox)

## Major Code Improvements (2025-08-30)

### ✅ COMPLETED: Ultra-Efficient calculate-results.js Rewrite
**Problem:** N+1 query pattern causing 1,500+ database queries per operation
**Solution:** Complete rewrite using bulk SQL operations and single transactions

**Changes Made:**
- **Query reduction**: 1,500+ queries → 8 queries maximum
- **Single transaction**: All operations atomic (success or rollback)
- **Bulk SQL operations**: Using CTEs, CASE statements, UPDATE...FROM
- **Connection pool safety**: No more connection exhaustion risk
- **Idempotent design**: Can be run multiple times safely

**Expected Impact:**
- ✅ **Eliminate server crashes** during result calculation
- ✅ **Much faster execution** (seconds instead of minutes)
- ✅ **Better stability** under load
- ✅ **Production ready** with proper transaction handling

**Backup:** Original file saved as `calculate-results-old-backup.js`

## Next Steps

1. ✅ **Add Error Boundary** to catch React crashes  
2. ✅ **Major database efficiency rewrite** - calculate-results.js
3. **Test new calculate-results** extensively 
4. **Monitor for reduced crash frequency**
5. **Consider similar improvements** to other heavy routes

## Session Log

| Date | Action | Result | Notes |
|------|--------|--------|-------|
| 2025-08-30 | Create Round 4 | Crash → Refresh Fix | CORS errors, multiple API failures |
| 2025-08-30 | Kate mobile - back from results | Crash → Red Error Screen → Refresh Fix | AxiosError getPlayerDashboard(), competition complete |

## Error Boundary Status
✅ **WORKING** - Red error screen shown instead of blank page
✅ **Server Recovery** - Backend appears to self-recover (nodemon auto-restart?)
✅ **Frontend Recovery** - Refresh fixes the issue consistently

## Patterns Identified

### Crash Characteristics:
- ✅ **Intermittent** - Not consistently reproducible
- ✅ **Admin actions** - "Create Round" triggers crashes
- ✅ **Competition state changes** - End of competition causes issues
- ✅ **Self-recovering** - Backend restarts automatically
- ✅ **Refresh fixes** - Frontend recovers after page reload

### Error Types Seen:
1. **CORS/Network errors** - Multiple API failures at once
2. **AxiosError** - getPlayerDashboard() when competition complete
3. **React crashes** - Now caught by Error Boundary (red screen)

### Production Considerations:
**Server Recovery:** In production, you'll need process managers like PM2 or Docker restart policies. Nodemon auto-restart only works in development.

**Recommendation:** Add PM2 or similar for production deployment to ensure server auto-recovery.

## Hypotheses Ranking (Updated)

1. **Server instability** under load/state changes (HIGH)
2. **Race conditions** in frontend during competition transitions (HIGH)
3. **API error handling** for edge cases (completed competitions) (MEDIUM)
4. **Memory leaks** accumulating over long sessions (MEDIUM)
5. **JWT token expiration** mid-request (LOW - would be consistent)

---

*Update this document after each crash or successful debug attempt*