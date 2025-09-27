# Business Marketing Feature - Interface Design & Mockups

## Design Philosophy

**Core Principles:**
- **Seamless Integration**: Marketing features feel native to existing LMSLocal interface
- **Zero Disruption**: Game functionality always takes visual priority
- **Template-Driven**: Simple, guided creation process for non-technical users
- **Mobile-First**: Responsive design for pub managers on phones/tablets
- **Value Clarity**: £29/month feels justified through professional, powerful interface

**Visual Hierarchy:**
1. Core game functionality (unchanged)
2. Marketing content (complementary)
3. Administrative tools (secondary)

---

## 1. ORGANIZER INTERFACES

### 1.1 Competition Dashboard - Marketing Tab

**Context**: Organizer navigates to their competition and sees new "Marketing Posts" tab

```
┌─────────────────────────────────────────────────────────────────┐
│ Competition: Premier League LMS                    The Crown & Anchor │
├─────────────────────────────────────────────────────────────────┤
│ [Overview] [Players] [Rounds] [Marketing Posts] [Settings]      │
│                                     ^^^^^^^^^^^^^^               │
│                                     New tab with (3/4) badge    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ 📢 Marketing Posts (3/4)                              [+ Create] │
│ ══════════════════════════════════════════════════════════════ │
│                                                                 │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ 🎬 Derby Screening                                      📊   │ │
│ │ Man City vs Man United • This Saturday 3:00 PM              │ │
│ │ Free pint for survivors • Book Table                        │ │
│ │ ┌────────────┬────────────┬────────────┬────────────────────┐ │ │
│ │ │   📝 Edit  │  ⏸️ Pause  │  🗑️ Delete │  👁️ 47 views      │ │ │
│ │ └────────────┴────────────┴────────────┴────────────────────┘ │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ 🍺 Free Pint for Survivors                              📊   │ │
│ │ Show this post at the bar to claim your free pint           │ │
│ │ Valid until Round 10 • Code: CROWN2025                      │ │
│ │ ┌────────────┬────────────┬────────────┬────────────────────┐ │ │
│ │ │   📝 Edit  │  ⏸️ Pause  │  🗑️ Delete │  👆 8 clicks      │ │ │
│ │ └────────────┴────────────┴────────────┴────────────────────┘ │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ 🎤 Quiz Night Tonight                                   📊   │ │
│ │ Tuesday 8:00 PM • Double points for players                 │ │
│ │ Skip the queue • Book Now                                   │ │
│ │ ┌────────────┬────────────┬────────────┬────────────────────┐ │ │
│ │ │   📝 Edit  │  ⏸️ Pause  │  🗑️ Delete │  📱 3 bookings    │ │ │
│ │ └────────────┴────────────┴────────────┴────────────────────┘ │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ 🔥 Starter Plan Marketing Toolkit                           │ │
│ │ • Create engaging posts for your competition players        │ │
│ │ • Drive bookings and build customer loyalty                 │ │
│ │ • Track performance with built-in analytics                 │ │
│ │ • 4 simultaneous posts per competition                      │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Design Notes:**
- **Tab Badge**: Shows current count (3/4) to indicate usage and limits
- **Create Button**: Prominent but not overwhelming, disabled when 4/4
- **Post Cards**: Clean, card-based layout with clear hierarchy
- **Action Bar**: Consistent 4-button layout for each post
- **Value Reinforcement**: Bottom panel reminds users of Starter benefits

### 1.2 Post Creation Modal - Template Selection

**Context**: User clicks "+ Create" button and sees template selection

```
┌─────────────────────────────────────────────────────────────────┐
│                        Create Marketing Post                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ Choose a template to get started quickly:                       │
│                                                                 │
│ ┌──────────────┬──────────────┬──────────────┬──────────────┐   │
│ │              │              │              │              │   │
│ │      🎬      │      🍺      │      📢      │      ✏️      │   │
│ │              │              │              │              │   │
│ │    Event     │   Special    │ Announcement │    Custom    │   │
│ │  Promotion   │    Offer     │              │    (Blank)   │   │
│ │              │              │              │              │   │
│ │ Perfect for  │ Discounts,   │ General info │ Start from   │   │
│ │ screenings,  │ free items,  │ and updates  │ scratch with │   │
│ │ quiz nights, │ competitions │ for your     │ complete     │   │
│ │ live music   │ and rewards  │ players      │ creative     │   │
│ │              │              │              │ control      │   │
│ │              │              │              │              │   │
│ │ [Use Template] │ [Use Template] │ [Use Template] │ [Use Template] │   │
│ └──────────────┴──────────────┴──────────────┴──────────────┘   │
│                                                                 │
│ 💡 Pro Tip: Templates include smart defaults and helpful        │
│    prompts to create engaging posts that drive results.         │
│                                                                 │
│                               [Cancel]                          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Design Notes:**
- **Visual Templates**: Each template has distinct icon and clear use case
- **Benefit-Focused Copy**: Explains what each template is good for
- **Helpful Guidance**: Pro tip educates users on template value
- **Equal Prominence**: All templates presented equally (no biased defaults)

