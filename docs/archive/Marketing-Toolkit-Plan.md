# Marketing Toolkit for Organizers - Implementation Plan

## Vision

**Make organizers the heroes of their own competitions by giving them professional marketing tools that require zero design or copywriting skills.**

### Core Philosophy
LMS Local is a "marketing ammunition supplier" - we provide the content, graphics, and prompts that organizers can fire into their own channels (WhatsApp, Facebook, Messenger) to keep their competitions exciting and engaging.

### Success Metrics
- Organizer engagement rate (% using marketing features)
- Player retention (competitions with active marketing vs without)
- Competition growth (sign-ups after marketing pushes)
- Organizer satisfaction (feedback and repeat usage)

---

## Phase 1: Message Templates (MVP)
**Target: Week 1-2 | Goal: Quick wins with copy-paste content**

### Deliverables
1. **New Admin Dashboard Tab: "Promote"**
   - Add navigation item to admin competition view
   - Clean, action-oriented interface
   - Mobile-responsive design

2. **Template Categories**
   - Pre-Launch Templates (3 variations)
   - Weekly Round Updates (4 variations - casual, excited, dramatic, professional)
   - Pick Reminders (3 urgency levels)
   - Results Announcements (2 styles)
   - Elimination Alerts (dramatic + matter-of-fact)
   - Final Round Hype (2-3 variations)
   - Winner Announcements (celebratory templates)

3. **Smart Variable Replacement**
   Templates auto-fill with live competition data:
   - `[COMP_NAME]` - Competition name
   - `[ROUND_NUMBER]` - Current round
   - `[PLAYERS_REMAINING]` - Active player count
   - `[PLAYERS_ELIMINATED]` - This round eliminations
   - `[TOP_3_PLAYERS]` - Leaderboard leaders
   - `[PICK_DEADLINE]` - Lock time/date
   - `[JOIN_CODE]` - Competition code
   - `[JOIN_URL]` - Direct link

4. **Copy-to-Clipboard Functionality**
   - One-click copy button for each template
   - Visual feedback on copy success
   - "Last copied" timestamp tracker

### User Experience Flow
```
Admin Dashboard → "Promote" Tab → Select Template Category → Choose Template → Copy → Paste to WhatsApp/Facebook
```

### Example Templates

**Weekly Update - Excited Tone:**
```
🏆 ROUND [ROUND_NUMBER] UPDATE 🏆

Wow! [PLAYERS_ELIMINATED] players out this week!

Still standing: [PLAYERS_REMAINING] players

Top survivors:
👑 [TOP_3_PLAYERS]

⚽ Next round starts: [NEXT_ROUND_DATE]
⏰ Make your pick before [PICK_DEADLINE]

[JOIN_URL]
```

**Pick Reminder - Urgent:**
```
🚨 PICKS LOCK IN 1 HOUR! 🚨

[UNPICKED_COUNT] players still need to make their pick for Round [ROUND_NUMBER]!

Don't lose a life - pick now: [JOIN_URL]
```

---

## Phase 2: Visual Content Generator
**Target: Week 3-5 | Goal: Shareable graphics for social channels**

### Deliverables
1. **Leaderboard Image Generator**
   - Auto-generated image from current standings
   - Shows top 10 players with lives remaining
   - Competition branding (name, logo if provided)
   - Optimized for WhatsApp share (1080x1080px)
   - 3 design themes: Modern, Classic, Bold

2. **Round Results Card**
   - Visual summary of round outcomes
   - Players eliminated with dramatic design
   - Key stats (total eliminations, survivors, close calls)
   - Shareable format

3. **Next Fixtures Visual**
   - Upcoming fixtures as clean graphic
   - Better than text list in chat
   - Shows match times and pick deadline
   - Competition branding

4. **Competition Poster (Join Now)**
   - Eye-catching recruitment graphic
   - Includes QR code + join link
   - Prize pool info
   - Start date and key rules
   - Customizable color scheme

5. **Elimination Announcement**
   - Dramatic "ELIMINATED" graphic
   - List of players who fell this round
   - "X players down, Y remaining" headline

### Technical Implementation
- Server-side image generation using Canvas API or Sharp.js
- API endpoint: `/admin/generate-marketing-image`
- Image types: leaderboard, results, fixtures, poster, elimination
- Download as PNG with filename suggestion
- Optional: Direct share to WhatsApp Web

