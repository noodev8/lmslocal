# LMSLocal Development Plan

## Platform Decision: Web-First Approach

**Primary Platform: Next.js Web Application**
- Faster MVP development cycle (no app store approval delays)
- Better suited for pub/workplace context (share link, no download required)
- Admin dashboards work better on web (complex tables, bulk operations)
- Guest player flow easier (no app download barrier)
- Cross-platform by default
- PWA capabilities for mobile-like experience

**Future: Flutter Mobile App (Phase 4)**
- After core business logic is proven
- Native mobile experience for frequent users

## Technical Architecture

### Backend Stack
- **Database:** PostgreSQL (ACID compliance for eliminations/billing)
- **Server:** Node.js + Express.js
- **Authentication:** JWT + passwordless email (Resend)
- **Payments:** Stripe integration

### Frontend Stack
- **Framework:** Next.js
- **Styling:** Tailwind CSS
- **Deployment:** TBD (likely Vercel for frontend, Railway/Render for backend)

## Database Schema Design

### Core Multi-Tenant Structure
```sql
Organizations (id, name, slug, created_at, updated_at)
  └── Subscriptions (id, org_id, plan_type, status, stripe_id, current_period_end)
  └── Competitions (id, org_id, name, status, team_list_id, rules_config, timezone)
      └── CompetitionUsers (comp_id, user_id, role, status, lives_remaining, eliminated_at)
      └── Rounds (id, comp_id, round_number, lock_time, start_time, status)
          └── Fixtures (id, round_id, home_team, away_team, result, kickoff_time)
          └── Picks (id, round_id, user_id, team_picked, locked_at, outcome)

-- Master Data
TeamLists (id, name, type) -- 'EPL_2025', 'CUSTOM_RUGBY', etc.
Teams (id, team_list_id, name, short_name, logo_url)

-- User Management
Users (id, email, phone, name, email_verified_at, last_login)
UserSessions (id, user_id, token, expires_at)

-- Audit & Communication
AuditLogs (id, comp_id, user_id, action, details, created_at)
Invitations (id, comp_id, code, email, expires_at, used_at)
```

### Key Design Principles
- **Multi-tenant architecture** at organization level
- **Flexible team lists** (EPL preset + custom options)
- **Role-based access** via CompetitionUsers junction table
- **Lives system** integrated into user competition status
- **Comprehensive audit trail** for all admin actions
- **Token-based authentication** (no password storage)

## Development Phases

### Phase 1: Foundation MVP (4-6 weeks)
**Goal:** Prove core concept with minimal viable features

**Weeks 1-2: Backend Foundation**
- Database schema creation + migrations
- Passwordless auth system (email via Resend)
- Core API structure (organizations, competitions, users)
- EPL 2025 team list seeded
- Basic CRUD operations

**Weeks 3-4: Core Business Logic**
- Competition creation workflow
- Player join functionality (link/code)
- Pick submission system
- Elimination engine with "no team twice" rule
- Basic round management

**Weeks 5-6: Basic Frontend**
- Next.js project setup with Tailwind
- Organizer dashboard (competition list, player status)
- Player interface (make picks, view status)
- Competition status/leaderboard view
- Responsive design fundamentals

**Phase 1 Scope Limitations:**
- ✅ Single EPL team list only
- ✅ Manual result entry only
- ✅ Basic elimination (1 life per player)
- ✅ Email authentication only
- ❌ No billing integration
- ❌ No admin override capabilities
- ❌ No bulk operations

### Phase 2: Essential Features (3-4 weeks)
**Goal:** Add critical business features for production readiness

- Configurable lives system (0-5 lives per competition)
- Admin override capabilities with mandatory audit logging
- Comprehensive invite management (bulk email, guest creation)
- Guest player creation and management
- Stripe subscription integration (£39/competition, £19/month)
- Enhanced UI/UX with proper loading states and error handling
- Email notifications for key events

### Phase 3: Scale & Polish (3-4 weeks)
**Goal:** Production-ready platform with advanced features

- Real-time updates (WebSocket for lock countdown, live status)
- Custom team list creation and management
- Clone & restart competition functionality
- Advanced notification system
- PWA capabilities for mobile users
- Performance optimization and caching
- Comprehensive testing suite

### Phase 4: Growth Features (Ongoing)
**Goal:** Platform expansion and enhancement

- Flutter mobile application
- Automated fixture integration (EPL API)
- Advanced analytics and reporting
- Multi-season tournament management
- White-label branding options
- API for third-party integrations

## Business Rules Implementation

### Core Game Logic
- **Pick Rules:** One team per player per round, no repeats within competition
- **Lock Mechanism:** All picks → admin-set time → 1hr before kickoff (priority order)
- **Elimination:** Win=continue, Draw/Loss=eliminated, Missed pick=life lost
- **Results:** 90-minute regulation time only (no extra time/penalties)
- **Timezone:** Competition-specific timezone (default: Europe/London)

### Admin Capabilities
- Manual result override with audit trail
- Player elimination/restoration
- Round void/replay functionality
- Kiosk entry for players (audited)
- Bulk player management

### Pricing Model
- Free tier: Up to 5 players per competition
- Paid tiers: £39 per competition OR £19/month subscription
- No payment processing for player entry fees (organizer responsibility)

## Risk Mitigation

### Technical Risks
- **Database Performance:** PostgreSQL chosen for complex queries and ACID compliance
- **Real-time Updates:** Plan for WebSocket implementation in Phase 3
- **Audit Requirements:** Comprehensive logging from Phase 1

### Business Risks
- **Scalability:** Multi-tenant architecture supports growth
- **Compliance:** Audit trails and clear disclaimers built-in
- **Competition:** Focus on pub/workplace niche with admin-friendly features

## Success Metrics

### Phase 1 (MVP)
- Successfully create and run a complete competition end-to-end
- Handle 20+ concurrent users per competition
- Zero data loss during elimination calculations

### Phase 2 (Production)
- Support 10+ concurrent competitions
- Process subscription payments reliably
- Admin override functionality working with full audit trail

### Phase 3 (Scale)
- Support 100+ concurrent competitions
- Real-time updates working smoothly
- Mobile-responsive PWA functionality

## Next Steps
1. **Set up development environment** (database, Node.js project structure)
2. **Create database schema** and initial migrations
3. **Build core authentication system** with Resend integration
4. **Implement basic API endpoints** for organizations and competitions
5. **Create simple frontend** for testing backend functionality

---

*This plan is living documentation and will evolve as we learn from each development phase.*