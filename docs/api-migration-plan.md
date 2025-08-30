# API Response Standardization Migration Plan

## Overview

This document tracks the migration of our existing APIs from HTTP status code-based error handling to a standardized 200 OK + `return_code` pattern. This approach improves crash resilience and provides consistent error handling across the application.

## Target Pattern

**Current (Crash-Prone) Pattern:**
```javascript
// Backend
if (error) {
  return res.status(404).json({
    return_code: "ERROR",
    message: "Not found"
  });
}

// Frontend - can crash on unhandled HTTP errors
const response = await api.call(); // May throw on 404/403/500
```

**Target (Crash-Safe) Pattern:**
```javascript
// Backend - Always return 200
if (error) {
  return res.status(200).json({
    return_code: "ERROR",
    message: "Not found"
  });
}

// Frontend - Always handles response
const response = await api.call(); // Always succeeds
if (response.data.return_code === "SUCCESS") {
  // Handle success
} else {
  // Handle error gracefully
}
```

## Migration Status

### Authentication & User Management
- [ ] `login.js` - Returns 401 on invalid credentials
- [ ] `register.js` - Returns 400 on validation errors
- [ ] `verify-email.js` - Returns 400 on invalid tokens
- [ ] `resend-verification.js` - Returns 404 if user not found
- [ ] `check-user-type.js` - Uses 200 pattern ✅
- [ ] `update-profile.js` - Returns 400 on validation errors

### Competition Management
- [ ] `create-competition.js` - Returns 400 on validation errors
- [ ] `mycompetitions.js` - Uses 200 pattern ✅
- [ ] `get-competition-status.js` - Returns 404/403 on auth failures
- [ ] `get-competition-players.js` - Returns 404/403 on auth failures
- [ ] `lock-unlock-competition.js` - Returns 403 on unauthorized access
- [ ] `validate-access-code.js` - Returns 404 on invalid codes
- [x] `join-competition-by-code.js` - ✅ Migrated to 200 + return_code pattern
- [ ] `join-by-access-code.js` - Returns 404/403 on failures

### Round & Fixture Management
- [ ] `create-round.js` - Returns 404/403 on auth failures
- [ ] `update-round.js` - Returns 404/403 on auth failures
- [ ] `get-rounds.js` - Returns 404 on not found
- [ ] `add-fixtures-bulk.js` - Returns 400/403 on errors
- [ ] `replace-fixtures-bulk.js` - Returns 400/403 on errors
- [ ] `get-fixtures.js` - Returns 404 on not found
- [ ] `set-fixture-result.js` - Returns 404/403 on errors
- [ ] `get-calculated-fixtures.js` - Returns 404 on not found

### Player Actions
- [ ] `player-dashboard.js` - Uses 200 pattern ✅
- [ ] `get-competition-standings.js` - Returns 404/403 on failures
- [ ] `set-pick.js` - Returns 400/403 on validation/auth errors
- [ ] `get-current-pick.js` - Returns 404 on not found
- [ ] `unselect-pick.js` - Returns 404/403 on errors
- [ ] `get-allowed-teams.js` - Returns 404/403 on failures
- [ ] `calculate-results.js` - Returns 404/403 on failures

### Team Management
- [ ] `team-lists.js` - Uses 200 pattern ✅
- [ ] `get-teams.js` - Uses 200 pattern ✅

## Migration Priority

### High Priority (Crash Risk)
1. **Authentication routes** - Login/register failures are common
2. **Competition joining** - 404s on invalid codes cause crashes
3. **Player actions** - Pick setting/getting errors are frequent

### Medium Priority
1. **Competition management** - Admin-only, less frequent usage
2. **Round/fixture management** - Admin-only operations

### Low Priority  
1. **Team management** - Already uses correct pattern
2. **Dashboard routes** - Already uses correct pattern

## Migration Checklist Per Route

For each API route, complete the following:

### Backend Changes
- [ ] Replace `res.status(4xx/5xx)` with `res.status(200)`
- [ ] Ensure all error responses include `return_code` and `message`
- [ ] Update route documentation header with new response format
- [ ] Test all error scenarios return 200 with proper `return_code`

### Frontend Changes  
- [ ] Remove any `.catch()` handlers that expect HTTP errors
- [ ] Update all response handling to check `response.data.return_code`
- [ ] Add proper error message display for non-SUCCESS responses
- [ ] Test error scenarios show user-friendly messages

### Testing
- [ ] Test success scenarios work unchanged
- [ ] Test all error scenarios return proper error messages
- [ ] Verify no unhandled promise rejections in console
- [ ] Test rapid navigation doesn't cause crashes

## Notes

- **New APIs**: All new APIs MUST follow the 200 + `return_code` pattern (see CLAUDE.md)
- **Backward Compatibility**: Some APIs may need to be updated in frontend and backend simultaneously
- **Error Messages**: Maintain existing error messages for consistency
- **Testing**: Prioritize testing error scenarios as these are most likely to cause crashes

## Tracking

Last Updated: 2025-01-15
Total Routes: ~25
Migrated: 4 ✅  
Remaining: ~21