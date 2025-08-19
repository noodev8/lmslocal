# User Flow Diagrams - LMSLocal

This document outlines detailed user flows for each persona in the LMSLocal system, supporting the UI/UX planning strategy defined in UI-UX-Planning.txt.

## Overview

Based on our persona analysis, we have four distinct user types:
1. **Admin/Organizer** - Competition creators (primary revenue driver)
2. **Player** - Competition participants  
3. **Knowing Pub Owner** - Current LMS runners (conversion target)
4. **Unknown Pub Owner** - New potential customers

## Admin/Organizer User Flow

The Admin/Organizer represents our core user - they create competitions, manage players, and drive platform adoption.

```
🏠 LANDING PAGE
├─ "Run Your LMS Competition" CTA
├─ "Already organizing? Sign in" link
└─ Value props: Easy setup, Player management, Real-time tracking

📧 AUTHENTICATION FLOW
├─ Email entry form
├─ Magic link sent notification  
├─ Email verification
└─ JWT token + redirect to dashboard

🏡 DASHBOARD (First-time Admin)
├─ Welcome wizard trigger
├─ "Create Your First Competition" prominent CTA
├─ Quick stats: 0 competitions, 0 players
└─ Navigation: Competitions | Players | Settings | Billing

🎯 COMPETITION CREATION WIZARD
├─ Step 1: Basic Info
│   ├─ Competition name
│   ├─ Entry fee (optional)
│   ├─ Max players
│   └─ Start date selection
├─ Step 2: Rules Configuration  
│   ├─ Lives per player (1-5)
│   ├─ Lock timing preference
│   └─ Timezone selection
├─ Step 3: Player Invitation
│   ├─ Email invite list
│   ├─ Generate invite code
│   └─ Add managed players option
└─ Step 4: Review & Launch
    ├─ Competition summary
    ├─ Pricing confirmation
    └─ "Launch Competition" button

⚙️ ACTIVE COMPETITION MANAGEMENT
├─ Competition Dashboard
│   ├─ Current round status
│   ├─ Player pick summary
│   ├─ Lock countdown timer
│   └─ Quick actions bar
├─ Player Management
│   ├─ Add/remove players
│   ├─ Managed player picks entry
│   └─ Player status overview
├─ Round Management
│   ├─ Manual lock/unlock
│   ├─ Result entry interface
│   └─ Elimination confirmation
└─ Admin Tools
    ├─ Override picks/results
    ├─ Restore eliminated players
    └─ Audit log viewer
```

### Admin Key Decision Points
- **Entry Point**: Direct CTA vs general info first?
- **Wizard vs Single Form**: Multi-step for complexity management
- **Pricing Gates**: When to show subscription prompts?
- **Help Context**: Inline tips vs help center?

### Admin Critical Success Metrics
- Time from landing to competition created
- Wizard abandonment rate  
- First player invitation success rate
- Competition completion rate

## Player User Flow

Players are the secondary users but drive competition engagement and viral growth through invitations.