### User Experience Flow
```
Admin Dashboard → "Promote" Tab → "Graphics" Section → Select Image Type → Generate → Download/Share
```

---

## Phase 3: Smart Suggestions & Automation
**Target: Week 6-8 | Goal: Proactive engagement prompts**

### Deliverables
1. **Marketing Calendar Dashboard**
   - Visual timeline of suggested touchpoints
   - "Next suggested post" countdown
   - Post frequency recommendations (2-3x per round)

2. **Context-Aware Prompts**
   System detects key moments and suggests actions:
   - "Round starts in 24hrs - post a fixtures reminder?"
   - "Only 40% of players picked - send urgent reminder?"
   - "Close round completed - share dramatic results?"
   - "Haven't posted in 4 days - here's a standings update"

3. **Notification System**
   - Email digest to organizer
   - In-app notification badges
   - "Ready-to-share" content previews
   - One-click post from email

4. **Engagement Builders**
   - Rivalry generator: "John vs Sarah - both on last life!"
   - Fun facts: "3 players have never picked a London team"
   - Prediction prompts: "Who's your pick for survivor this round?"
   - Milestone celebrations: "Round 10 reached! Only 5 survivors!"

### Logic Rules
```
Suggested Actions:
- T-24hrs before round: Fixtures list + pick reminder
- T-2hrs before lock: Urgent pick reminder
- After lock: "Picks are in! X players chose [TEAM]"
- After results: Elimination announcement + leaderboard
- Mid-round (T+2 days): Standings update + engagement question
```

---

## Phase 4: Organizer Playbook & Resources
**Target: Week 9-10 | Goal: Education and empowerment**

### Deliverables
1. **Organizer Playbook (PDF + Web)**
   Comprehensive guide covering:
   - Week-by-week communication calendar
   - Best practices from successful competitions
   - Psychology of engagement (create drama, celebrate wins)
   - How to handle disputes and drama
   - Prize structure ideas
   - Growing your competition (referral tactics)

2. **Success Stories Section**
   - Case studies from real organizers
   - "John ran a 50-person pub comp - here's his strategy"
   - Quote testimonials
   - Screenshot examples of successful posts

3. **Video Tutorials (Future)**
   - How to use marketing features
   - Best practices for promotion
   - Setting up your first competition
   - Tips from experienced organizers

4. **Template Library Growth**
   - Community-contributed templates
   - Seasonal variations (Christmas, World Cup, etc.)
   - Personality-based templates (serious, funny, dramatic)

5. **Marketing Best Practices Guide**
   - Posting frequency recommendations
   - Best times to post
   - Engagement tactics
   - Building anticipation and drama
   - Keeping eliminated players interested

---

## Phase 5: Advanced Features (Future)
**Target: Month 3+ | Goal: Competition differentiation**

### Potential Enhancements
1. **Branded Graphics**
   - Upload competition logo
   - Custom color schemes
   - Pub/venue branding integration

2. **Multi-Channel Posting**
   - Direct post to Facebook groups (with auth)
   - WhatsApp Business API integration
   - Scheduled posts

3. **Player-Generated Content**
   - Share your pick cards
   - Survivor badges
   - Achievement unlocks

4. **Analytics Dashboard**
   - Track which marketing efforts drive engagement
   - Player activity after each post type
   - Optimal posting times for your audience

5. **Competition Highlights Reel**
   - End-of-season recap
   - Top moments compilation
   - Shareable video (future)

---

## Implementation Priority: MVP First

### MUST HAVE (Phase 1 - Launch Critical)
- Message templates with copy-to-clipboard
- Basic template categories (5-7 types)
- Smart variable replacement
- "Promote" tab in admin dashboard

### SHOULD HAVE (Phase 2 - High Value)
- Leaderboard image generator
- Results announcement graphic
- Competition poster with QR code

### NICE TO HAVE (Phase 3-4 - Growth Features)
- Smart suggestions and prompts
- Marketing calendar
- Organizer playbook
- Success stories section

### FUTURE EXPLORATION (Phase 5)
- Branded graphics with custom logos
- Multi-channel posting automation
- Analytics and insights

---

## Technical Architecture

### Frontend Changes
```
lmslocal-web/src/app/competition/[id]/admin/
└── promote/
    ├── page.tsx (main promote dashboard)
    ├── templates.tsx (message template component)
    ├── graphics.tsx (visual content component)
    └── suggestions.tsx (smart suggestions component)
```

