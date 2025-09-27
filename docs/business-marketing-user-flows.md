# Business Marketing Feature - User Flows

## Overview
This document defines the complete user journey for the business marketing feature within LMSLocal. The feature allows Starter tier subscribers (£29/month) to create marketing posts that appear in their competition dashboards, providing a direct communication channel to engaged local players.

## Core Principles
- **Zero Interference**: Marketing never disrupts core game functionality
- **Subscription Gated**: Only available to Starter tier and above
- **Per-Competition Management**: Posts are created and managed for individual competitions
- **4 Post Limit**: Maximum 4 simultaneous active posts per competition
- **Organizer Control**: No approval process - organizers speak directly to their audience

---

## 1. ORGANIZER USER FLOWS

### 1.1 Feature Discovery & Activation

#### Flow A: New Starter Subscriber
**Trigger**: User upgrades to Starter tier (£29/month)

1. User completes subscription upgrade
2. Dashboard shows "New Features Unlocked" notification
3. Marketing toolkit section appears in competition management menu
4. Onboarding tooltip: "Create marketing posts to promote events and offers to your players"

#### Flow B: Existing Starter Subscriber
**Trigger**: User navigates to competition management

1. User accesses competition dashboard
2. "Marketing Posts" tab visible in competition navigation
3. Tab shows count: "Marketing Posts (2/4)" if posts exist
4. Empty state with "Create Your First Post" CTA if no posts

### 1.2 Marketing Post Creation Flow

#### Primary Creation Path
**Entry Point**: Competition Dashboard → Marketing Posts Tab

```
1. Competition Dashboard
   ↓
2. Click "Marketing Posts" tab
   ↓
3. Post Management Interface
   - Current Posts (0-4 active)
   - "Create New Post" button (disabled if 4/4)
   ↓
4. Template Selection Modal
   - Event Promotion
   - Special Offer
   - General Announcement
   - Custom (blank template)
   ↓
5. Post Creation Form
   - Template-specific fields
   - Preview panel (live update)
   ↓
6. Review & Publish
   - Final preview
   - Publish immediately or schedule
   ↓
7. Confirmation & Return
   - "Post published successfully"
   - Return to post management
```

#### Detailed Creation Form Fields

**Event Promotion Template:**
- Event Title (required, 50 chars)
- Event Description (optional, 200 chars)
- Event Date & Time (required)
- Event Image (optional, upload or stock)
- Call to Action Text (default: "Book Table", customizable)
- Call to Action URL (optional)

**Special Offer Template:**
- Offer Title (required, 50 chars)
- Offer Description (required, 100 chars)
- Offer Conditions (optional, 150 chars)
- Valid Until Date (optional)
- Offer Code (optional, for verification)
- CTA Text (default: "Claim Offer")

**General Announcement Template:**
- Announcement Title (required, 50 chars)
- Message (required, 200 chars)
- Image (optional)
- CTA Text (optional)
- CTA URL (optional)

### 1.3 Post Management Flow

#### Viewing Active Posts
**Entry Point**: Competition Dashboard → Marketing Posts Tab

```
Marketing Posts Interface:
┌─────────────────────────────────────┐
│ Active Posts (3/4)            [+]   │
├─────────────────────────────────────┤
│ 🎬 Derby Screening               📊 │
│ Saturday 3:00 PM • 15 views        │
│ [Edit] [Pause] [Delete]             │
├─────────────────────────────────────┤
│ 🍺 Free Pint for Survivors      📊 │
│ Valid until Round 10 • 8 clicks    │
│ [Edit] [Pause] [Delete]             │
├─────────────────────────────────────┤
│ 🎤 Quiz Night Tonight           📊 │
│ Tuesday 8:00 PM • 3 bookings       │
│ [Edit] [Pause] [Delete]             │
└─────────────────────────────────────┘
```

#### Post Actions
- **Edit**: Modify post content (form pre-populated)
- **Pause**: Temporarily hide post from players
- **Delete**: Permanently remove post (confirmation required)
- **Analytics**: View basic performance metrics

### 1.4 Analytics & Performance Flow

#### Basic Analytics Dashboard
**Entry Point**: Click analytics icon (📊) on any post

```
Post Performance:
┌─────────────────────────────────────┐
│ Derby Screening                     │
│ Published: 3 days ago               │
├─────────────────────────────────────┤
│ 👁️  Views: 47                       │
│ 👆 Clicks: 12                       │
│ 📱 Conversions: 3 bookings          │
├─────────────────────────────────────┤
│ Top performing time: Sat 2-4pm     │
│ Most clicks from: Round 8 survivors │
└─────────────────────────────────────┘
```

---

## 2. PLAYER USER FLOWS

### 2.1 Marketing Content Discovery

#### Primary Player Experience
**Context**: Player accessing their competition dashboard

```
Game Dashboard with Marketing:
┌─────────────────────────────────────┐
│ ← Dashboard    Premier League LMS    │ ← Core game header unchanged
├─────────────────────────────────────┤
│ Competition Details & Status        │ ← Core game info unchanged
│ Prize Pool: £500 | Entry: £10      │
├─────────────────────────────────────┤
│ 🎬 Derby Screening    [Book Table]  │ ← Marketing content section
│ Man City vs Man United • Sat 3PM   │   (only appears if posts exist)
│ • Free pint for survivors           │
├─────────────────────────────────────┤
│ Your Status: Still In              │ ← Core game continues unchanged
│                                     │
│ Round 8                            │
│ Pick your team to continue          │
└─────────────────────────────────────┘
```

### 2.2 Marketing Interaction Flow

#### Clicking on Marketing Content
**Trigger**: Player clicks "Book Table" or marketing CTA

