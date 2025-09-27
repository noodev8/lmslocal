# Business Marketing Feature - Database Schema Additions

## Analysis of Existing Schema

**Existing Core Tables (No Changes Needed):**
- `app_user` - Perfect for linking marketing posts to organizers
- `competition` - Already has `organiser_id` for ownership control
- `competition_user` - Links players to competitions for targeting
- `audit_log` - Can log marketing post activities

**Key Observations:**
- Schema is well-structured and normalized
- No subscription/billing tables exist (likely external service?)
- Competition ownership already established via `organiser_id`
- User system supports both organizers and players

---

## Minimal Schema Additions Required

### 1. Core Marketing Posts Table

```sql
-- Marketing posts created by competition organizers
CREATE TABLE public.marketing_posts (
    id SERIAL PRIMARY KEY,
    competition_id INTEGER NOT NULL,
    created_by_user_id INTEGER NOT NULL,

    -- Post Content
    post_type VARCHAR(50) NOT NULL, -- 'event_promotion', 'special_offer', 'announcement', 'custom'
    title VARCHAR(50) NOT NULL,
    description VARCHAR(200),
    image_url TEXT,

    -- Call to Action
    cta_text VARCHAR(50), -- "Book Table", "Claim Offer", etc.
    cta_url TEXT,

    -- Scheduling
    start_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    end_date TIMESTAMP WITH TIME ZONE,

    -- Status & Management
    is_active BOOLEAN DEFAULT true,
    is_archived BOOLEAN DEFAULT false, -- For post history/timeline features
    display_priority INTEGER DEFAULT 1, -- For ordering when multiple posts

    -- Simple Analytics (counters)
    view_count INTEGER DEFAULT 0,
    click_count INTEGER DEFAULT 0,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

### 2. Event-Specific Details Table

```sql
-- Additional details for event promotion posts
CREATE TABLE public.marketing_events (
    id SERIAL PRIMARY KEY,
    marketing_post_id INTEGER NOT NULL,

    -- Event Details
    event_date DATE,
    event_time TIME,
    event_description TEXT,
    max_capacity INTEGER,

    -- Booking Integration
    booking_url TEXT,
    booking_requirements TEXT,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

### 3. Offer-Specific Details Table

```sql
-- Additional details for special offer posts
CREATE TABLE public.marketing_offers (
    id SERIAL PRIMARY KEY,
    marketing_post_id INTEGER NOT NULL,

    -- Offer Details
    offer_conditions VARCHAR(150),
    offer_code VARCHAR(20), -- "CROWN2025"
    valid_until TIMESTAMP WITH TIME ZONE,

    -- Usage Tracking
    max_redemptions INTEGER,
    current_redemptions INTEGER DEFAULT 0,
    requires_verification BOOLEAN DEFAULT false,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

### 4. Subscription Tier Storage (Future Implementation)

```sql
-- User subscription tiers (when billing is implemented)
CREATE TABLE public.user_subscriptions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,

    -- Subscription Details
    tier VARCHAR(20) NOT NULL DEFAULT 'free', -- 'free', 'starter', 'pro'
    status VARCHAR(20) NOT NULL DEFAULT 'active', -- 'active', 'expired', 'cancelled'

    -- Billing Integration
    external_subscription_id VARCHAR(100), -- Payment processor reference
    amount_paid_cents INTEGER, -- Subscription amount in cents
    currency VARCHAR(3) DEFAULT 'GBP',

    -- Timestamps
    started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Note: Table not needed for initial implementation
-- Beta access controlled by creating 'starter' tier records for all users
```

---

## Indexes for Performance

```sql
-- Marketing Posts Indexes
CREATE INDEX idx_marketing_posts_competition ON marketing_posts(competition_id);
CREATE INDEX idx_marketing_posts_active ON marketing_posts(competition_id, is_active, start_date, end_date);
CREATE INDEX idx_marketing_posts_creator ON marketing_posts(created_by_user_id);
CREATE INDEX idx_marketing_posts_priority ON marketing_posts(competition_id, display_priority, is_active);

-- Analytics Indexes
CREATE INDEX idx_marketing_analytics_post ON marketing_analytics(marketing_post_id);
CREATE INDEX idx_marketing_analytics_competition ON marketing_analytics(competition_id, event_timestamp);
CREATE INDEX idx_marketing_analytics_events ON marketing_analytics(marketing_post_id, event_type);

-- Event Details Index
CREATE INDEX idx_marketing_events_post ON marketing_events(marketing_post_id);
CREATE INDEX idx_marketing_events_date ON marketing_events(event_date, event_time);

-- Offer Details Index
CREATE INDEX idx_marketing_offers_post ON marketing_offers(marketing_post_id);
CREATE INDEX idx_marketing_offers_code ON marketing_offers(offer_code);
CREATE INDEX idx_marketing_offers_valid ON marketing_offers(valid_until);
```

---

## Key Design Decisions

### 1. Leveraging Existing Tables
**✅ No Changes to Core Schema**
- Uses existing `competition(organiser_id)` for ownership
- Links to existing `app_user` for creators
- Integrates with existing `competition_user` for player targeting
- Can log activities via existing `audit_log`

### 2. Subscription Control via Application Logic
**✅ No Subscription Table Needed Initially**
- Beta access controlled by creating subscription records with 'starter' tier
- No special beta fields that become obsolete
- Clean subscription model from day one
- Application logic handles access control

### 3. Flexible Post Structure
**✅ Type-Based Architecture**
- Base `marketing_posts` table for all post types
- Extended tables (`marketing_events`, `marketing_offers`) for specific data
- Easy to add new post types without schema changes
- Clean separation of concerns

### 4. Competition-Scoped Data
**✅ Per-Competition Marketing**
- All posts linked to specific competitions
- Natural data isolation and access control
- Aligns with existing competition-centric architecture
- Supports multi-competition organizers

---

## Data Flow Integration

### Post Creation Flow
```sql
-- 1. Create base post
INSERT INTO marketing_posts (competition_id, created_by_user_id, post_type, title, ...)
-- 2. Add type-specific details if needed
INSERT INTO marketing_events (marketing_post_id, event_date, ...) -- for events
INSERT INTO marketing_offers (marketing_post_id, offer_code, ...) -- for offers
```

### Post Display Query
```sql
-- Get active posts for competition dashboard
SELECT
    mp.*,
    me.event_date, me.event_time, -- event details
    mo.offer_code, mo.valid_until  -- offer details
FROM marketing_posts mp
LEFT JOIN marketing_events me ON mp.id = me.marketing_post_id
LEFT JOIN marketing_offers mo ON mp.id = mo.marketing_post_id
WHERE mp.competition_id = ?
  AND mp.is_active = true
  AND (mp.start_date IS NULL OR mp.start_date <= NOW())
  AND (mp.end_date IS NULL OR mp.end_date > NOW())
ORDER BY mp.display_priority ASC, mp.created_at DESC
LIMIT 4;
```

### Analytics Tracking
```sql
-- Track post view
INSERT INTO marketing_analytics (marketing_post_id, user_id, competition_id, event_type)
VALUES (?, ?, ?, 'view');

-- Track CTA click
INSERT INTO marketing_analytics (marketing_post_id, user_id, competition_id, event_type)
VALUES (?, ?, ?, 'click');
```

---

## Migration Strategy

### Phase 1: Core Tables
1. Create `marketing_posts` table
2. Create `marketing_events` table
3. Create `marketing_offers` table
4. Add indexes for performance

### Phase 2: Analytics (Optional)
1. Create `marketing_analytics` table
2. Add analytics indexes
3. Implement tracking in API layer

### Phase 3: Advanced Features (Future)
1. Template system (if needed)
2. Advanced targeting (if needed)
3. Integration hooks (if needed)

---

## Storage Estimates

**For Typical Pub with 50 players:**
- Marketing Posts: ~20 posts/month × 12 months = 240 posts/year
- Analytics: ~1000 events/month × 12 months = 12,000 events/year
- Events: ~5 events/month × 12 months = 60 events/year
- Offers: ~10 offers/month × 12 months = 120 offers/year

**Total Storage Impact: ~50KB/year per competition**
- Minimal impact on database size
- Excellent performance with proper indexing
- Easy to archive old data if needed

---

## Analytics Strategy: Simplified Approach

### Question: Do We Need the Analytics Table?

**🤔 If calculating on button press, why store individual events?**

**Option A: Event Storage + On-Demand Calculation**
```sql
-- Store every view/click event
INSERT INTO marketing_analytics (event_type, timestamp, ...)
-- Calculate when analytics modal opens
SELECT COUNT(*) FROM marketing_analytics WHERE ...
```

**Option B: Summary Counters Only (Simpler)**
```sql
-- Add to marketing_posts table:
ALTER TABLE marketing_posts ADD COLUMN view_count INTEGER DEFAULT 0;
ALTER TABLE marketing_posts ADD COLUMN click_count INTEGER DEFAULT 0;

-- Increment on actions
UPDATE marketing_posts SET view_count = view_count + 1 WHERE id = ?;
UPDATE marketing_posts SET click_count = click_count + 1 WHERE id = ?;
```

### Recommended: Start with Summary Counters

**Benefits:**
- ✅ Much simpler implementation
- ✅ No analytics table needed initially
- ✅ Instant display (no calculation needed)
- ✅ Scales better (no growing event table)

**Limitations:**
- ❌ No historical analysis or trends
- ❌ No unique user tracking
- ❌ No time-based insights

**When to Add Event Table:**
- Need historical performance analysis
- Want to track user behavior patterns
- Require detailed conversion funnels

## Post Archiving Strategy

### Soft Archive Approach

**✅ `is_archived` Flag Added to Schema**
- Posts never deleted, just marked archived
- Organizers can view post history/timeline
- "Facebook-style" post history feature ready
- Easy to unarchive if needed

**Query Patterns:**
```sql
-- Active posts only (current dashboard)
WHERE is_active = true AND is_archived = false

-- All posts for history view (future feature)
WHERE competition_id = ? ORDER BY created_at DESC

-- Archive old posts (manual or automated)
UPDATE marketing_posts SET is_archived = true WHERE end_date < NOW() - INTERVAL '30 days'
```

**Benefits:**
- Data preservation for analytics
- Future "post timeline" feature ready
- Easy rollback of accidental deletions
- Historical performance analysis possible

## Beta Access Control

### Subscription Logic During Beta

```sql
-- Option 1: No subscription table during beta (simplest)
-- All users get marketing features in application logic

-- Option 2: Create subscription records for beta users
INSERT INTO user_subscriptions (user_id, tier, status, amount_paid_cents)
VALUES (?, 'starter', 'active', 2900); -- £29 marked as paid

-- Check access (clean subscription model)
SELECT tier, status, expires_at
FROM user_subscriptions
WHERE user_id = ?
  AND tier IN ('starter', 'pro')
  AND status = 'active'
  AND (expires_at IS NULL OR expires_at > NOW());
```

**Beta Phase Behavior:**
- Create subscription records for all beta users with 'starter' tier
- No special beta fields that become obsolete
- Clean transition to real billing
- Same access control logic from day one

## Implementation Priorities

**Phase 1: Core Functionality**
1. Create tables (no foreign key constraints)
2. Basic post CRUD operations
3. Simple analytics insertion
4. Beta access checking

**Phase 2: Analytics & History**
1. On-demand analytics calculation
2. Post archiving workflow
3. Performance optimization
4. Timeline/history features

**Phase 3: Production Transition**
1. Billing integration
2. Subscription enforcement
3. Advanced analytics
4. Data archival strategies

This approach gives you full functionality immediately while keeping complexity minimal and providing clear growth paths for each feature area.