### 1.3 Post Creation Form - Event Promotion Template

**Context**: User selected "Event Promotion" template

```
┌─────────────────────────────────────────────────────────────────┐
│ ← Back to Templates        Create Event Promotion        [Save Draft] │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ ┌─────────────────────────┐ ┌─────────────────────────────────┐ │
│ │      Create Post        │ │          Live Preview          │ │
│ │ ═══════════════════════ │ │ ═══════════════════════════════ │ │
│ │                         │ │                                 │ │
│ │ Event Title *           │ │ ┌─────────────────────────────┐ │ │
│ │ ┌─────────────────────┐ │ │ │ 🎬 Derby Screening          │ │ │
│ │ │ Derby Screening     │ │ │ │ Man City vs Man United      │ │ │
│ │ └─────────────────────┘ │ │ │ This Saturday 3:00 PM       │ │ │
│ │ 42/50 characters        │ │ │ Free pint for survivors     │ │ │
│ │                         │ │ │                             │ │ │
│ │ Event Description       │ │ │         [Book Table]        │ │ │
│ │ ┌─────────────────────┐ │ │ └─────────────────────────────┘ │ │
│ │ │ Man City vs Man     │ │ │                                 │ │
│ │ │ United              │ │ │                                 │ │
│ │ └─────────────────────┘ │ │                                 │ │
│ │ 23/200 characters       │ │                                 │ │
│ │                         │ │                                 │ │
│ │ Event Date & Time *     │ │                                 │ │
│ │ ┌─────────┬─────────┐   │ │                                 │ │
│ │ │ 2025-01-│ 15:00   │   │ │                                 │ │
│ │ │ 25      │         │   │ │                                 │ │
│ │ └─────────┴─────────┘   │ │                                 │ │
│ │                         │ │                                 │ │
│ │ Special Offer           │ │                                 │ │
│ │ ┌─────────────────────┐ │ │                                 │ │
│ │ │ Free pint for       │ │ │                                 │ │
│ │ │ survivors           │ │ │                                 │ │
│ │ └─────────────────────┘ │ │                                 │ │
│ │ 21/150 characters       │ │                                 │ │
│ │                         │ │                                 │ │
│ │ Call to Action          │ │                                 │ │
│ │ ┌─────────────────────┐ │ │                                 │ │
│ │ │ Book Table          │ │ │                                 │ │
│ │ └─────────────────────┘ │ │                                 │ │
│ │                         │ │                                 │ │
│ │ Booking URL (optional)  │ │                                 │ │
│ │ ┌─────────────────────┐ │ │                                 │ │
│ │ │ https://crown-anch..│ │ │                                 │ │
│ │ └─────────────────────┘ │ │                                 │ │
│ │                         │ │                                 │ │
│ └─────────────────────────┘ │                                 │ │
│                             │                                 │ │
│ [Cancel]      [Publish Now] │                                 │ │
│                             │                                 │ │
│                             └─────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

**Design Notes:**
- **Split Layout**: Form on left, live preview on right
- **Real-time Preview**: Updates as user types
- **Character Counters**: Helps users optimize content length
- **Template Intelligence**: Smart field labels and placeholders
- **Progressive Disclosure**: Optional fields clearly marked

### 1.4 Post Analytics Modal

**Context**: User clicks analytics icon (📊) on an active post

```
┌─────────────────────────────────────────────────────────────────┐
│                    Derby Screening Analytics                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ 📅 Published: 3 days ago (Jan 22, 2025)                        │
│ 🔄 Last updated: Yesterday                                      │
│ ⏰ Expires: In 4 days                                          │
│                                                                 │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │                     📊 Performance                          │ │
│ │ ═══════════════════════════════════════════════════════════ │ │
│ │                                                             │ │
│ │ 👁️ Total Views: 47                                          │ │
│ │ └── Competition dashboard visits by players                  │ │
│ │                                                             │ │
│ │ 👆 Total Clicks: 12                                         │ │
│ │ └── Players who clicked "Book Table" button                 │ │
│ │                                                             │ │
│ │ 📱 Conversions: 3 bookings                                  │ │
│ │ └── External site visits that led to actions                │ │
│ │                                                             │ │
│ │ 📈 Click Rate: 25.5%                                        │ │
│ │ └── Above average for event promotions (18%)                │ │
│ │                                                             │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │                    🎯 Best Performance                      │ │
│ │ ═══════════════════════════════════════════════════════════ │ │
│ │                                                             │ │
│ │ ⏰ Peak Time: Saturday 2:00-4:00 PM                         │ │
│ │ 👥 Top Audience: Round 8 survivors                          │ │
│ │ 📱 Device: 73% mobile, 27% desktop                          │ │
│ │                                                             │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │                     💡 Insights                             │ │
│ │ ═══════════════════════════════════════════════════════════ │ │
│ │                                                             │ │
│ │ • Post performed 42% better than average                    │ │
│ │ • "Free pint" offer drove highest engagement                │ │
│ │ • Saturday timing aligned perfectly with game activity      │ │
│ │ • Consider similar offers for future events                 │ │
│ │                                                             │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│                              [Close]                            │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Design Notes:**
- **Simple Metrics**: Focus on actionable data, not vanity metrics
- **Context Provided**: Explains what each metric means
- **Benchmarking**: Compares performance to averages
- **Actionable Insights**: AI-generated suggestions for improvement
- **Clean Hierarchy**: Information grouped logically