```
Interaction Options:
1. External Link (most common)
   → Opens venue booking system in new tab
   → Player remains in competition dashboard

2. Offer Code Display
   → Modal shows: "Show this code at the bar: CROWN2025"
   → Copy to clipboard option
   → "Got it" to close modal

3. Information Only
   → Expands to show more details
   → Contact information displayed
   → Social media links
```

### 2.3 Player Experience States

#### State 1: No Marketing Content (Default)
```
Standard Game Dashboard:
- Competition header
- Game status and progress
- Round information
- Standings and actions
- Clean, uncluttered interface
```

#### State 2: Marketing Content Present
```
Enhanced Game Dashboard:
- All standard game elements (unchanged)
- Marketing section inserted between header and game status
- Maximum 4 posts displayed
- Prioritized by organizer-set order
- Subtle visual separation from game content
```

#### State 3: Marketing Content Loading
```
Loading State:
- Standard game elements load first
- Marketing section shows skeleton loading
- Game functionality available immediately
- Marketing loads asynchronously
```

---

## 3. SUBSCRIPTION & ACCESS CONTROL FLOWS

### 3.1 Non-Subscriber Experience

#### Free Tier User Attempts Access
**Trigger**: Free tier user clicks non-existent Marketing tab

```
No Access:
- Marketing Posts tab not visible in navigation
- No marketing content in player dashboard
- Upgrade prompts in appropriate contexts
- Core game functionality unaffected
```

#### Upgrade Flow Integration
**Trigger**: Free tier user sees upgrade suggestions

```
Upgrade Context:
1. Dashboard notification: "Unlock marketing toolkit with Starter plan"
2. Competition settings: "Want to promote events to your players? Upgrade to Starter"
3. Pricing page: Marketing toolkit highlighted in Starter features
```

### 3.2 Subscription Expiry Flow

#### When Starter Subscription Expires
**Trigger**: Monthly payment fails or cancellation

```
Graceful Degradation:
1. 7-day grace period: All marketing features remain active
2. Grace period warning: "Your subscription expires in X days"
3. After expiry:
   - Marketing posts become invisible to players
   - Post creation disabled for organizer
   - Existing posts preserved (not deleted)
   - Clear re-subscription path provided
```

#### Re-subscription Flow
**Trigger**: Expired user reactivates Starter plan

```
Feature Restoration:
1. Immediate access to post creation tools
2. Previously created posts automatically become visible again
3. Welcome back notification: "Your marketing posts are now live again"
```

---

## 4. TECHNICAL INTEGRATION FLOWS

### 4.1 Data Flow Architecture

#### Post Creation Data Flow
```
Organizer Interface → API Validation → Database Storage → Player Display

1. Form Submission
   - Client-side validation
   - Image upload (if applicable)
   - Template data structure

2. Backend Processing
   - Subscription tier verification
   - Post limit checking (4 max)
   - Content sanitization
   - Database insertion

3. Player Delivery
   - Competition-specific query
   - Active posts only
   - Priority ordering
   - Cached for performance
```

### 4.2 Display Logic Flow

#### Player Dashboard Rendering Logic
```
Competition Dashboard Load:
1. Load core game data (priority)
2. Check if marketing content exists for competition
3. If exists and subscription active:
   - Fetch active posts
   - Render marketing section
   - Track view analytics
4. If no content or expired subscription:
   - Skip marketing section entirely
   - Render standard dashboard
```

---

## 5. EDGE CASES & ERROR HANDLING

### 5.1 Post Limit Management

#### Attempting to Create 5th Post
```
User Experience:
1. "Create New Post" button disabled when 4/4 active
2. Clear messaging: "Maximum 4 active posts reached"
3. Options provided:
   - "Pause an existing post to create a new one"
   - "Delete an expired post"
   - "Edit an existing post instead"
```

### 5.2 Content Moderation & Quality

#### Inappropriate Content Prevention
```
Built-in Safeguards:
1. Character limits prevent spam
2. URL validation for CTAs
3. Image upload restrictions
4. Template structure guides appropriate content
5. No automated moderation (organizer responsibility)
```

### 5.3 Performance & Reliability

#### Marketing Content Failure
```
Fallback Behavior:
1. If marketing API fails:
   - Game dashboard loads normally
   - Marketing section simply absent
   - No error shown to players
   - Core game unaffected

2. If individual post fails to load:
   - Other posts display normally
   - Failed post skipped silently
   - Analytics logged for debugging
```

---

## 6. SUCCESS METRICS & VALIDATION

### 6.1 Organizer Success Indicators
- **Adoption Rate**: % of Starter subscribers who create posts
- **Engagement**: Average posts per active competition
- **Retention**: Subscription renewal rates for marketing users
- **Usage Pattern**: Frequency of post updates and management

### 6.2 Player Success Indicators
- **Interaction Rate**: % of players who click marketing content
- **Conversion**: Bookings/actions driven by marketing posts
- **Experience Impact**: Game abandonment rates (should remain unchanged)
- **Satisfaction**: Player feedback on marketing integration

### 6.3 Business Success Indicators
- **Revenue Impact**: Upgrade conversion from Free to Starter
- **Customer Value**: Increased LTV from marketing feature users
- **Market Validation**: Venue renewal and expansion rates
- **Competitive Advantage**: Unique positioning vs. alternatives

---

## Implementation Priority

**Phase 1 (MVP)**: Core creation flow + basic display
**Phase 2**: Analytics and management features
**Phase 3**: Advanced templates and targeting
**Phase 4**: Integration with external booking systems

This user flow foundation ensures the marketing feature enhances rather than disrupts the core LMSLocal experience while providing genuine value to both venues and players.