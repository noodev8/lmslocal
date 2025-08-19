# Dashboard Layout Specifications

This document defines the authenticated user dashboard layouts for each persona, supporting post-login experiences and ongoing platform usage.

## Layout Architecture

### Responsive Dashboard Framework
```
┌─────────────────────────────────────────────────────┐
│ AppHeader (Global Navigation)                       │
├─────────────────────────────────────────────────────┤
│ ┌─────────────┐ ┌─────────────────────────────────┐ │
│ │ SideNav     │ │ Main Content Area               │ │
│ │ (Contextual)│ │                                 │ │
│ │             │ │ ┌─────────────────────────────┐ │ │
│ │             │ │ │ Page Header + Actions       │ │ │
│ │             │ │ ├─────────────────────────────┤ │ │
│ │             │ │ │ Dashboard Grid/Content      │ │ │
│ │             │ │ │                             │ │ │
│ │             │ │ │                             │ │ │
│ │             │ │ └─────────────────────────────┘ │ │
│ └─────────────┘ └─────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
```

### Mobile Responsive Behavior
```
Mobile (xs-sm):
- SideNav becomes drawer (hamburger menu)
- Single column content
- Simplified actions
- Bottom navigation for quick access

Desktop (md+):
- Fixed sidebar navigation
- Multi-column dashboard grids
- Rich interactions and hover states
- Detailed information density
```

## Admin/Organizer Dashboard

### First-Time User (Setup State)
```
┌─────────────────────────────────────────────────────┐
│ AppHeader: "Welcome, [Name]" | Settings | Logout    │
├─────────────────────────────────────────────────────┤
│ ┌─────────┐ ┌─────────────────────────────────────┐ │
│ │Setup    │ │ 🎯 Create Your First Competition    │ │
│ │Steps    │ │                                     │ │
│ │         │ │ ┌─────────────────────────────────┐ │ │
│ │☑️ Account│ │ │ Quick Start                     │ │ │
│ │☐ First │ │ │                                 │ │ │
│ │  Comp   │ │ │ Competition Name: [_________]   │ │ │
│ │☐ Invite │ │ │ Entry Fee: [____] (optional)   │ │ │
│ │  Players│ │ │ Max Players: [____]            │ │ │
│ │☐ Launch │ │ │                                 │ │ │
│ │         │ │ │ [Advanced Setup] [Create Now]   │ │ │
│ │         │ │ └─────────────────────────────────┘ │ │
│ │         │ │                                     │ │
│ │         │ │ 📺 How to Setup (2min video)        │ │
│ │         │ │ 📋 Sample Competition Templates     │ │
│ └─────────┘ └─────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
```

### Active Organizer Dashboard
```
┌─────────────────────────────────────────────────────┐
│ AppHeader: Competitions | Players | Settings        │
├─────────────────────────────────────────────────────┤
│ ┌─────────┐ ┌─────────────────────────────────────┐ │
│ │Quick    │ │ Dashboard Overview                  │ │
│ │Actions  │ │                                     │ │
│ │         │ │ ┌─────────┬─────────┬─────────────┐ │ │
│ │📝 Create│ │ │Active   │Players  │Revenue      │ │ │
│ │  New    │ │ │Comps: 3 │Total: 47│This Month   │ │ │
│ │⚡ Quick │ │ │         │Active:39│£580         │ │ │
│ │  Entry  │ │ └─────────┴─────────┴─────────────┘ │ │
│ │📊 Results│ │                                    │ │
│ │🔒 Lock   │ │ Active Competitions                │ │
│ │  Round  │ │                                     │ │
│ │         │ │ ┌─────────────────────────────────┐ │ │
│ │         │ │ │🏆 Premier League LMS            │ │ │
│ │         │ │ │Round 8 | 12/24 picks | 🔓Open  │ │ │
│ │         │ │ │⏰ Locks in 2d 4h               │ │ │
│ │         │ │ │[View Details] [Enter Picks]    │ │ │
│ │         │ │ └─────────────────────────────────┘ │ │
│ │         │ │                                     │ │
│ │         │ │ ┌─────────────────────────────────┐ │ │
│ │         │ │ │⚽ Office League                 │ │ │
│ │         │ │ │Round 12 | 8/15 picks | 🔒Locked│ │ │
│ │         │ │ │⏱️ Results pending               │ │ │
│ │         │ │ │[Enter Results] [View Standings] │ │ │
│ │         │ │ └─────────────────────────────────┘ │ │
│ └─────────┘ └─────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
```

