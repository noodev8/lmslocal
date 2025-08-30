# Database Pool Refactor Template

## Completed Routes
✅ `set-pick.js` - Refactored to use centralized database  
✅ `create-competition.js` - Refactored to use centralized database  
✅ `login.js` - Refactored to use centralized database  
✅ `register.js` - Already uses centralized database  
✅ `add-fixtures-bulk.js` - Uses centralized database pool for transactions  
✅ `calculate-results.js` - Already uses centralized database  
✅ `create-round.js` - Already uses centralized database  
✅ `get-fixtures.js` - Already uses centralized database  
✅ `get-rounds.js` - Already uses centralized database  
✅ `get-teams.js` - Already uses centralized database  
✅ `mycompetitions.js` - Already uses centralized database  
✅ `replace-fixtures-bulk.js` - Already uses centralized database  
✅ `set-fixture-result.js` - Refactored to use centralized database  
✅ `team-lists.js` - Already uses centralized database  
✅ `update-round.js` - Already uses centralized database  
✅ `join-competition.js` - Refactored to use centralized database  
✅ `player-login.js` - Refactored to use centralized database  
✅ `get-player-current-round.js` - Refactored to use centralized database  
✅ `register-and-join-competition.js` - Refactored to use centralized database
✅ `forgot-password.js` - Refactored to use centralized database
✅ `reset-password.js` - Refactored to use centralized database
✅ `join-by-access-code.js` - Refactored to use centralized database (2025-08-28)
✅ `join-competition-by-slug.js` - Refactored to use centralized database (2025-08-28)  
✅ `update-profile.js` - Refactored to use centralized database (2025-08-28)
✅ `verify-email.js` - Refactored to use centralized database (2025-08-28)
✅ `resend-verification.js` - Refactored to use centralized database (2025-08-28)
✅ `lock-unlock-competition.js` - Refactored to use centralized database (2025-08-28)
✅ `validate-access-code.js` - Refactored to use centralized database (2025-08-28)

## New Routes Added (Already using centralized database)
✅ `get-allowed-teams.js` - Created with centralized database (2025-08-28)
✅ `unselect-pick.js` - Created with centralized database (2025-08-28)  
✅ `get-current-pick.js` - Created with centralized database (2025-08-28)

## Removed Unused Routes
🗑️ `add-fixture.js` - Deleted (superseded by bulk operations)  
🗑️ `modify-fixture.js` - Deleted (superseded by bulk operations)  
🗑️ `delete-fixture.js` - Deleted (superseded by bulk operations)
🗑️ `player-login-general.js` - Deleted (unused legacy route, 2025-08-28)
🗑️ `verify-player-token.js` - Deleted (unused legacy route, 2025-08-28)
🗑️ `get-competition-by-slug.js` - Deleted (unused legacy route, 2025-08-28)

## Remaining Routes (0 total)
✅ **ALL ROUTES COMPLETED!** No routes remaining to refactor.

## Refactor Steps for Each Route

### 1. Replace Pool Import and Declaration
**Find:**
```javascript
const { Pool } = require('pg');
const router = express.Router();

// Database connection
const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});
```

**Replace with:**
```javascript
const { query } = require('../database');
const router = express.Router();
```

### 2. Replace All Pool Usage
**Find all instances of:**
```javascript
pool.query(
await pool.query(
```

**Replace with:**
```javascript
query(
await query(
```

### 3. For Transaction-Heavy Routes
If a route has multiple related database operations, consider using the `transaction` helper:

**Replace:**
```javascript
const client = await pool.connect();
try {
  await client.query('BEGIN');
  const result1 = await client.query('INSERT INTO...');
  const result2 = await client.query('UPDATE...');
  await client.query('COMMIT');
} catch (error) {
  await client.query('ROLLBACK');
  throw error;
} finally {
  client.release();
}
```

**With:**
```javascript
const { transaction } = require('../database');

const results = await transaction([
  { text: 'INSERT INTO...', params: [...] },
  { text: 'UPDATE...', params: [...] }
]);
```

## Expected Impact
- **Before**: 37 routes × 20 connections each = **740 potential connections** (3 routes deleted)
- **After**: 1 shared pool × 20 connections = **20 total connections**  
- **Progress**: 34/34 routes completed (100% DONE! 🎉)
- **Memory savings**: 100% reduction in pool overhead (720 connections eliminated)
- **Maintenance**: Single point of database configuration

## Testing Priority
Test these high-impact routes first:
1. `register.js` - Core authentication
2. `get-fixtures.js` - High usage during active rounds  
3. `calculate-results.js` - Critical for competition logic
4. `player-login.js` - Player authentication flow