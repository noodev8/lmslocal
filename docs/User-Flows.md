# LMSLocal User Flows

## Admin/Organizer Flow

### Initial Setup Journey
```
Landing Page
    ↓
Sign Up (email only)
    ↓
Email Verification
    ↓
Setup Wizard:
    Step 1: Competition Basics
        - Competition name (e.g., "The Red Lion LMS")
        - Optional logo upload
    
    Step 2: Team List Selection
        - EPL 2025/26 (default)
        - Custom team list option
        - Choose start week (for EPL)
    
    Step 3: Rules Configuration
        - "No team twice" toggle (default: ON)
        - Number of lives (default: 1)
        - Lock time settings
    
    Step 4: Payment
        - Check player count
        - If ≤5 players: FREE activation
        - If >5 players: Choose plan (£39/comp or £19/month)
        - Stripe payment processing
    ↓
Competition Dashboard (active)
```

### Ongoing Management Flow
```
Admin Dashboard
    ↓
[Select Competition from list]
    ↓
Competition Management Hub
    ├── Player Management
    │   ├── Invite Players
    │   │   ├── Copy shareable link
    │   │   ├── Generate join code
    │   │   ├── Bulk email invites
    │   │   └── Pre-add contacts
    │   ├── Add Guest Players (name only)
    │   ├── View Player List
    │   │   ├── Status (alive/eliminated)
    │   │   ├── Lives remaining
    │   │   ├── Last pick made
    │   │   └── Manual payment status notes
    │   └── Player Actions (eliminate/restore)
    │
    ├── Round Management
    │   ├── Current Round View
    │   │   ├── Fixtures list
    │   │   ├── Lock countdown timer
    │   │   ├── Player pick status
    │   │   └── Pick visibility (hidden until lock)
    │   ├── Manual Result Entry
    │   │   ├── Set match outcomes
    │   │   ├── Process eliminations
    │   │   └── Review elimination list
    │   └── Round History
    │
    ├── Admin Override Center
    │   ├── Adjust Match Results
    │   │   ├── Change result with mandatory audit note
    │   │   └── Auto-recalculate eliminations
    │   ├── Player Management Overrides
    │   │   ├── Eliminate player manually
    │   │   ├── Restore eliminated player
    │   │   └── Add/remove lives
    │   ├── Round Management
    │   │   ├── Void entire round
    │   │   ├── Void specific fixtures
    │   │   └── Replay round
    │   └── Kiosk Entry (pick on behalf of player)
    │
    └── Competition Settings
        ├── Edit competition details
        ├── Modify rules/settings
        ├── Clone & Restart flow
        ├── View comprehensive audit log
        └── Export competition data
```

## Player Flow

### Join Competition Journey
```
Receive Invite (link or code)
    ↓
Landing Page
    ↓
[Branch: Existing User vs New User]

New User Path:
    Email Entry → Email Verification → Join Competition

Existing User Path:
    Login → Join Competition Automatically
    ↓
Competition Overview
    ├── Competition rules and format
    ├── Current round status
    ├── Player leaderboard
    ├── Payment information (if applicable)
    └── Join confirmation
    ↓
Added to Player's Multi-Competition Dashboard
```

### Weekly Gameplay Flow
```
Player Dashboard (Multi-Competition Hub)
    ├── Active Competitions List:
    │   ├── "Red Lion LMS" (Round 3, alive, pick needed)
    │   ├── "Office League" (Round 5, eliminated)
    │   ├── "Crown & Anchor Cup" (Round 1, alive)
    │   └── + Join New Competition (enter code/follow link)
    ├── Quick Actions:
    │   ├── View competitions needing picks
    │   ├── Check upcoming deadlines
    │   └── Recent results across all competitions
    └── Account Settings
    ↓
Select Competition
    ↓
Competition Home
    ├── Current Status Summary
    │   ├── Lives remaining
    │   ├── Current position
    │   ├── Round deadline
    │   └── Lock status
    │
    ├── Make Pick (Current Round)
    │   ├── View available fixtures
    │   ├── See unavailable teams (previously picked)
    │   ├── Select team to win
    │   ├── Confirm pick
    │   └── Edit pick (until lock)
    │
    ├── Round Information
    │   ├── Lock countdown timer
    │   ├── Other players' pick status (not picks themselves)
    │   ├── Post-lock: view all picks
    │   └── Match results when available
    │
    ├── Competition Status
    │   ├── Live leaderboard (remaining players)
    │   ├── Eliminated players list
    │   ├── Personal pick history
    │   └── Personal results history
    │
    └── Competition Details
        ├── Rules reminder
        ├── Prize/payment information
        └── Organizer contact
```