### Competition Management Detail View
```
┌─────────────────────────────────────────────────────┐
│ AppHeader | Breadcrumbs: Dashboard > Premier League │
├─────────────────────────────────────────────────────┤
│ ┌─────────┐ ┌─────────────────────────────────────┐ │
│ │Comp     │ │ Premier League LMS                  │ │
│ │Actions  │ │ Round 8 of 38 | 12/24 players left │ │
│ │         │ │                                     │ │
│ │🔒 Lock  │ │ ┌─────────────────────────────────┐ │ │
│ │  Round  │ │ │Pick Deadline: Sat 14:00 GMT    │ │ │
│ │📝 Enter │ │ │⏰ 2 days, 4 hours remaining     │ │ │
│ │  Picks  │ │ │                                 │ │ │
│ │📊 Results│ │ │Picks Status:                    │ │ │
│ │👥 Manage│ │ │✅ Submitted: 18/24              │ │ │
│ │  Players│ │ │⏳ Pending: 6/24                │ │ │
│ │📈 Stats │ │ │[Send Reminders] [View All]     │ │ │
│ │         │ │ └─────────────────────────────────┘ │ │
│ │         │ │                                     │ │
│ │         │ │ Round 8 Fixtures (Sat-Sun)         │ │
│ │         │ │                                     │ │
│ │         │ │ ┌─────────────────────────────────┐ │ │
│ │         │ │ │Arsenal vs Chelsea    | 7 picks  │ │ │
│ │         │ │ │Liverpool vs Man Utd  | 5 picks  │ │ │
│ │         │ │ │Man City vs Tottenham | 6 picks  │ │ │
│ │         │ │ │[View All Fixtures & Picks]     │ │ │
│ │         │ │ └─────────────────────────────────┘ │ │
│ └─────────┘ └─────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
```

## Player Dashboard

### Multi-Competition Player View
```
┌─────────────────────────────────────────────────────┐
│ AppHeader: Dashboard | History | Profile             │
├─────────────────────────────────────────────────────┤
│ ┌─────────┐ ┌─────────────────────────────────────┐ │
│ │Quick    │ │ My Competitions                     │ │
│ │Stats    │ │                                     │ │
│ │         │ │ ┌─────────┬─────────┬─────────────┐ │ │
│ │🏆 Active│ │ │Active   │Pending  │This Season  │ │ │
│ │   : 3   │ │ │Comps: 3 │Picks: 2 │W/L: 23/8   │ │ │
│ │⚡ Picks │ │ │         │         │Win%: 74%    │ │ │
│ │Due: 2   │ │ └─────────┴─────────┴─────────────┘ │ │
│ │🔥 Streak│ │                                     │ │
│ │   : 4W  │ │ 🚨 Picks Due Soon                  │ │
│ │         │ │                                     │ │
│ │         │ │ ┌─────────────────────────────────┐ │ │
│ │         │ │ │⚽ Premier League LMS            │ │ │
│ │         │ │ │Round 8 | You're IN | 1 life    │ │ │
│ │         │ │ │⏰ Pick due: 2d 4h               │ │ │
│ │         │ │ │[Make Pick Now] 🔴               │ │ │
│ │         │ │ └─────────────────────────────────┘ │ │
│ │         │ │                                     │ │
│ │         │ │ ┌─────────────────────────────────┐ │ │
│ │         │ │ │🏢 Office League                 │ │ │
│ │         │ │ │Round 12 | ELIMINATED            │ │ │
│ │         │ │ │📊 Finished 3rd of 15           │ │ │
│ │         │ │ │[View Final Standings]          │ │ │
│ │         │ │ └─────────────────────────────────┘ │ │
│ └─────────┘ └─────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
```

