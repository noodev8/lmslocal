# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

LMSLocal is an admin-first platform for running Last-Man-Standing (LMS) competitions, designed for pub landlords, workplace organizers, and club managers. The system prioritizes the organizer experience, making it simple to set up, manage players, handle disputes, and keep competitions running smoothly.

## Development Commands

### Backend Server (lmslocal_server/)
```bash
cd lmslocal_server
npm start              # Start production server
npm run dev            # Start with nodemon for development
npm install           # Install dependencies
```

### Frontend Application (lmslocal_frontend/)
```bash
cd lmslocal_frontend
npm run dev           # Start Next.js development server (localhost:3000)
npm run build         # Build for production
npm start             # Start production server
npm install           # Install dependencies
```

### Testing Commands
```bash
# Backend API testing
cd lmslocal_server
node test_endpoints.js    # Test all API endpoints
node test_auth.js         # Test authentication flow

# Manual API testing examples
curl -X POST http://localhost:3015/api/health -H "Content-Type: application/json" -d "{}"
curl -X POST http://localhost:3015/api/auth/request-login -H "Content-Type: application/json" -d '{"email":"test@example.com"}'
```

## Current Implementation Status

### ✅ Completed Features
- **Authentication System**: JWT-based with magic link email authentication via Resend
- **Core API Endpoints**: Health, auth, organisation, user, competition CRUD operations
- **Frontend Foundation**: Next.js pages with working login flow and protected routes
- **Database Schema**: PostgreSQL with explicit rule columns (no JSONB)
- **Security**: Input validation, SQL injection protection, CORS configuration

### 🚧 Next Development Phase
- Competition creation wizard and management dashboard
- Join competition flow with invite codes
- Player role management and competition participation

### Core Game Mechanics
- Round-by-round elimination based on real fixtures (EPL 2025 initially)
- Players pick one team to win per round
- "No team twice" rule - cannot pick same team again in competition
- Lives system (configurable 0-5 lives, default 1)
- Lock mechanism: picks close when all submitted OR admin lock time OR 1hr before kickoff
- Results basis: 90-minute regulation time only (no extra time/penalties)

### Key Business Rules
- **Multi-tenant architecture** at organisation level
- **Managed players** for customers without smartphones/email (organizer-controlled)
- **Admin override powers** with comprehensive audit trail
- **Pricing**: Free ≤5 players, £39/competition OR £19/month for unlimited
- **Timezone**: Competition-specific (default Europe/London)

## Technical Architecture

### Backend Stack
- **Database**: PostgreSQL with TIMESTAMP WITH TIME ZONE
- **Server**: Node.js + Express.js (planned)
- **Authentication**: JWT + passwordless email via Resend
- **Payments**: Stripe integration

### Frontend Stack  
- **Framework**: Next.js (web-first approach)
- **Styling**: Tailwind CSS
- **Deployment**: TBD (likely Vercel frontend, Railway/Render backend)

### Database Schema Key Tables
- `app_user` - Users including managed players (`is_managed` flag)
- `organisation` - Multi-tenant structure
- `competition` - Individual competitions with explicit rule fields
- `competition_user` - Junction table with roles ('organizer', 'player', 'managed_player')
- `round` - Competition rounds with lock times
- `fixture` - Individual matches within rounds
- `pick` - User picks with `entered_by_user_id` for audit trail
- `audit_log` - Comprehensive logging for all admin actions

## Development Phases

### Phase 1: Foundation MVP (Current Focus)
**Scope**: Core business logic with EPL team list only
- Database schema + migrations
- Passwordless auth system
- Competition creation workflow
- Pick submission + elimination engine
- Basic Next.js frontend with Tailwind
- Manual result entry only
- Basic elimination (1 life per player)

**Limitations**: No billing, no admin overrides, no bulk operations

### Phase 2: Essential Features  
- Configurable lives system
- Admin override capabilities with audit logging
- Stripe subscription integration
- Guest/managed player system
- Enhanced UI/UX

### Phase 3: Scale & Polish
- Real-time updates (WebSocket)
- Custom team list creation
- PWA capabilities
- Performance optimization

### Phase 4: Growth Features
- Flutter mobile app
- Automated fixture integration (EPL API)
- Advanced analytics

## User Roles & Access Patterns

### Organizer (Primary User)
- Competition setup wizard
- Player management (invite, add managed players)
- Round management (lock times, result entry)
- Admin overrides with mandatory audit notes
- Kiosk entry for managed players

### Player (Secondary User)  
- Multi-competition dashboard
- Weekly pick submission
- View status/leaderboard
- Cannot pick same team twice

### Managed Player (Unique Feature)
- Created by organizer with display name only
- No login capability (`is_managed=true`)
- All picks entered by organizer
- Competition-scoped only
- Full audit trail via `entered_by_user_id`

## Critical System States

### Lock Mechanism Priority (in order)
1. All players have made picks → LOCK + show all picks
2. Admin-set lock time reached → LOCK + show all picks  
3. 1hr before earliest kickoff → LOCK + show all picks

### Competition States
- `setup` - Being configured
- `active` - Players can join/pick
- `locked` - Current round locked
- `completed` - Winner determined
- `paused` - Admin intervention required

### Player Elimination Logic
- **Win**: Continue to next round
- **Draw/Loss**: Eliminated immediately (or lose life if lives > 0)
- **Missed Pick**: Lose life (eliminated if 0 lives remaining)

## Data Integrity & Audit Requirements

### Audit Trail Requirements
All admin actions must be logged to `audit_log` table with:
- Description of action performed
- Optional details as free text
- User who performed the action
- Competition context (if applicable)

### Admin Override Capabilities
- Adjust match results with recalculation
- Eliminate/restore players
- Void rounds or specific fixtures
- Kiosk entry (pick on behalf of players)
- All actions audited

## Timezone & Scheduling

- All times stored as TIMESTAMP WITH TIME ZONE
- Competition-specific timezone (default 'Europe/London')
- Lock times calculated relative to competition timezone
- Kickoff times and deadlines respect competition timezone

## Development Notes

### Database Design Principles
- No foreign key constraints (integrity in application code)
- Explicit columns instead of JSONB for clarity
- Comprehensive indexing for performance
- Multi-tenant isolation at organisation level

### Security Considerations  
- Managed players cannot authenticate (security by design)
- JWT tokens for regular users only
- Audit trail for all sensitive operations
- Role-based access via `competition_user` junction table

### Performance Considerations
- User activity tracking for engagement analytics
- Indexed queries for common access patterns  
- Competition-scoped data isolation
- Real-time statistics calculated from source tables

## Future Mobile App Considerations

Phase 4 will introduce Flutter mobile app, but current web-first approach ensures:
- No app store approval delays for MVP
- Better suited for pub/workplace context
- Admin dashboards work better on web
- Guest player flow easier (no download barrier)
- PWA capabilities bridge to mobile experience