### Pick Lifecycle States
```
Round Opens
    ↓
Player Makes Pick
    ├── Team Selection
    ├── Confirmation
    └── Success/Edit Options
    ↓
[Pick Status: Submitted, Editable]
    ↓
Lock Triggered (3 conditions, priority order):
    1. All players have picked
    2. Admin-set lock time reached
    3. 1 hour before first kickoff
    ↓
[Pick Status: Locked, Visible to All]
    ↓
Fixtures Complete → Results Posted
    ↓
Outcome Determined:
    ├── Win: Continue to next round
    ├── Draw/Loss: 
    │   ├── Lives > 0: Lose life, continue
    │   └── Lives = 0: Eliminated
    └── Missed Pick:
        ├── Lives > 0: Lose life, continue  
        └── Lives = 0: Eliminated
```

## Key Decision Points & System Logic

### Lock Mechanism Priority
```
Check Lock Conditions (in order):
1. All players submitted picks? → LOCK + Show all picks
2. Admin lock time reached? → LOCK + Show all picks  
3. 1hr before earliest kickoff? → LOCK + Show all picks
4. Otherwise → Continue accepting/editing picks
```

### Round Completion Logic
```
All Fixtures Complete → Process Results:
├── Calculate player outcomes (win/lose life/eliminate)
├── Update player statuses
├── Check competition end conditions:
│   ├── 1 player remaining → WINNER (competition ends)
│   ├── Multiple players → Prepare next round
│   ├── 0 players remaining → DRAW (admin decision)
│   └── Postponed fixtures → Await admin action
```

### Payment Flow Decision Tree
```
Competition Setup → Count Players:
├── ≤ 5 Players → Activate FREE
├── > 5 Players → Require Payment:
│   ├── First-time organizer → Force payment selection
│   ├── Existing subscription → Check subscription status
│   │   ├── Active monthly → Allow creation
│   │   └── Expired → Require payment
│   └── Payment options:
│       ├── One-time: £39 per competition
│       └── Subscription: £19/month (unlimited competitions)
```

### Edge Case Handling

**Postponed/Cancelled Fixtures:**
```
Fixture Status Change Detected → Admin Notification:
├── Options Available:
│   ├── Void affected picks (refund lives if applicable)
│   ├── Void entire round
│   ├── Manual result entry
│   └── Wait for rescheduled fixture
├── All changes logged with audit trail
└── Players notified of decision
```

**Late Changes & Technical Issues:**
```
System Issues During Pick Window:
├── Automatic grace period extension
├── Admin notification with override options
├── Manual pick entry capability (kiosk mode)
└── Audit log of all interventions
```

**Guest Player Management:**
```
Guest Player Created → Admin Options:
├── Send invite link (player can claim account)
├── Make picks on behalf (kiosk mode with audit)
├── Convert to full account (email verification)
└── Remove from competition
```

## State Management

### Player States
- **Active**: In competition, can make picks
- **Eliminated**: Out of competition, view-only access
- **Pending**: Invited but not yet joined
- **Guest**: Added by admin, limited functionality

### Competition States
- **Setup**: Being configured by admin
- **Active**: Players can join and make picks
- **Locked**: Current round locked, awaiting results
- **Complete**: Winner determined or declared draw
- **Paused**: Admin intervention required

### Round States
- **Open**: Players can make/edit picks
- **Locked**: Picks finalized, matches ongoing
- **Complete**: All results entered, eliminations processed
- **Void**: Round cancelled, picks refunded

---

*These flows provide the foundation for UI/UX design and backend API structure.*