### Pick Submission View
```
┌─────────────────────────────────────────────────────┐
│ AppHeader | Breadcrumbs: Dashboard > Make Pick      │
├─────────────────────────────────────────────────────┤
│ ┌─────────┐ ┌─────────────────────────────────────┐ │
│ │Pick     │ │ Premier League LMS - Round 8        │ │
│ │Context  │ │ Pick Deadline: Sat 14:00 (2d 4h)   │ │
│ │         │ │                                     │ │
│ │🔴 1 Life│ │ ┌─────────────────────────────────┐ │ │
│ │   Left  │ │ │⚠️ Teams you can't pick again:   │ │ │
│ │         │ │ │Arsenal, Liverpool, Man City,    │ │ │
│ │📊 12/24 │ │ │Chelsea, Newcastle, Brighton     │ │ │
│ │Players  │ │ └─────────────────────────────────┘ │ │
│ │Left     │ │                                     │ │
│ │         │ │ Round 8 Fixtures - Choose ONE Team │ │
│ │🏆 Still │ │                                     │ │
│ │In It!   │ │ ┌─────────────────────────────────┐ │ │
│ │         │ │ │☐ Arsenal    vs Chelsea     ☐   │ │ │
│ │         │ │ │   (can't pick)  (can't pick)    │ │ │
│ │         │ │ └─────────────────────────────────┘ │ │
│ │         │ │ ┌─────────────────────────────────┐ │ │
│ │         │ │ │◯ Liverpool  vs Man Utd     ◉   │ │ │
│ │         │ │ │   (can't pick)  [SELECTED]      │ │ │
│ │         │ │ └─────────────────────────────────┘ │ │
│ │         │ │                                     │ │
│ │         │ │ ✅ Manchester United to WIN         │ │
│ │         │ │ [Confirm Pick] [Cancel]             │ │ │
│ └─────────┘ └─────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
```

## Pub Owner Dashboard

### Business Performance Dashboard
```
┌─────────────────────────────────────────────────────┐
│ AppHeader: Revenue | Competitions | Marketing       │
├─────────────────────────────────────────────────────┤
│ ┌─────────┐ ┌─────────────────────────────────────┐ │
│ │Business │ │ The Red Lion - Business Dashboard   │ │
│ │Tools    │ │                                     │ │
│ │         │ │ ┌─────────┬─────────┬─────────────┐ │ │
│ │📊 ROI   │ │ │This     │Active   │Total        │ │ │
│ │  Report │ │ │Month    │Players  │Revenue      │ │ │
│ │📈 Player│ │ │Revenue  │: 34     │YTD: £2,340  │ │ │
│ │  Growth │ │ │£480     │         │             │ │ │
│ │🎯 Market│ │ └─────────┴─────────┴─────────────┘ │ │
│ │  Kit    │ │                                     │ │
│ │📱 QR    │ │ 📈 Performance Insights             │ │
│ │  Codes  │ │                                     │ │
│ │         │ │ ┌─────────────────────────────────┐ │ │
│ │         │ │ │• 340% increase in Sunday        │ │ │
│ │         │ │ │  afternoon customers            │ │ │
│ │         │ │ │• Players spend avg £12 more     │ │ │
│ │         │ │ │  per visit during LMS           │ │ │
│ │         │ │ │• 67% of players are new         │ │ │
│ │         │ │ │  regulars since starting        │ │ │
│ │         │ │ └─────────────────────────────────┘ │ │
│ │         │ │                                     │ │
│ │         │ │ Current Competitions                │ │
│ │         │ │                                     │ │
│ │         │ │ ┌─────────────────────────────────┐ │ │
│ │         │ │ │🍺 Sunday League Special         │ │ │
│ │         │ │ │34 players | £5 entry | £170    │ │ │
│ │         │ │ │Round 8 | Picks due 2d 4h       │ │ │
│ │         │ │ │[Manage] [View Standings]       │ │ │
│ │         │ │ └─────────────────────────────────┘ │ │
│ └─────────┘ └─────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
```