```
🏠 LANDING PAGE
├─ "Join a Competition" CTA  
├─ "Got an invite code?" quick entry
├─ "Already playing? Sign in" link
└─ Value props: Easy picks, Track progress, Win prizes

🎫 COMPETITION JOIN FLOW
├─ Entry Method A: Invite Code
│   ├─ Code entry form
│   ├─ Competition preview (name, rules, players)
│   ├─ Join confirmation
│   └─ Account creation prompt
├─ Entry Method B: Email Invitation
│   ├─ Magic link from email
│   ├─ Auto-competition context
│   └─ Account creation flow
└─ Entry Method C: Direct Share Link
    ├─ Competition landing page
    ├─ Join button (if open)
    └─ Account required gate

📧 AUTHENTICATION FLOW
├─ Email entry (pre-filled if from invite)
├─ Magic link sent notification
├─ Email verification
└─ JWT token + redirect to competition

🏆 PLAYER DASHBOARD (Multi-Competition View)
├─ Active Competitions Cards
│   ├─ Competition name & status
│   ├─ Current round info
│   ├─ Pick deadline countdown
│   └─ "Make Pick" CTA
├─ Quick Stats Summary
│   ├─ Total competitions
│   ├─ Active rounds requiring picks
│   └─ Overall W/L record
└─ Navigation: Dashboard | History | Profile

🎯 PICK SUBMISSION FLOW
├─ Competition Context
│   ├─ Round number & fixtures
│   ├─ Pick deadline timer
│   ├─ Lives remaining indicator
│   └─ Teams already picked (grayed out)
├─ Team Selection Interface
│   ├─ Fixture list with team options
│   ├─ Visual team picker (logos/names)
│   ├─ Pick validation (no repeats)
│   └─ Confidence indicator (optional)
├─ Pick Confirmation
│   ├─ Selected team display
│   ├─ "Cannot change after lock" warning
│   └─ Submit button
└─ Success State
    ├─ Pick confirmed message
    ├─ Next round countdown
    └─ Share/invite friends option

📊 COMPETITION STATUS VIEW
├─ Leaderboard/Standings
│   ├─ Player rankings
│   ├─ Lives remaining
│   └─ Current round status
├─ Round History
│   ├─ Previous picks & results
│   ├─ W/L progression
│   └─ Elimination timeline
├─ Competition Info
│   ├─ Rules reminder
│   ├─ Prize information
│   └─ Organizer contact
└─ Social Features
    ├─ Invite friends
    ├─ Competition chat (future)
    └─ Share achievements
```

### Player Journey States
- **New Player**: Invite → Join → First Pick
- **Active Player**: Weekly picks → Status check → Results  
- **Eliminated Player**: View results → Join new competitions
- **Multi-Competition Player**: Dashboard management → Context switching

### Player Critical Friction Points
- Account creation barrier vs guest flow
- Pick deadline pressure vs decision quality
- Team selection complexity (visual vs text)  
- Competition switching for multi-participants

### Player Success Metrics
- Invite-to-join conversion rate
- Pick submission completion rate
- Multi-competition participation rate
- Friend invitation frequency

## Cross-Flow Integration Points

### Shared Components
- Authentication system (magic links)
- Competition preview/summary cards
- Team selection interface
- Notification systems

### Role Switching Capabilities
- Player can become organizer (upgrade path)
- Organizer maintains player view for own competitions
- Seamless navigation between roles

### Technical Considerations
- Progressive enhancement for mobile-first design
- Real-time updates for pick deadlines and results
- Offline capability for pick submission
- Performance optimization for multi-competition dashboards

## Next Steps

1. **Landing Page Strategy**: Design persona-aware entry points
2. **Dashboard Architecture**: Plan role-based UI layouts  
3. **Material UI Components**: Define reusable component library
4. **User Testing**: Validate flow assumptions with target users
5. **Performance Metrics**: Implement tracking for success metrics

## Knowing Pub Owner User Flow

The Knowing Pub Owner already runs LMS manually and needs convincing to upgrade to our digital solution.

```
🏠 LANDING PAGE
├─ "Digitize Your LMS Game" CTA
├─ "Already running LMS? Upgrade here" 
├─ "See how pubs increase revenue" link
└─ Value props: Eliminate spreadsheets, Reduce admin time, Increase participation

💼 PUB OWNER QUALIFICATION FLOW
├─ Business Context Questions
│   ├─ "Currently running LMS?" (Yes/No)
│   ├─ "How many regular players?"
│   ├─ "Entry fee amount?"
│   └─ "Main pain points?" (multiple choice)
├─ ROI Calculator Display
│   ├─ Time saved per week
│   ├─ Potential player increase
│   ├─ Cost comparison vs manual
│   └─ Break-even analysis
└─ "Start Free Trial" CTA

📧 AUTHENTICATION + BUSINESS SETUP
├─ Pub/Business details form
│   ├─ Business name
│   ├─ Contact person
│   ├─ Player count estimate
│   └─ Current LMS experience level
├─ Magic link authentication
└─ Business profile creation

🏛️ PUB OWNER DASHBOARD
├─ Business Performance Overview
│   ├─ Revenue impact metrics
│   ├─ Player engagement stats
│   ├─ Time saved calculator
│   └─ Competition success rates
├─ Multi-Competition Management
│   ├─ Active competitions list
│   ├─ Seasonal scheduling
│   ├─ Player database across competitions
│   └─ Financial tracking (entry fees)
├─ Customer Acquisition Tools
│   ├─ QR codes for table tents
│   ├─ Social media assets
│   ├─ Email templates for regulars
│   └─ Referral tracking
└─ Business Features
    ├─ Branded competition pages
    ├─ Custom rules templates
    ├─ Bulk player import
    └─ Revenue reporting
```