---

## 2. PLAYER INTERFACES

### 2.1 Enhanced Game Dashboard - Marketing Content Present

**Context**: Player accesses competition dashboard, marketing posts are active

```
┌─────────────────────────────────────────────────────────────────┐
│ ← Dashboard         Premier League LMS            The Crown & Anchor │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ Weekly Last Man Standing competition every Saturday             │
│                                                                 │
│ Prize Pool    Entry Fee         Organized by                    │
│ £500          £10               Dave Thompson                    │
│                                                                 │
│ Rules: Pick one team per round. Win or draw = advance.          │
│ Loss = elimination.                                             │
│                                                                 │
├─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─┤
│                     🏟️ What's On at The Crown & Anchor         │
├─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─┤
│                                                                 │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ 🎬 Derby Screening                         [Book Table] 🔗   │ │
│ │ Man City vs Man United • This Saturday 3:00 PM              │ │
│ │ 🍺 Free pint for survivors                                   │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ 🎤 Quiz Night Tonight                           [Book] 🔗    │ │
│ │ Tuesday 8:00 PM • Double points for players                 │ │
│ │ 🚀 Skip the queue                                            │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│ ✅ Your Status: Still In                                        │
│                                                                 │
│                              Round 8                            │
│                       Pick your team to continue                │
│                                                                 │
│              12              8              156                 │
│           Still In      Eliminated        Started               │
│                                                                 │
│ ┌───────────────────────┐  ┌───────────────────────────────────┐ │
│ │         ▶️             │  │             🏆                   │ │
│ │    Make Pick          │  │         Standings                │ │
│ │     Round 8           │  │      View leaderboard            │ │
│ └───────────────────────┘  └───────────────────────────────────┘ │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Design Notes:**
- **Subtle Separation**: Dotted borders clearly separate marketing from game content
- **Visual Hierarchy**: Marketing section has distinct styling but doesn't dominate
- **Contextual Branding**: "What's On at [Venue Name]" personalizes the section
- **CTA Clarity**: External link indicators (🔗) show when actions leave the platform
- **Game Priority**: Core game content remains visually dominant and unchanged

### 2.2 Vanilla Game Dashboard - No Marketing Content

**Context**: Free tier competition or no active marketing posts

```
┌─────────────────────────────────────────────────────────────────┐
│ ← Dashboard         Premier League LMS              Local League │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ Weekly Last Man Standing competition every Saturday             │
│                                                                 │
│ Prize Pool    Entry Fee         Organized by                    │
│ £500          £10               Dave Thompson                    │
│                                                                 │
│ Rules: Pick one team per round. Win or draw = advance.          │
│ Loss = elimination.                                             │
│                                                                 │
│ ✅ Your Status: Still In                                        │
│                                                                 │
│                              Round 8                            │
│                       Pick your team to continue                │
│                                                                 │
│              12              8              156                 │
│           Still In      Eliminated        Started               │
│                                                                 │
│ ┌───────────────────────┐  ┌───────────────────────────────────┐ │
│ │         ▶️             │  │             🏆                   │ │
│ │    Make Pick          │  │         Standings                │ │
│ │     Round 8           │  │      View leaderboard            │ │
│ └───────────────────────┘  └───────────────────────────────────┘ │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Design Notes:**
- **Identical Layout**: Game elements in exactly same positions
- **No Missing Elements**: Marketing section simply not present (not collapsed/hidden)
- **Clean Experience**: No visual artifacts or placeholders suggesting missing content
- **Performance**: Faster loading without marketing API calls