### Marketing Tools Dashboard
```
┌─────────────────────────────────────────────────────┐
│ AppHeader | Breadcrumbs: Business > Marketing       │
├─────────────────────────────────────────────────────┤
│ ┌─────────┐ ┌─────────────────────────────────────┐ │
│ │Ready-   │ │ Marketing Toolkit                   │ │
│ │Made     │ │                                     │ │
│ │Assets   │ │ 📱 QR Codes & Table Tents          │ │
│ │         │ │                                     │ │
│ │📄 Flyers│ │ ┌─────────────────────────────────┐ │ │
│ │📱 Social│ │ │ [QR CODE]                       │ │ │
│ │📧 Email │ │ │                                 │ │ │
│ │📋 Table │ │ │ Join Our LMS Game!              │ │ │
│ │  Tents  │ │ │ Scan to join                    │ │ │
│ │🎪 Posters│ │ │                                │ │ │
│ │         │ │ │ [Download PDF] [Order Printed]  │ │ │
│ │         │ │ └─────────────────────────────────┘ │ │
│ │         │ │                                     │ │
│ │         │ │ 📧 Customer Email Templates         │ │
│ │         │ │                                     │ │
│ │         │ │ ┌─────────────────────────────────┐ │ │
│ │         │ │ │• "Join Our Football Competition"│ │ │
│ │         │ │ │• "This Week's LMS Picks"        │ │ │
│ │         │ │ │• "Competition Results"          │ │ │
│ │         │ │ │                                 │ │ │
│ │         │ │ │[Customize & Send]               │ │ │
│ │         │ │ └─────────────────────────────────┘ │ │
│ └─────────┘ └─────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
```

## Responsive Behavior

### Mobile Dashboard Adaptations

#### Mobile Navigation
```
┌─────────────────┐
│ ☰ LMS | [User] ↓│
├─────────────────┤
│ Dashboard       │
│ Quick Actions   │
│ ┌─────┬─────────┐│
│ │📝   │⚡ Quick ││
│ │New  │ Pick    ││
│ └─────┴─────────┘│
│                 │
│ Active Comps    │
│ ┌─────────────┐ │
│ │Comp Name    │ │
│ │Status Info  │ │
│ │[Action]     │ │
│ └─────────────┘ │
└─────────────────┘
```

#### Mobile Tab Navigation
```
Bottom Navigation:
┌─────┬─────┬─────┬─────┬─────┐
│🏠   │🏆   │👥   │📊   │⚙️   │
│Home │Comp │Play │Stats│Set  │
└─────┴─────┴─────┴─────┴─────┘
```

### Component Implementation

#### DashboardLayout Component
```tsx
interface DashboardLayoutProps {
  userRole: 'organizer' | 'player' | 'pub-owner';
  sidebar: React.ReactNode;
  children: React.ReactNode;
  pageTitle: string;
  actions?: React.ReactNode[];
}
// MUI: AppBar, Drawer, Container, Grid
```

#### DashboardCard Component  
```tsx
interface DashboardCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: React.ReactNode;
  trend?: 'up' | 'down' | 'neutral';
  action?: () => void;
}
// MUI: Card, CardContent, Typography, IconButton
```

#### QuickActions Component
```tsx
interface QuickActionsProps {
  actions: QuickAction[];
  variant: 'sidebar' | 'toolbar' | 'floating';
  onAction: (actionId: string) => void;
}
// MUI: SpeedDial, List, Button, Fab
```

## State Management

### Dashboard Data Flow
```typescript
// Global state: User context, active competitions
// Local state: Dashboard filters, view preferences
// Cache: Competition data, player stats
// Real-time: Pick deadlines, live scores
```

### Context-Aware UI
- Show relevant quick actions per user role
- Hide features based on subscription level
- Progressive disclosure for complex features
- Smart defaults based on usage patterns

## Implementation Priority

### Phase 1: Core Dashboards
1. Basic layout framework (AppHeader + Sidebar)
2. Admin dashboard with competition overview
3. Player dashboard with pick management
4. Essential responsive behavior

### Phase 2: Enhanced Features  
1. Pub owner business dashboard
2. Advanced quick actions
3. Real-time updates
4. Mobile bottom navigation

### Phase 3: Optimization
1. Performance optimization for large datasets
2. Advanced filtering and search
3. Customizable dashboard layouts
4. Analytics and reporting views

---

*These dashboard specifications provide the complete post-authentication user experience, tailored to each persona's workflow and business needs.*