### Backend Changes
```
lmslocal-server/routes/
├── get-marketing-templates.js
├── generate-marketing-image.js
├── get-marketing-suggestions.js
└── track-marketing-action.js (analytics)
```

### Database Changes
```sql
-- Track organizer marketing actions
CREATE TABLE marketing_actions (
  id SERIAL PRIMARY KEY,
  competition_id INTEGER REFERENCES competitions(id),
  organizer_id INTEGER REFERENCES app_user(id),
  action_type VARCHAR(50), -- 'copy_template', 'download_image', etc.
  template_id VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Store custom competition branding (Phase 5)
CREATE TABLE competition_branding (
  id SERIAL PRIMARY KEY,
  competition_id INTEGER REFERENCES competitions(id),
  logo_url TEXT,
  primary_color VARCHAR(7),
  secondary_color VARCHAR(7),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## Success Criteria

### Phase 1 Success
- 60%+ of organizers use at least one template
- Average 3+ template copies per competition
- Positive feedback from organizers
- Measurable increase in player engagement

### Phase 2 Success
- 40%+ of organizers download at least one graphic
- Graphics shared in external channels
- Competition growth correlates with visual content usage

### Phase 3 Success
- 30%+ of organizers follow marketing suggestions
- Reduced inactive competitions
- Higher player retention rates

### Overall Success
- Organizers feel empowered and professional
- Competitions stay active and engaging
- Word-of-mouth growth from successful organizers
- LMS Local becomes known for "making you look good"

---

## Key Messaging to Organizers

**"We do the work, you get the credit."**

- Professional content in 30 seconds
- No design skills needed
- No copywriting required
- Just copy, paste, and look like a pro

**"Keep your competition exciting without the effort."**

- Pre-written updates for every moment
- Shareable graphics that wow your group
- Smart reminders so you never forget
- Your players stay engaged, you stay in control

---

## Next Steps

1. Review and approve Phase 1 scope
2. Design UI mockups for "Promote" tab
3. Write initial template library (20-30 templates)
4. Build backend API for template delivery
5. Implement frontend with copy-to-clipboard
6. Beta test with 3-5 existing organizers
7. Iterate based on feedback
8. Launch Phase 1 to all users

---

## Questions to Resolve

- Should templates be editable before copying?
- Do we need template preview before copy?
- Should we track which templates are most popular?
- Do organizers want notification emails with ready content?
- Should eliminated players see "keep them engaged" messaging ideas?

---

## Progress Tracker

### Phase 1: Message Templates (MVP) - ✅ COMPLETE

**✅ Completed (All 19 Templates):**

**Infrastructure:**
- [x] New "Promote" tab in competition dashboard with colorful pill-based UI
- [x] Copy-to-clipboard functionality with visual feedback
- [x] Editable textarea (organizers can customize before copying)
- [x] Character counter for SMS/WhatsApp awareness
- [x] Smart variable replacement with live competition data
- [x] Context-aware template visibility (show only relevant templates)
- [x] Accurate next round fixture information (checks real fixtures or shows "coming soon")
- [x] Dual URL strategy (join_url for pre-launch, game_url for active competitions)
- [x] Tone-based color coding (casual, excited, dramatic, professional, gentle, urgent, critical)

**Wave 1 Templates (10):**
- [x] Pre-Launch Templates (3) - Simple, Detailed, Exciting
- [x] Pick Reminders (3) - Gentle, Urgent, Critical
- [x] Weekly Round Updates (4) - Casual, Excited, Dramatic, Professional

**Wave 2 Templates (9):**
- [x] Results Announcements (2) - Casual, Professional
- [x] Elimination Alerts (2) - Dramatic, Matter-of-Fact
- [x] Final Round Hype (3) - Excited, Dramatic, Professional
- [x] Winner Announcements (2) - Celebratory, Professional

**📊 Phase 1 Progress: 100% complete (19 total templates covering entire competition lifecycle)**

**🎯 Next Decision Point:**
Phase 1 complete! Options:
- Option A: Real-world validation with organizers
- Option B: Move to Phase 2 (Visual Content Generator)
- Option C: Add Phase 3 features (Smart Suggestions & Automation)

---

*Last Updated: 2025-10-20*
*Status: Phase 1 - COMPLETE ✅*
*Owner: LMS Local Team*