### 2.3 Marketing Interaction Modal - Offer Code

**Context**: Player clicks on "Free pint for survivors" post

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│                                                                 │
│                     🍺 Free Pint for Survivors                  │
│                                                                 │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │                                                             │ │
│ │          Show this code at the bar to claim:                │ │
│ │                                                             │ │
│ │                     ┌─────────────────┐                     │ │
│ │                     │   CROWN2025     │                     │ │
│ │                     └─────────────────┘                     │ │
│ │                                                             │ │
│ │                     [Copy Code] 📋                          │ │
│ │                                                             │ │
│ │ ┌─────────────────────────────────────────────────────────┐ │ │
│ │ │ ℹ️ Valid for players still in the competition           │ │ │
│ │ │   Show your player dashboard as proof                   │ │ │
│ │ │   Offer expires: End of Round 10                       │ │ │
│ │ └─────────────────────────────────────────────────────────┘ │ │
│ │                                                             │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ 📍 The Crown & Anchor                                       │ │
│ │    123 High Street, Manchester                              │ │
│ │    📞 0161 123 4567                                         │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│                            [Got It!]                            │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Design Notes:**
- **Clear Value Proposition**: Prominent code display with copy function
- **Usage Instructions**: Clear guidance on how to redeem offer
- **Verification Method**: Links offer to player status for pub staff verification
- **Contact Information**: Easy access to venue details
- **Simple Dismissal**: Single action to close and return to game

### 2.4 Mobile Marketing Content Display

**Context**: Player accessing competition on mobile device

