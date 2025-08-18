# Managed Player Design

## Overview

Managed players are users created and controlled by competition organizers for customers who cannot or will not create their own accounts. This feature is essential for local pub competitions where some regular players don't have smartphones or email addresses.

## Key Design Principles

### 1. **Competition-Scoped Only**
- Managed players exist ONLY within the competition they were created for
- No cross-competition complexity or identity merging
- Simple, isolated data model

### 2. **Full Organizer Control**
- Organizer creates the player with just a display name
- Organizer enters all picks on their behalf
- Complete audit trail of all actions

### 3. **No Authentication Capability**
- Managed players cannot log in (no email/auth tokens)
- Prevents identity confusion
- Simplifies security model

## Database Implementation

### Schema Changes

#### `app_user` Table
```sql
is_managed BOOLEAN DEFAULT false       -- Replaces is_anonymous
created_by_user_id INTEGER             -- Which organizer created them
```
- **is_managed=true**: Cannot log in, organizer-controlled
- **is_managed=false**: Regular user with authentication

#### `competition_user` Table
```sql
role VARCHAR(50)                       -- Now includes 'managed_player'
managed_by_user_id INTEGER             -- Organizer responsible for this player
```

#### `pick` Table
```sql
entered_by_user_id INTEGER             -- NULL=self, otherwise who entered the pick
```
- Audit trail for picks made on behalf of players

## User Flows

### Creating a Managed Player

```
Organizer Dashboard → Add Player
├── Option 1: Invite by Email (regular user)
└── Option 2: Create Managed Player
    ├── Enter Display Name (e.g., "Old Bill")
    ├── Optional: Payment notes
    └── Creates user with is_managed=true
```

### Making Picks for Managed Players

```
Organizer Dashboard → Player List
├── Regular Players
│   └── Status indicators only
└── Managed Players (marked with icon)
    └── [Make Pick] button
        ├── Select team for player
        ├── Confirm pick
        └── Audit: entered_by_user_id recorded
```

### Weekly Workflow in Pub

1. **Friday Night**: Old Bill comes to pub
2. **Conversation**: "Arsenal this week, Bill?" "Aye, Arsenal"
3. **Organizer Action**: Makes pick for Bill via dashboard
4. **Audit Trail**: System records organizer made pick
5. **Results**: Bill checks paper printout on wall

## Business Rules

### Managed Player Restrictions
- **Cannot log in** - no auth tokens generated
- **Cannot join other competitions** - competition-scoped only
- **Cannot change own picks** - organizer-only control
- **Cannot be converted to regular user** - prevents complexity

### Organizer Capabilities
- **Create managed players** - name only required
- **Make/edit picks** - full control until lock
- **Track payments** - manual notes field
- **View audit trail** - all actions logged

### Competition Rules
- **Managed players count toward player limits** - for billing
- **Same game rules apply** - lives, eliminations, etc.
- **Appear in leaderboards** - with (M) indicator
- **Can win competitions** - treated as regular players for game logic

## UI/UX Considerations

### Visual Indicators
```
Player List:
John Smith ✓         [Regular user]
Mary Jones ✓         [Regular user]
Old Bill (M) ✗       [Managed] → [Make Pick]
```

### Organizer Dashboard
```
Quick Actions:
├── Pending Picks (3)
│   ├── Old Bill (M) - No pick yet [Make Pick]
│   ├── Frank (M) - No pick yet [Make Pick]
│   └── Alice - No pick yet (reminder sent)
```

### Audit Display
```
Pick History:
- Arsenal picked by Old Bill at 14:30
- Liverpool picked by Frank at 14:35 (entered by admin)
- Chelsea picked by Mary at 15:00
```

## Technical Implementation

### API Endpoints

```javascript
// Create managed player
POST /api/competitions/:id/managed-players
{
  "display_name": "Old Bill",
  "payment_notes": "Paid cash £5"
}

// Make pick for managed player
POST /api/competitions/:id/picks/managed
{
  "user_id": 123,  // Managed player ID
  "team_id": 456,
  "round_id": 789
}
```

### Security Checks
```javascript
// Middleware for managed player actions
function canManagePlayers(req, res, next) {
  // Verify user is organizer of competition
  // Verify target is managed player in same competition
  // Log all actions to audit trail
}
```

### Database Queries
```sql
-- Get managed players for competition
SELECT u.*, cu.payment_status, cu.payment_notes
FROM app_user u
JOIN competition_user cu ON u.id = cu.user_id
WHERE cu.competition_id = ? 
  AND cu.role = 'managed_player'
  AND u.is_managed = true;

-- Audit trail for picks
SELECT p.*, 
  player.display_name as player_name,
  organizer.display_name as entered_by_name
FROM pick p
JOIN app_user player ON p.user_id = player.id
LEFT JOIN app_user organizer ON p.entered_by_user_id = organizer.id
WHERE p.round_id = ?;
```

## Benefits vs Complexity Analysis

### Benefits ✅
- **Solves real pub problem** - customers without tech
- **Simple for organizers** - just enter names
- **Clear audit trail** - no disputes about picks
- **No migration complexity** - managed players stay managed
- **Competition-scoped** - no cross-competition issues

### Complexity Added ⚠️
- **Two user types** - regular vs managed
- **Additional UI states** - "Make Pick" buttons
- **Audit requirements** - track who entered what
- **Role management** - new 'managed_player' role

### Verdict: Worth It ✅
The complexity is minimal and well-contained. This feature directly addresses a core use case for pub competitions where tech adoption varies among customers.

## Migration Path

### From Guest Mode Design
1. Change `is_anonymous` → `is_managed`
2. Add `created_by_user_id` to track creator
3. Add `entered_by_user_id` to picks table
4. Update role enums to include 'managed_player'

### No Data Migration Needed
- Fresh start with new design
- No existing users to migrate
- Clean implementation from day one

## Future Considerations

### Potential Enhancements (Not MVP)
- Bulk creation of managed players
- Print-friendly pick sheets for managed players
- SMS notifications to managed players (if phone provided)
- Convert managed to regular (complex - avoid if possible)

### What We're NOT Building
- Cross-competition managed players
- Managed player self-service
- Account merging/linking
- Email invites for managed players

---

*This managed player design provides the flexibility organizers need while maintaining system simplicity and data integrity.*