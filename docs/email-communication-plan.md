# Email Communication Strategy - LMSLocal

## Overview

Email communications are a critical engagement tool for LMSLocal. Users have all information available in the app, but emails serve as strategic prompts to maintain engagement, prevent missed picks, and keep competitions active. This document outlines our complete email strategy, technical requirements, and implementation roadmap.

**Core Principle**: Emails should be valuable prompts to action, not noise. Every email must have a clear purpose and respect user attention.

---

## Email Types

### 1. Welcome Email
**Priority**: Medium
**Status**: 🔴 Not Implemented

**Purpose**: Orient new players and set expectations for the competition experience.

**Timing**: 24 hours after joining (feels thoughtful vs. automated)

**Content**:
- Competition format explained in plain English
- How to make first pick
- Deadline for Round 1
- Link to competition dashboard
- Brief intro from organizer (if available)

**Technical Requirements**:
- Trigger on player join + 24hr delay
- One email per competition (don't consolidate)
- Exception: If user joins multiple competitions within 1 hour, batch into single email
- Template variables: competition_name, organizer_name, first_round_deadline, competition_rules

**Open Questions**:
- [x] ~~Should this include a "Meet your competition" section showing other players?~~ **NO** - Not enough players in early competitions, constantly changing
- [x] ~~Include competition prize information if available?~~ **NICE TO HAVE** - Defer to later phase, needs organizer UI to enter/manage prize info

---

### 2. Pick Reminder Emails
**Priority**: 🔥 CRITICAL - Highest Value
**Status**: 🔴 Not Implemented

**Purpose**: Prevent missed picks (the #1 user pain point). Directly drives engagement and prevents player elimination due to inaction.

**Timing Strategy**:
1. **48 hours before lock**: "Picks are open for Round X" (casual, no pressure)
2. **24 hours before lock**: "Don't forget your pick!" (moderate urgency)
3. **6 hours before lock**: "FINAL REMINDER - Pick now!" (urgent)

**Smart Logic**:
- Only send if pick not yet made
- Check user preferences before sending
- Multi-competition consolidation: If user has picks due within 24hrs across multiple competitions, consolidate into digest
- Include teams already used (strategy helper)
- Direct "Quick Pick" link with deep linking

**Content Elements**:
- Round number and competition name
- Time remaining until lock
- **Fixtures for this round** (key information - what matches are available)
- **Smart team display**: Show available teams if fewer than used teams, otherwise show teams already used (whichever list is shorter)
- One-click "Make Your Pick" button
- Current standings (X players remaining)

**Personalization**:
- Subject line: "[Organizer Name] ([Competition Name]): Your pick is due in [X hours]"
- Email body signed by organizer name
- Custom organizer message (optional field)

**Technical Requirements**:
- Cron job checks lock times every hour
- Query for users who haven't picked yet
- Queue emails based on timing rules
- Consolidation engine for multi-competition users
- Track which reminder tier triggered pick completion

**Success Metrics**:
- Open rate: 40%+ target
- Click-through rate: 15%+ target
- Pick completion after email: 30%+ reduction in missed picks
- Optimal send time analysis

**Open Questions**:
- [x] ~~Should we use push notifications instead/additionally for mobile users?~~ **LATER PHASE** - No mobile app yet, will implement with Flutter version
- [x] ~~Allow organizers to customize reminder timing?~~ **NO** - Keep standard timing (48hr, 24hr, 6hr) for consistency
- [x] ~~Show opponent picks that are already locked?~~ **NO** - Don't reveal other players' picks

---

### 3. Results Notification
**Priority**: High
**Status**: 🔴 Not Implemented

**Purpose**: Create momentum, drama, and keep eliminated players engaged as spectators.

**Timing**: When round results are processed/finalized

**Two Completely Different Experiences**:

#### For Survivors:
- "🎉 You're through to Round X!"
- Players remaining: "Only 12 left standing..."
- Show who got eliminated (drama/social element)
- Tease next round: "Round X opens [date]"
- Current standings/leaderboard position
- Build tension as field narrows

#### For Eliminated Players:
- "Tough break! Here's how Round X ended..."
- Show what happened to their pick
- Keep them engaged: "Follow the competition as a spectator"
- Link to leaderboard and remaining players
- "See who wins and settles the bragging rights"
- Invitation to join next competition

**Multi-Competition Handling**:
- **Always consolidate** results across competitions
- Digest format: "Your results from 3 competitions"
- Group by outcome: Survived | Eliminated | Still in Progress

**Content Elements**:
- Round result (win/draw/loss)
- Status change (advanced, eliminated, life lost)
- Player count (X eliminated, Y remaining)
- Leaderboard snapshot
- Next round timeline
- Social elements (dramatic eliminations, close calls)

**Technical Requirements**:
- Trigger on round completion
- Consolidation engine for multi-competition users
- Different templates for survivors vs eliminated
- Track engagement patterns (do eliminated users open these?)

**Open Questions**:
- [x] ~~Include full round recap (all fixtures) or just user's result?~~ **USER'S RESULT ONLY** - Keep focused on their outcome
- [x] ~~Should eliminated players get results for subsequent rounds?~~ **NO** - Stop sending once eliminated
- [x] ~~Gamification: Badges/achievements to include?~~ **LATER PHASE** - Defer until gamification system exists

---

## Multi-Competition Strategy

### The Challenge
Sarah is in 5 competitions. Without smart consolidation, she could receive 15+ emails per week, leading to fatigue and unsubscribes.

### Consolidation Rules

| Email Type | Consolidation Strategy |
|------------|----------------------|
| Welcome | **Never consolidate** - Each competition needs full context |
| Pick Reminders | **Consolidate if locks within 24hrs** - One email, multiple competitions |
| Results | **Always consolidate** - Digest format showing all results |

### Consolidated Email Format Example

```
Subject: Pick reminders for 3 competitions

Hi Sarah,

You have picks due soon across multiple competitions:

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🏆 The Crown Pub LMS - Round 5
   Organized by Dave
   ⏰ Picks lock in 18 hours
   🔗 Make your pick →

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🏆 Office League 2025 - Round 3
   Organized by Mike from Accounting
   ⏰ Picks lock in 22 hours
   🔗 Make your pick →

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🏆 Saturday Social - Round 12
   Organized by Jenny
   ⏰ Picks lock in 20 hours
   🔗 Make your pick →

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Don't miss your picks!

Manage email preferences | Unsubscribe
```

---

## Email Preference Management

### Database Structure Required

```sql
CREATE TABLE email_preferences (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES app_user(id),
    competition_id INTEGER REFERENCES competitions(id), -- NULL = global preference
    email_type VARCHAR(50), -- 'welcome', 'pick_reminder', 'results', 'fixtures', 'announcements', 'all'
    enabled BOOLEAN DEFAULT TRUE,
    frequency VARCHAR(20), -- 'all', 'digest', 'critical_only', 'none'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, competition_id, email_type)
);

CREATE INDEX idx_email_prefs_user ON email_preferences(user_id);
CREATE INDEX idx_email_prefs_competition ON email_preferences(competition_id);
```

### Granularity Levels

1. **Global Level**: "Unsubscribe from all LMSLocal emails"
   - Nuclear option - stops everything except critical account emails

2. **Email Type Level**: "No more fixture notifications"
   - Applies across all competitions

3. **Per Competition Level**: "Mute Crown Pub LMS"
   - Stops all emails for specific competition

4. **Frequency Level**: "Only critical reminders (6hr pick warnings)"
   - Reduces volume but keeps essential communications

### Special Handling: Pick Reminders

Pick reminders should default to **ON** and be harder to disable (they're critical to user success).

**Confirmation flow**:
```
User: "Disable pick reminders"
System: "⚠️ Are you sure? You'll likely miss picks and lose lives.
         We recommend keeping at least 6-hour warnings enabled."

         [ Keep All Reminders ]  [ Only 6hr Critical ]  [ Disable All ]
```

### Unsubscribe Footer

Every email must include:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Email Preferences:
• Unsubscribe from [Competition Name]
• Unsubscribe from [Email Type]
• Manage all preferences
• Unsubscribe from everything

This email was sent to sarah@example.com
```

Each option is a one-click link (no login required for unsubscribe).

---

## Engagement Tracking & Analytics

### Database Structure Required

**Important Design Rules**:
- **No foreign key constraints** - Keep tables flexible during development
- **Use TIMESTAMP WITH TIME ZONE** - Proper timezone handling for global users

```sql
CREATE TABLE email_tracking (
    id SERIAL PRIMARY KEY,
    email_id VARCHAR(255) UNIQUE NOT NULL, -- Our internal tracking ID (generated when queuing email)
    user_id INTEGER NOT NULL,
    competition_id INTEGER,
    email_type VARCHAR(50) NOT NULL,
    subject VARCHAR(255) NOT NULL,
    sent_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    opened_at TIMESTAMP WITH TIME ZONE,
    clicked_at TIMESTAMP WITH TIME ZONE,
    click_action VARCHAR(100), -- 'make_pick', 'view_results', 'manage_preferences', etc.
    unsubscribed_at TIMESTAMP WITH TIME ZONE,
    bounce_type VARCHAR(50), -- 'hard', 'soft', 'none'
    resend_message_id VARCHAR(255), -- Resend's unique message ID for webhook correlation
    resend_event_data JSONB -- Store raw Resend webhook data for debugging
);

CREATE INDEX idx_email_tracking_user ON email_tracking(user_id);
CREATE INDEX idx_email_tracking_competition ON email_tracking(competition_id);
CREATE INDEX idx_email_tracking_type ON email_tracking(email_type);
CREATE INDEX idx_email_tracking_sent ON email_tracking(sent_at);
CREATE INDEX idx_email_tracking_opened ON email_tracking(opened_at);
CREATE INDEX idx_email_tracking_resend_id ON email_tracking(resend_message_id);

COMMENT ON TABLE email_tracking IS 'Comprehensive email engagement tracking and analytics';
COMMENT ON COLUMN email_tracking.email_id IS 'Our internal unique identifier (generated at queue time, embedded in links and headers)';
COMMENT ON COLUMN email_tracking.resend_message_id IS 'Resend service message ID for webhook correlation';
COMMENT ON COLUMN email_tracking.click_action IS 'Which button/link was clicked for conversion tracking';
```

**How `email_id` is Generated**:
```javascript
// Generated when queuing email
const emailTrackingId = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
// Example: "1728394829_k3j2h8f9a"

// Or use uuid library:
const { v4: uuidv4 } = require('uuid');
const emailTrackingId = uuidv4(); // "550e8400-e29b-41d4-a716-446655440000"

// Store in template_data and pass to Resend in headers
const templateData = {
  // ... other data ...
  email_tracking_id: emailTrackingId
};
```

### Metrics to Track

#### Email Performance Metrics
- **Open rate** by email type → which emails are valuable?
- **Click-through rate** → are CTAs effective?
- **Time to open** → optimal send times?
- **Time to click** → urgency effectiveness?
- **Unsubscribe rate** per campaign → what annoys users?

#### Business Impact Metrics
- **Pick completion rate** after reminder → ROI of email
- **Retention rate** (email recipients vs non-recipients)
- **Engagement score** per user → who's at risk of churning?
- **Competition completion rate** (correlation with email engagement)

#### User Behavior Patterns
- **Email fatigue indicators**:
  - User hasn't opened last 5 emails → switch to digest mode
  - User hasn't clicked last 10 emails → prompt preference adjustment
- **Optimal send time analysis**: When do users engage most?
- **Device detection**: Mobile vs desktop opens (for formatting optimization)

### Actionable Insights

1. **Low open rates on fixture notifications** → Consider removing or making opt-in
2. **High CTR on 6hr reminders** → Focus energy on urgent reminders
3. **User stopped opening emails** → Auto-switch to weekly digest
4. **Competition has low email engagement** → Surface to organizer
5. **Eliminated players stop opening** → Adjust content strategy

### Resend Integration

Resend provides built-in tracking via webhooks:
- `email.sent`
- `email.delivered`
- `email.opened`
- `email.clicked`
- `email.bounced`
- `email.complained` (spam reports)

**Implementation**:
- Set up webhook endpoint: `/api/resend-webhooks`
- Parse events and update `email_tracking` table
- Use UTM parameters for granular action tracking

---

## Anti-Spam Strategy

### Frequency Caps

**Per Competition Rules**:
- Max 1 email per competition per day (except critical pick reminders)
- Max 3 emails total per day per user (across all competitions)
- Organizer announcements: Max 1 per week per competition

**Time Restrictions**:
- No emails between 10pm - 8am local time (if timezone available, else UTC)
- Batch emails sent within 1-hour windows (spread server load)

**Grace Periods**:
- Don't send results email within 2 hours of pick reminder
- Delay fixture notifications by 15 minutes (in case organizer adds more)
- Space organizer announcements by minimum 24 hours

### Email Fatigue Detection

**Automatic Actions**:
```
IF user_opened_last_5_emails = 0 THEN
    auto_switch_to_digest_mode
    send_preference_check_email
END IF

IF user_clicked_last_10_emails = 0 THEN
    prompt_to_adjust_preferences
    flag_for_review
END IF

IF days_since_last_interaction > 14 THEN
    reduce_to_critical_only
    send_reengagement_email
END IF
```

**Proactive Health Monitoring**:
- Track "time to unsubscribe" by email type
- A/B test send times to optimize engagement
- Monitor bounce rates and clean lists
- Identify problem email types and iterate

### Smart Sending Logic

```javascript
// Pseudo-code for send decision
function shouldSendEmail(user, emailType, competition) {
    // Check global preferences
    if (user.unsubscribed_all) return false;

    // Check email type preference
    if (!user.prefers(emailType, competition)) return false;

    // Check frequency caps
    if (user.emailsSentToday >= 3) return false;
    if (competition.emailsSentToday >= 1 && emailType !== 'pick_reminder') return false;

    // Check time window
    if (isQuietHours(user.timezone)) return false;

    // Check fatigue signals
    if (user.emailFatigueScore > 0.7) return false;

    // Check if should consolidate
    if (shouldConsolidate(user, emailType)) {
        queueForConsolidation(user, emailType, competition);
        return false; // Will send consolidated version later
    }

    return true;
}
```

---

## Technical Architecture

### New Database Tables

1. **`email_preferences`** - User email settings and granular controls
2. **`email_queue`** - Scheduled and pending emails with priority
3. **`email_tracking`** - Comprehensive engagement metrics and analytics
4. **`email_templates`** - Reusable templates with variable substitution
5. **`email_consolidation`** - Temporary storage for emails pending consolidation

### New Backend Services

#### 1. Email Scheduler Service (Cron)
**Responsibility**: Identify events that trigger emails and queue them

**Runs**: Every 15 minutes

**Tasks**:
- Find rounds with locks in 48hrs, 24hrs, 6hrs
- Find users who haven't picked yet
- Find rounds with new results
- Find fixtures just published
- Queue appropriate emails

**Route**: Background service (not HTTP endpoint)

#### 2. Queue Processor Service (Cron)
**Responsibility**: Process queued emails and send via Resend

**Runs**: Every 5 minutes

**Tasks**:
- Fetch pending emails from queue
- Check user preferences and frequency caps
- Apply consolidation logic
- Send via Resend API
- Update tracking table
- Handle retries and failures

**Route**: Background service (not HTTP endpoint)

#### 3. Consolidation Service
**Responsibility**: Batch multiple emails for same user

**Logic**:
- Hold emails for 1 hour after first queued
- Collect all emails for same user + type
- Generate consolidated email
- Send once with all information

**Route**: Part of Queue Processor

#### 4. Preference Service
**Responsibility**: Centralized logic for preference checking

**Routes**:
- `POST /update-email-preferences` - Update user preferences
- `POST /get-email-preferences` - Retrieve user settings
- Internal: `checkUserPreference(userId, emailType, competitionId)`

#### 5. Tracking Service
**Responsibility**: Log and analyze email engagement

**Routes**:
- `POST /api/resend-webhooks` - Receive Resend events
- `POST /email-analytics` - Query engagement metrics
- `POST /user-engagement-score` - Calculate user engagement health

#### 6. Template Service
**Responsibility**: Render email templates with dynamic content

**Features**:
- Variable substitution
- Conditional content blocks
- Multi-language support (future)
- Preview generation

**Route**: Internal service used by Queue Processor

### Email Queue Structure

**Design Rules**:
- **No foreign key constraints** - Keep flexible during development
- **Use TIMESTAMP WITH TIME ZONE** - Proper timezone handling
- **Retry logic built-in** - Max 3 attempts before marking failed

```sql
CREATE TABLE email_queue (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    competition_id INTEGER,
    email_type VARCHAR(50) NOT NULL, -- 'welcome', 'pick_reminder', 'results'
    scheduled_send_at TIMESTAMP WITH TIME ZONE NOT NULL, -- When this email should be sent
    template_data JSONB NOT NULL, -- Dynamic content for email template (captured at queue time)
    status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'processing', 'sent', 'failed', 'cancelled'
    attempts INTEGER DEFAULT 0, -- Number of send attempts (max 3)
    last_attempt_at TIMESTAMP WITH TIME ZONE, -- When last send attempt was made
    error_message TEXT, -- Error details from failed send attempts
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    sent_at TIMESTAMP WITH TIME ZONE -- When email was successfully sent
);

CREATE INDEX idx_email_queue_status ON email_queue(status);
CREATE INDEX idx_email_queue_scheduled ON email_queue(scheduled_send_at);
CREATE INDEX idx_email_queue_user ON email_queue(user_id);
CREATE INDEX idx_email_queue_competition ON email_queue(competition_id);
CREATE INDEX idx_email_queue_type ON email_queue(email_type);
CREATE INDEX idx_email_queue_attempts ON email_queue(attempts) WHERE status = 'pending';

-- Composite index for queue processor (most common query)
CREATE INDEX idx_email_queue_processing ON email_queue(status, scheduled_send_at, attempts)
  WHERE status = 'pending';

COMMENT ON TABLE email_queue IS 'Queue for scheduled and pending emails with retry logic';
COMMENT ON COLUMN email_queue.user_id IS 'User who will receive this email';
COMMENT ON COLUMN email_queue.competition_id IS 'Related competition (NULL for non-competition emails)';
COMMENT ON COLUMN email_queue.email_type IS 'Type of email: welcome, pick_reminder, results';
COMMENT ON COLUMN email_queue.scheduled_send_at IS 'When this email should be sent (emails processed when NOW() >= this time)';
COMMENT ON COLUMN email_queue.template_data IS 'JSON object with all data needed to render email template (captured at queue time to preserve state)';
COMMENT ON COLUMN email_queue.status IS 'pending=waiting, processing=sending, sent=delivered, failed=max retries exceeded, cancelled=manually cancelled';
COMMENT ON COLUMN email_queue.attempts IS 'Number of send attempts made (max 3 before marking as failed)';
COMMENT ON COLUMN email_queue.last_attempt_at IS 'Timestamp of most recent send attempt (for debugging)';
COMMENT ON COLUMN email_queue.error_message IS 'Error details from Resend API if send failed (helps diagnose issues)';
COMMENT ON COLUMN email_queue.sent_at IS 'When email was successfully sent (NULL if not sent yet)';
```

**Retry Logic**:
- Failed sends automatically retry on next cron run (every 5 minutes)
- Max 3 attempts before marking as 'failed'
- `attempts` counter increments with each try
- `last_attempt_at` tracks timing for debugging
- `error_message` stores Resend API errors for diagnosis

### Frontend Additions

#### 1. Email Preferences Page
**Location**: `/profile/email-preferences`

**Features**:
- Global email toggle (master switch)
- Per-email-type toggles (welcome, reminders, results, fixtures, announcements)
- Per-competition overrides ("Mute Crown Pub LMS")
- Frequency selector (all, digest, critical only, none)
- Preview of what emails you'll receive
- Test email button ("Send me a sample")

**Route**:
- `POST /get-email-preferences`
- `POST /update-email-preferences`

#### 2. Per-Competition Email Settings
**Location**: `/competition/[id]/settings` (tab: Email Notifications)

**Features**:
- Override global settings for this competition
- Quick toggles for each email type
- "Mute this competition" button
- Preview of upcoming emails

**Route**: Same as above with competition_id

#### 3. Organizer Email Analytics Dashboard
**Location**: `/competition/[id]/manage` (tab: Communications)

**Features** (for organizers):
- Email send history for competition
- Open rates and click rates per email type
- List of players who have email disabled
- Send custom announcement (with preview)
- Email health score (engagement level)

**Routes**:
- `POST /get-competition-email-analytics`
- `POST /send-organizer-announcement`

---

## Implementation Roadmap

### Phase 1: Foundation (MVP - Incremental Development)
**Goal**: Build and test email system incrementally with tight feedback loops

**Approach**: Start small, test thoroughly, expand in blocks

#### Step 1: Database Foundation (30 minutes) ✅ COMPLETE
- [x] Create `email_queue` table (no constraints, use TIMESTAMP WITH TIME ZONE)
- [x] Create `email_tracking` table (no constraints, use TIMESTAMP WITH TIME ZONE)
- [x] Skip `email_preferences` and `email_templates` for now (add later)

#### Step 2: Single Pick Reminder Email (2-3 hours) ✅ COMPLETE
- [x] Pick reminder email (single unified template)
- [x] No consolidation logic (one email per competition)
- [x] Beautiful template with fixtures + teams used (strikethrough inline)
- [x] Manual trigger route: `POST /send-pick-reminder` (for testing)
- [x] Send via Resend to user's actual email
- [x] Generate and store `email_id` in template_data (format: `pick_reminder_{user_id}_{competition_id}_{round_id}_{timestamp}`)
- [x] Slate-grey color scheme matching app design
- [x] HTML + plain text fallback versions
- [x] Teams already used shown with strikethrough in fixtures list

**Implementation Details**:
- Route: `POST /send-pick-reminder` with JWT authentication
- Request: `{ user_id, round_id, competition_id }`
- Email service: `sendPickReminderEmail()` in `services/emailService.js`
- URL format: `http://PLAYER_FRONTEND_URL/game/{competition_id}/pick?email_id={tracking_id}`
- Validates: user membership, pick not made, round not locked
- Immediately sends email (no queue processor needed yet)
- Updates `email_queue` status: pending → processing → sent/failed
- Updates `email_tracking` with Resend message ID

#### Step 3: Self-Test Phase (1-2 days) ✅ COMPLETE
- [x] Create test competition and rounds
- [x] Manually trigger email via Postman
- [x] Verify formatting, links work, content correct
- [x] Iterated on template (slate-grey, British English, clean design)
- [x] Fixed URL routing to `/game/[id]/pick`
- [x] Tested with real user data

#### Step 4: Add Cron Scheduler (1 hour) ⏳ TODO
- [ ] Automated checking for picks due in 24hrs
- [ ] Queue emails for users who haven't picked
- [ ] Still no preferences - sends to everyone
- [ ] Cron runs every 5-15 minutes

#### Step 5: Email Preferences Screen (2-3 hours) ⏳ TODO
- [ ] Create `email_preferences` table (no constraints)
- [ ] Basic UI: Global on/off toggle
- [ ] Route: `POST /update-email-preferences`
- [ ] Route: `POST /get-email-preferences`
- [ ] Scheduler respects preferences before queuing

#### Step 6: Basic Tracking & Metrics (2 hours) ⏳ TODO
- [ ] Resend webhook endpoint: `POST /api/resend-webhooks`
- [ ] Log opens/clicks to `email_tracking`
- [ ] Simple admin view: emails sent, open rate
- [ ] Test webhook with real sends

#### Step 7: Expand Pick Reminders (1-2 hours) ⏳ TODO
- [ ] Add 48hr and 6hr reminder variants
- [ ] Update scheduler to handle all three timing tiers
- [ ] Test all three reminders work correctly

#### Step 8: Add Consolidation (Future - Phase 2) ⏳ TODO
- [ ] Multi-competition consolidation logic
- [ ] Consolidated email template

**Success Criteria**:
- ✅ Manual pick reminders send reliably to actual users
- ⏳ Can manually control email preferences
- ⏳ Open rates tracked in database
- ⏳ Retry logic handles failures gracefully
- ⏳ Ready to expand to other email types

**Current Status**: Steps 1-3 complete and working in production! Email template looks professional with slate-grey theme matching app design. Ready to build cron scheduler next.

---

### Phase 2: Core Experience (Polish)
**Goal**: Complete email suite and improve user control

**Timeline**: 2-3 weeks after Phase 1

- [ ] **Welcome emails**
  - [ ] Welcome email template
  - [ ] Trigger on player join + 24hr delay
  - [ ] Personalization with organizer info

- [ ] **Results notifications**
  - [ ] Results email template (survivor variant)
  - [ ] Results email template (eliminated variant)
  - [ ] Trigger on round completion
  - [ ] Social elements (show eliminations)

- [ ] **Multi-competition consolidation**
  - [ ] Consolidation service
  - [ ] Consolidated pick reminder template
  - [ ] Consolidated results template
  - [ ] 1-hour consolidation window logic

- [ ] **Granular preferences**
  - [ ] Per-email-type toggles
  - [ ] Per-competition overrides
  - [ ] Frequency selector (all/digest/critical/none)
  - [ ] Enhanced frontend preferences UI

- [ ] **Frequency caps**
  - [ ] 3 emails per day per user cap
  - [ ] 1 email per day per competition cap
  - [ ] Quiet hours (10pm-8am)
  - [ ] Grace periods between emails

**Success Criteria**:
- Users receive complete email experience across journey
- Multi-competition users don't feel spammed
- Unsubscribe rate < 2% per campaign
- 40%+ open rate on pick reminders

---

### Phase 3: Intelligence (Optimization)
**Goal**: Use data to optimize engagement and reduce fatigue

**Timeline**: 1-2 months after Phase 2

- [ ] **Engagement scoring**
  - [ ] Calculate user engagement score
  - [ ] Email fatigue detection
  - [ ] Auto-switch to digest mode
  - [ ] Re-engagement campaigns

- [ ] **Frequency optimization**
  - [ ] Dynamic frequency caps based on engagement
  - [ ] Optimal send time analysis
  - [ ] A/B testing framework
  - [ ] Personalized send times

- [ ] **Analytics dashboard**
  - [ ] Organizer email analytics page
  - [ ] Competition email health scores
  - [ ] Identify at-risk players
  - [ ] Engagement trends over time

- [ ] **Advanced personalization**
  - [ ] User behavior-based content
  - [ ] Competition-specific messaging
  - [ ] Dynamic CTA optimization

**Success Criteria**:
- 20% improvement in engagement scores
- Reduced unsubscribe rate via fatigue detection
- Organizers use analytics to improve competitions
- Pick completion rate improves 30%+

---

### Phase 4: Advanced Features (Nice to Have)
**Goal**: Enable rich communication and community building

**Timeline**: 3+ months after launch

- [ ] **Organizer announcements**
  - [ ] Announcement composer UI
  - [ ] Recipient targeting
  - [ ] Preview before send
  - [ ] Rate limiting (1 per week)
  - [ ] Abuse prevention

- [ ] **Fixture notifications**
  - [ ] Fixture release email template
  - [ ] Opt-in preference (off by default)
  - [ ] A/B test value vs. noise

- [ ] **Advanced features**
  - [ ] Email reply handling
  - [ ] Mobile app deep linking
  - [ ] Multi-language support
  - [ ] SMS integration for critical reminders
  - [ ] Slack/Discord integration for announcements

- [ ] **Post/comment notifications** (if data supports)
  - [ ] Opt-in only
  - [ ] Daily digest maximum
  - [ ] Strict frequency caps

**Success Criteria**:
- Organizers actively use announcement feature
- No spam complaints
- Deep linking improves mobile engagement
- Feature adoption > 30%

---

## Open Questions & Decisions Needed

### 1. Time Zones
**Question**: Are competitions local (pub in one city) or international?

**Impact**: Affects optimal send times and quiet hours

**Options**:
- A: Assume all users in same timezone (simple, works for local competitions)
- B: Store user timezone preference (better UX, more complex)
- C: Infer timezone from IP/browser (automatic but less reliable)

**Decision**: [ ] To be determined

---

### 2. Resend Tier & Limits
**Question**: What's your current Resend tier?

**Free tier limits**:
- 100 emails/day
- 3,000 emails/month

**Impact**: Need to budget email sends and potentially upgrade

**Calculation**:
- 100 users × 5 competitions × 3 pick reminders per round × 4 rounds/month = 6,000 emails
- **Free tier insufficient at scale**

**Recommendation**: [ ] Upgrade to paid tier ($20/month for 50k emails)

---

### 3. Organizer Email Analytics
**Question**: Should organizers see email analytics for their competition?

**Pros**:
- Transparency builds trust
- Helps organizers optimize communication
- Identifies disengaged players

**Cons**:
- Privacy concerns (who opened what)
- Might pressure users
- Additional UI complexity

**Decision**: [ ] To be determined

**Recommendation**: Show aggregate data only (no individual user opens), focus on:
- Overall open rates
- Number of players with emails disabled
- Email health score for competition

---

### 4. Legal Compliance
**Question**: What markets are you targeting? Need GDPR/CAN-SPAM compliance?

**Requirements by region**:
- **US (CAN-SPAM)**: Unsubscribe link, physical address, accurate headers
- **EU (GDPR)**: Explicit consent, data processing agreement, right to deletion
- **UK (PECR)**: Similar to GDPR

**Email classification**:
- **Transactional**: Pick reminders, results, welcome (essential to service)
- **Marketing**: Fixture notifications, announcements (need explicit consent)

**Action items**:
- [ ] Classify each email type
- [ ] Add consent checkboxes for marketing emails
- [ ] Include physical address in footer
- [ ] Update privacy policy

---

### 5. Testing Strategy
**Question**: How to test emails without spamming real users?

**Options**:
- A: Staging email domain (e.g., emails send to staging-email@lmslocal.co.uk)
- B: Test user flag (emails only send to flagged test accounts)
- C: Email preview API (Resend provides preview without sending)
- D: Local email testing tool (MailHog, MailCatcher)

**Recommendation**: [ ] Use combination of test flag + Resend preview API

---

### 6. Mobile App Integration
**Question**: Should emails deep-link to Flutter app when installed?

**Impact**: Could dramatically improve click-through and engagement

**Implementation**:
- Use universal links (iOS) and app links (Android)
- Detect if app installed, fallback to web
- Track app opens vs web opens

**Decision**: [x] **LATER PHASE** - Flutter app not built yet. Implement deep linking in Phase 3+ once mobile app exists and has traction

---

### 7. Reply Functionality
**Question**: Should users be able to reply to emails?

**Options**:
- A: No-reply address (standard, prevents confusion)
- B: Replies go to organizer email (personal touch, but privacy concerns)
- C: Replies go to support inbox (additional support burden)

**Recommendation**: [ ] No-reply for automated emails, organizer email for announcements

---

### 8. Email vs Push Notifications
**Question**: Should we use push notifications instead of email for mobile users?

**Trade-offs**:
- Push: Higher engagement, instant, better for urgency
- Email: Universal, no opt-in friction, better for detailed content

**Recommendation**: [ ] Both - push for critical reminders, email for detailed content

**Implementation**: Phase 3+ after mobile app traction

---

## Success Metrics & KPIs

### Email Performance Targets

| Metric | Target | Measurement |
|--------|--------|-------------|
| Pick Reminder Open Rate | 40%+ | Opens / Sends |
| Pick Reminder CTR | 15%+ | Clicks / Opens |
| Results Email Open Rate | 30%+ | Opens / Sends |
| Welcome Email Open Rate | 50%+ | Opens / Sends |
| Overall Unsubscribe Rate | <2% | Unsubscribes / Sends |
| Bounce Rate | <1% | Bounces / Sends |
| Spam Complaint Rate | <0.1% | Complaints / Sends |

### Business Impact Targets

| Metric | Target | Measurement |
|--------|--------|-------------|
| Missed Pick Reduction | 30%+ | Before/after email implementation |
| User Retention (30 day) | 2x | Email recipients vs non-recipients |
| Competition Completion Rate | 20%+ increase | Full competition participation |
| Engagement Score | 3x | App opens after email send |
| Organizer Satisfaction | 80%+ | Survey: "Emails help my competition" |

### Engagement Health Score Formula

```javascript
// User Email Health Score (0-100)
function calculateEngagementScore(user) {
    const openRate = user.opens / user.emailsSent;
    const clickRate = user.clicks / user.opens;
    const recency = daysSinceLastOpen;

    let score = 0;
    score += openRate * 40;        // Max 40 points for opens
    score += clickRate * 30;       // Max 30 points for clicks
    score += (recency < 7 ? 20 : (recency < 14 ? 10 : 0)); // Recency bonus
    score += (user.unsubscribed ? -50 : 10); // Preference bonus/penalty

    return Math.max(0, Math.min(100, score));
}

// Interpretation
// 80-100: Highly engaged (send all emails)
// 60-79: Engaged (standard cadence)
// 40-59: At risk (reduce to digest)
// 20-39: Disengaged (critical only)
// 0-19: Lost (re-engagement campaign or suppress)
```

---

## Email Template Design Guidelines

### Voice & Tone

**Personality**: Friendly pub landlord, not corporate platform

**Dos**:
- Use casual, conversational language
- Address user by name
- Sign emails from organizer (not "LMSLocal Team")
- Show personality ("Dave from Crown Pub" not "Competition Administrator")
- Create urgency without pressure ("Don't miss out!" not "URGENT ACTION REQUIRED")

**Don'ts**:
- Corporate jargon or formal language
- All caps or excessive punctuation
- Generic greetings ("Dear User")
- Robotic tone ("This is an automated message")

### Structure

Every email should follow:

```
1. Preheader text (50 chars) - Shown in inbox preview
2. Personalized greeting - "Hi Sarah," not "Hello,"
3. Key information up front - What do they need to know?
4. Context/details - Why does this matter?
5. Clear call-to-action - What should they do?
6. Secondary information - Additional helpful details
7. Sign-off from organizer - Personal touch
8. Footer - Preferences, unsubscribe, legal
```

### Design Principles

**Mobile-first**:
- 60%+ of emails opened on mobile
- Single column layout
- Large tap targets (min 44px)
- Concise subject lines (<50 chars)

**Accessibility**:
- Alt text for images
- Semantic HTML
- Sufficient color contrast
- Plain text fallback

**Branding**:
- Simple header with LMSLocal logo
- Competition name prominent
- Consistent color scheme
- Minimal design (content over decoration)

### Example Pick Reminder Template

```
Subject: Dave (Crown Pub): Your pick is due in 24 hours ⏰

Preheader: Don't miss Round 5 - 18 players left standing

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Hi Sarah,

Time to make your pick for Round 5 of The Crown Pub LMS!

⏰ Picks lock in 24 hours (tomorrow at 3pm)
👥 18 players remaining
🏆 £200 prize pot

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

ROUND 5 FIXTURES:
• Arsenal vs Man United
• Liverpool vs Chelsea
• Man City vs Spurs
• Newcastle vs Brighton
• Aston Villa vs West Ham

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Teams you've already used:
✗ Arsenal  ✗ Liverpool  ✗ Man City  ✗ Chelsea

(Note: Show this section if fewer teams used than available.
Otherwise show "Available teams" list instead)

[MAKE YOUR PICK →]

Good luck!
Dave
Crown Pub LMS

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Manage email preferences | Unsubscribe from this competition
LMSLocal | 123 High Street, London | Privacy Policy
```

---

## Resend Integration Details

### API Endpoints Used

```javascript
// Send email
await resend.emails.send({
    from: 'Crown Pub LMS <noreply@lmslocal.co.uk>',
    to: 'sarah@example.com',
    subject: 'Your pick is due in 24 hours ⏰',
    html: renderedTemplate,
    text: plainTextVersion,
    headers: {
        'X-Entity-Ref-ID': emailTrackingId, // For webhook correlation
    },
    tags: [
        { name: 'email_type', value: 'pick_reminder' },
        { name: 'competition_id', value: '123' },
        { name: 'user_id', value: '456' }
    ]
});
```

### Webhook Events

```javascript
// POST /api/resend-webhooks
{
    "type": "email.sent",
    "created_at": "2025-01-15T10:30:00Z",
    "data": {
        "email_id": "abc123",
        "from": "noreply@lmslocal.co.uk",
        "to": ["sarah@example.com"],
        "subject": "Your pick is due in 24 hours",
        "headers": {
            "X-Entity-Ref-ID": "tracking_xyz"
        }
    }
}

// Other events: email.delivered, email.opened, email.clicked,
//               email.bounced, email.complained
```

### Configuration

```javascript
// lmslocal-server/services/emailService.js

const { Resend } = require('resend');
const resend = new Resend(process.env.RESEND_API_KEY);

// Sending domain: lmslocal.co.uk
// From addresses:
// - noreply@lmslocal.co.uk (automated emails)
// - notifications@lmslocal.co.uk (system notifications)
// - support@lmslocal.co.uk (replies enabled)

// Webhooks: Configure in Resend dashboard
// - URL: https://api.lmslocal.co.uk/api/resend-webhooks
// - Events: All email events
// - Secret: Store in .env as RESEND_WEBHOOK_SECRET
```

---

## Risk Mitigation

### Risk: Email deliverability issues
**Impact**: Users don't receive critical pick reminders, leading to missed picks

**Mitigation**:
- Use authenticated domain (SPF, DKIM, DMARC)
- Monitor bounce rates and clean lists
- Warm up sending domain gradually
- Avoid spam trigger words
- Include plain text versions
- Maintain low complaint rate

**Monitoring**: Alert if bounce rate >2% or complaint rate >0.1%

---

### Risk: User feels spammed
**Impact**: High unsubscribe rates, negative perception of platform

**Mitigation**:
- Strict frequency caps (3 per day max)
- Smart consolidation for multi-competition users
- Granular preference controls
- Fatigue detection and auto-adjustment
- Clear value proposition for each email

**Monitoring**: Alert if unsubscribe rate >3% for any campaign

---

### Risk: Organizer abuse (spam via announcements)
**Impact**: Users unsubscribe, platform reputation damage

**Mitigation**:
- Rate limit: 1 announcement per week
- Preview and confirmation required
- Character limits
- Report abuse mechanism
- Monitor organizer behavior patterns
- Suspend feature for repeat offenders

**Monitoring**: Track announcements per organizer and complaint rates

---

### Risk: Email service downtime (Resend outage)
**Impact**: Critical pick reminders not sent

**Mitigation**:
- Queue system allows retry
- Exponential backoff on failures
- Fallback to secondary provider (SendGrid, AWS SES)
- Status page monitoring
- Alert on send failures

**Monitoring**: Alert if >5% send failure rate over 15 minutes

---

### Risk: Database overload from email tracking
**Impact**: Performance degradation

**Mitigation**:
- Async webhook processing (queue)
- Batch inserts for tracking data
- Archive old tracking data (>6 months)
- Index optimization
- Connection pooling

**Monitoring**: Track `email_tracking` table size and query performance

---

### Risk: Legal compliance violations (GDPR, CAN-SPAM)
**Impact**: Fines, legal issues, reputation damage

**Mitigation**:
- Clear consent mechanisms
- Easy unsubscribe (one-click)
- Honor unsubscribe immediately
- Include physical address in footer
- Maintain email sending logs
- Data retention policies

**Monitoring**: Legal review before launch, periodic audits

---

## Next Steps

1. **[ ] Review & approve this plan** with stakeholders
2. **[ ] Make architectural decisions** on open questions
3. **[ ] Size Phase 1 tasks** and assign to sprints
4. **[ ] Set up Resend account** and configure domain
5. **[ ] Create database migration** for new tables
6. **[ ] Design email templates** (Figma/mockups)
7. **[ ] Build MVP** (Phase 1 features)
8. **[ ] Test thoroughly** with test users
9. **[ ] Launch to small user group** (beta)
10. **[ ] Monitor metrics** and iterate

---

## Document Maintenance

**Last Updated**: 2025-10-02
**Owner**: LMSLocal Engineering Team
**Review Cadence**: Monthly during active development, quarterly post-launch

**Change Log**:
- 2025-10-02: Initial plan created

**Feedback**: Share thoughts, questions, or suggestions for this plan with the team.