```
┌─────────────────────────────────┐
│ ← Premier League LMS    Crown&A │
├─────────────────────────────────┤
│ Weekly LMS • Saturday           │
│ £500 Prize • £10 Entry          │
│ Organized by Dave Thompson      │
│                                 │
├ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┤
│ 🏟️ What's On Here              │
├ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┤
│                                 │
│ ┌─────────────────────────────┐ │
│ │ 🎬 Derby Screening          │ │
│ │ Man City vs Man United      │ │
│ │ Sat 3PM • Free pint        │ │
│ │        [Book Table]         │ │
│ └─────────────────────────────┘ │
│                                 │
│ ┌─────────────────────────────┐ │
│ │ 🎤 Quiz Tonight            │ │
│ │ 8PM • Double points        │ │
│ │        [Book]              │ │
│ └─────────────────────────────┘ │
│                                 │
├─────────────────────────────────┤
│ ✅ Status: Still In             │
│                                 │
│           Round 8               │
│    Pick your team to continue   │
│                                 │
│    12      8       156         │
│ Still In  Out   Started        │
│                                 │
│ ┌─────────────┬─────────────────┐ │
│ │    ▶️       │      🏆        │ │
│ │ Make Pick   │   Standings    │ │
│ └─────────────┴─────────────────┘ │
└─────────────────────────────────┘
```

**Design Notes:**
- **Stacked Layout**: Mobile-first responsive design
- **Condensed Content**: Essential information only, optimized for small screens
- **Touch-Friendly**: Large, tappable CTAs
- **Preserved Hierarchy**: Marketing still clearly separated from game content

---

## 3. SUBSCRIPTION & ACCESS CONTROL INTERFACES

### 3.1 Free Tier Upgrade Prompt

**Context**: Free tier user browsing competition features

```
┌─────────────────────────────────────────────────────────────────┐
│                        Unlock Marketing Toolkit                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ 🚀 Ready to turn your competition into a customer magnet?       │
│                                                                 │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │                  Starter Plan - £29/month                   │ │
│ │ ═══════════════════════════════════════════════════════════ │ │
│ │                                                             │ │
│ │ ✅ Marketing Posts (4 simultaneous)                         │ │
│ │ ✅ Event Promotion Templates                                │ │
│ │ ✅ Special Offer Creation                                   │ │
│ │ ✅ Basic Analytics & Insights                               │ │
│ │ ✅ QR Codes & Social Sharing                                │ │
│ │ ✅ Custom Branding                                          │ │
│ │ ✅ Up to 50 Players                                         │ │
│ │ ✅ Unlimited Competitions                                   │ │
│ │                                                             │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│ 💬 "Since adding marketing posts, our quiz night bookings       │
│    have doubled. Players love the exclusive offers!"           │
│    - Sarah, The Fox & Hounds                                   │ │
│                                                                 │
│ [View Full Pricing] or [Upgrade to Starter - £29/month]        │
│                                                                 │
│                           [Maybe Later]                         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Design Notes:**
- **Value-First Messaging**: Focuses on business outcomes, not features
- **Social Proof**: Real testimonial builds credibility
- **Clear Pricing**: No hidden costs or surprises
- **Easy Exit**: Non-pushy "Maybe Later" option
- **Feature Bundling**: Shows marketing as part of comprehensive Starter package

### 3.2 Subscription Expiry Warning

**Context**: Starter subscriber with failed payment or approaching cancellation

```
┌─────────────────────────────────────────────────────────────────┐
│ ⚠️ Marketing Features Expire in 3 Days                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ Your Starter subscription payment is overdue. In 3 days:        │
│                                                                 │
│ ❌ Marketing posts will become invisible to players             │
│ ❌ Post creation tools will be disabled                         │
│ ❌ Analytics will stop updating                                 │
│ ✅ Your posts and data will be safely preserved                 │
│                                                                 │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ You currently have 3 active marketing posts:                │ │
│ │ • Derby Screening (47 views, 12 clicks)                     │ │
│ │ • Free Pint for Survivors (31 views, 8 clicks)              │ │
│ │ • Quiz Night Tonight (19 views, 3 bookings)                 │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│ Don't lose this valuable connection with your players!          │
│                                                                 │
│ [Update Payment Method] or [Contact Support]                   │
│                                                                 │
│                          [Review Later]                         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Design Notes:**
- **Clear Timeline**: Specific expiry date creates urgency without panic
- **Loss Framing**: Shows what will be lost to motivate action
- **Preservation Assurance**: Reduces fear of permanent data loss
- **Current Value Display**: Reminds user of active post performance
- **Support Option**: Provides help for payment issues