### Knowing Pub Owner Key Points
- **Primary Pain Points**: Manual admin burden, calculation errors, player disputes
- **Conversion Triggers**: Time savings, professional appearance, reduced errors
- **Success Metrics**: Trial-to-paid conversion, setup completion rate, first competition launch

## Unknown Pub Owner User Flow

The Unknown Pub Owner has never run LMS and needs education on the concept and implementation support.

```
🏠 LANDING PAGE
├─ "What is Last Man Standing?" education
├─ "See How Pubs Use LMS" case studies
├─ "Try Our Calculator" ROI tool
└─ Value props: New revenue stream, Customer retention, Easy setup

📚 EDUCATION FLOW
├─ LMS Game Explanation
│   ├─ Interactive game demo
│   ├─ "How it works" video
│   ├─ Sample competition timeline
│   └─ Player testimonials
├─ Business Case Building
│   ├─ Revenue potential calculator
│   ├─ Pub industry statistics
│   ├─ Competitor success stories
│   └─ Customer retention benefits
├─ Implementation Confidence
│   ├─ "Week 1" setup checklist
│   ├─ Marketing templates provided
│   ├─ Player recruitment strategies
│   └─ Support commitment promise
└─ "Start Your First Competition" CTA

🧮 ROI CALCULATOR INTERACTION
├─ Pub Details Input
│   ├─ Typical weekend customers
│   ├─ Current customer retention
│   ├─ Average spend per visit
│   └─ Competitive activities offered
├─ LMS Impact Projection
│   ├─ Potential participants (%)
│   ├─ Entry fee suggestions
│   ├─ Visit frequency increase
│   └─ New customer attraction
├─ Results Dashboard
│   ├─ Weekly revenue potential
│   ├─ Annual revenue projection  
│   ├─ Customer lifetime value impact
│   └─ Break-even timeline
└─ "See Implementation Plan" CTA

📋 GUIDED SETUP FLOW
├─ Pre-Launch Checklist
│   ├─ Competition planning wizard
│   ├─ Marketing materials download
│   ├─ Staff training materials
│   └─ Customer communication templates
├─ Soft Launch Support
│   ├─ Test competition with staff
│   ├─ Feedback collection tools
│   ├─ Issue resolution hotline
│   └─ Success metrics tracking
└─ Full Launch Transition
    ├─ Customer competition launch
    ├─ Performance monitoring
    ├─ Optimization recommendations
    └─ Success celebration + case study
```

### Unknown Pub Owner Key Points
- **Primary Barriers**: Lack of LMS knowledge, implementation complexity fears, ROI uncertainty
- **Conversion Triggers**: Education, risk reduction, implementation support, proven ROI
- **Success Metrics**: Education completion rate, calculator engagement, setup wizard completion

## Flow Comparison Summary

| Aspect | Admin/Organizer | Player | Knowing Pub Owner | Unknown Pub Owner |
|--------|----------------|--------|------------------|------------------|
| **Entry Point** | Direct creation | Invitation-based | Upgrade focus | Education first |
| **Main Barrier** | Setup complexity | Account friction | Time investment | Knowledge gap |
| **Key Value** | Easy management | Fun participation | Efficiency gains | New revenue stream |
| **Success Metric** | Competition launched | Picks submitted | Trial conversion | Education → setup |
| **Support Need** | Feature guidance | Pick assistance | Migration help | Full implementation |

---

*This document should be updated as user flows are refined through testing and implementation.*