---

## 4. RESPONSIVE DESIGN SPECIFICATIONS

### 4.1 Breakpoint Strategy

```
Mobile First Approach:

📱 Mobile (320px - 768px):
  - Single column layout
  - Stacked marketing posts
  - Condensed form fields
  - Large touch targets (44px min)

📟 Tablet (768px - 1024px):
  - Two-column layout where appropriate
  - Side-by-side form and preview
  - Maintained readability
  - Optimized for landscape orientation

💻 Desktop (1024px+):
  - Full feature layout
  - Split-screen creation interface
  - Enhanced analytics displays
  - Multiple post preview modes
```

### 4.2 Accessibility Considerations

```
WCAG 2.1 AA Compliance:

🎯 Focus Management:
  - Clear tab order through forms
  - Visible focus indicators
  - Skip links for marketing sections

🎨 Color & Contrast:
  - 4.5:1 minimum contrast ratios
  - Color not sole indicator of meaning
  - High contrast mode support

🔊 Screen Reader Support:
  - Semantic HTML structure
  - ARIA labels for complex widgets
  - Alternative text for icons
  - Form field descriptions

⌨️ Keyboard Navigation:
  - All features keyboard accessible
  - Logical tab sequences
  - Escape key closes modals
```

---

## 5. DESIGN SYSTEM INTEGRATION

### 5.1 Color Palette Extension

```
Existing LMSLocal Colors:
- Primary: Slate-900 (#0f172a)
- Secondary: Slate-600 (#475569)
- Success: Green-600 (#16a34a)
- Background: Slate-50 (#f8fafc)

Marketing Feature Colors:
- Marketing Accent: Emerald-500 (#10b981) - for CTA buttons
- Marketing Background: Emerald-50 (#ecfdf5) - for post cards
- Analytics: Blue-500 (#3b82f6) - for metrics
- Warning: Amber-500 (#f59e0b) - for expiry notices
```

### 5.2 Typography Hierarchy

```
Marketing Content:
- Post Titles: text-lg font-semibold (18px, 600 weight)
- Post Description: text-sm text-slate-600 (14px, regular)
- CTA Buttons: text-sm font-medium (14px, 500 weight)
- Analytics: text-xs text-slate-500 (12px, regular)

Form Elements:
- Field Labels: text-sm font-medium (14px, 500 weight)
- Field Values: text-base (16px, regular)
- Character Counts: text-xs text-slate-400 (12px, regular)
- Help Text: text-sm text-slate-500 (14px, regular)
```

### 5.3 Animation & Micro-interactions

```
Performance-First Animations:

Modal Transitions:
- Fade in: 150ms ease-out
- Slide up: 200ms ease-out
- No complex transforms on mobile

Form Feedback:
- Success states: 300ms green flash
- Error states: Gentle red border pulse
- Loading states: Skeleton placeholders

Post Interactions:
- Hover effects: 150ms ease
- Click feedback: Scale 0.98 for 100ms
- CTA button: Subtle shadow elevation
```

---

## 6. IMPLEMENTATION PRIORITIES

### Phase 1: Core Display (Week 1-2)
1. **Marketing posts tab** in competition dashboard
2. **Basic post display** in player dashboard
3. **Simple post creation** form (one template)
4. **Subscription access control**

### Phase 2: Full Creation Flow (Week 3-4)
5. **Template selection** modal
6. **All three templates** with validation
7. **Live preview** functionality
8. **Post management** (edit, pause, delete)

### Phase 3: Analytics & Polish (Week 5-6)
9. **Basic analytics** modal
10. **Mobile responsive** optimization
11. **Accessibility** implementation
12. **Performance** optimization

This interface design creates a premium, professional experience that justifies the £29/month Starter tier pricing while maintaining the simplicity needed for pub managers to create effective marketing content quickly.