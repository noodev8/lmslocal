-- LMSLocal Database Schema
-- PostgreSQL with TIMESTAMP WITH TIME ZONE and no foreign key constraints
-- Data integrity managed in application code

-- =============================================
-- CORE USER MANAGEMENT
-- =============================================

-- Users table (registered and managed players)
CREATE TABLE app_user (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255),
    phone VARCHAR(20),
    display_name VARCHAR(100) NOT NULL,
    password_hash VARCHAR(255), -- Future use, currently passwordless
    is_managed BOOLEAN DEFAULT false, -- Managed by organizer (no login capability)
    created_by_user_id INTEGER, -- Which organizer created this managed player
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_active_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    email_verified BOOLEAN DEFAULT FALSE,
    auth_token VARCHAR(255),
    auth_token_expires TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_app_user_email ON app_user(email);
CREATE INDEX idx_app_user_display_name ON app_user(display_name);
CREATE INDEX idx_app_user_auth_token ON app_user(auth_token);
CREATE INDEX idx_app_user_last_active ON app_user(last_active_at);
CREATE INDEX idx_app_user_managed ON app_user(is_managed, created_by_user_id);

-- =============================================
-- ORGANISATION & BILLING
-- =============================================

-- Organisations (pubs, workplaces, clubs)
CREATE TABLE organisation (
    id SERIAL PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    owner_user_id INTEGER NOT NULL, -- Links to app_user.id
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT true
);

CREATE INDEX idx_organisation_slug ON organisation(slug);
CREATE INDEX idx_organisation_owner ON organisation(owner_user_id);

-- Subscription management
CREATE TABLE subscription (
    id SERIAL PRIMARY KEY,
    organisation_id INTEGER NOT NULL, -- Links to organisation.id
    plan_type VARCHAR(50) NOT NULL, -- 'free', 'per_competition', 'monthly'
    status VARCHAR(50) NOT NULL, -- 'active', 'cancelled', 'expired'
    stripe_subscription_id VARCHAR(255),
    stripe_customer_id VARCHAR(255),
    current_period_start TIMESTAMP WITH TIME ZONE,
    current_period_end TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_subscription_org ON subscription(organisation_id);
CREATE INDEX idx_subscription_stripe ON subscription(stripe_subscription_id);
CREATE INDEX idx_subscription_status ON subscription(status);

-- =============================================
-- TEAM DATA MANAGEMENT
-- =============================================

-- Team lists (EPL 2025, Custom Rugby, etc.)
CREATE TABLE team_list (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    type VARCHAR(50) NOT NULL, -- 'epl', 'custom'
    season VARCHAR(20), -- '2025-26' for EPL
    organisation_id INTEGER, -- NULL for system lists (EPL), set for custom lists
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_team_list_type ON team_list(type);
CREATE INDEX idx_team_list_org ON team_list(organisation_id);
CREATE INDEX idx_team_list_season ON team_list(season);

-- Individual teams within a list
CREATE TABLE team (
    id SERIAL PRIMARY KEY,
    team_list_id INTEGER NOT NULL, -- Links to team_list.id
    name VARCHAR(100) NOT NULL,
    short_name VARCHAR(20),
    logo_url VARCHAR(500),
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_team_list ON team(team_list_id);
CREATE INDEX idx_team_name ON team(name);

-- =============================================
-- COMPETITION MANAGEMENT
-- =============================================

-- LMS Competitions
CREATE TABLE competition (
    id SERIAL PRIMARY KEY,
    organisation_id INTEGER NOT NULL, -- Links to organisation.id
    team_list_id INTEGER NOT NULL, -- Links to team_list.id
    name VARCHAR(200) NOT NULL,
    description TEXT,
    logo_url VARCHAR(500),
    status VARCHAR(50) NOT NULL DEFAULT 'setup', -- 'setup', 'active', 'locked', 'completed', 'paused'
    timezone VARCHAR(100) DEFAULT 'Europe/London',
    
    -- Rule Configuration Fields
    lives_per_player INTEGER DEFAULT 1, -- Number of lives each player starts with (0-5)
    no_team_twice BOOLEAN DEFAULT true, -- Players cannot pick same team twice
    lock_hours_before_kickoff INTEGER DEFAULT 1, -- Hours before earliest kickoff to lock picks
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    winner_user_id INTEGER -- Links to app_user.id when competition ends
);

CREATE INDEX idx_competition_org ON competition(organisation_id);
CREATE INDEX idx_competition_team_list ON competition(team_list_id);
CREATE INDEX idx_competition_status ON competition(status);
CREATE INDEX idx_competition_created ON competition(created_at);

-- User participation in competitions (junction table with status)
CREATE TABLE competition_user (
    id SERIAL PRIMARY KEY,
    competition_id INTEGER NOT NULL, -- Links to competition.id
    user_id INTEGER NOT NULL, -- Links to app_user.id
    role VARCHAR(50) NOT NULL, -- 'organizer', 'player', 'managed_player'
    status VARCHAR(50) NOT NULL DEFAULT 'active', -- 'active', 'eliminated', 'pending'
    lives_remaining INTEGER DEFAULT 1,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    eliminated_at TIMESTAMP WITH TIME ZONE,
    payment_status VARCHAR(50) DEFAULT 'unknown', -- 'paid', 'unpaid', 'unknown' (manual tracking)
    payment_notes TEXT,
    managed_by_user_id INTEGER -- Links to app_user.id (organizer who manages this player)
);

CREATE INDEX idx_comp_user_competition ON competition_user(competition_id);
CREATE INDEX idx_comp_user_user ON competition_user(user_id);
CREATE INDEX idx_comp_user_status ON competition_user(status);
CREATE INDEX idx_comp_user_role ON competition_user(role);
CREATE UNIQUE INDEX idx_comp_user_unique ON competition_user(competition_id, user_id);

-- =============================================
-- ROUNDS & FIXTURES
-- =============================================

-- Competition rounds (weekly fixtures)
CREATE TABLE round (
    id SERIAL PRIMARY KEY,
    competition_id INTEGER NOT NULL, -- Links to competition.id
    round_number INTEGER NOT NULL,
    name VARCHAR(100), -- 'Gameweek 1', 'Round 1', etc.
    status VARCHAR(50) NOT NULL DEFAULT 'open', -- 'open', 'locked', 'completed', 'void'
    lock_time TIMESTAMP WITH TIME ZONE,
    start_time TIMESTAMP WITH TIME ZONE,
    end_time TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_round_competition ON round(competition_id);
CREATE INDEX idx_round_number ON round(competition_id, round_number);
CREATE INDEX idx_round_status ON round(status);
CREATE INDEX idx_round_lock_time ON round(lock_time);

-- Individual fixtures within a round
CREATE TABLE fixture (
    id SERIAL PRIMARY KEY,
    round_id INTEGER NOT NULL, -- Links to round.id
    home_team_id INTEGER NOT NULL, -- Links to team.id
    away_team_id INTEGER NOT NULL, -- Links to team.id
    kickoff_time TIMESTAMP WITH TIME ZONE NOT NULL,
    home_score INTEGER,
    away_score INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_fixture_round ON fixture(round_id);
CREATE INDEX idx_fixture_teams ON fixture(home_team_id, away_team_id);
CREATE INDEX idx_fixture_kickoff ON fixture(kickoff_time);

-- =============================================
-- PICKS & RESULTS
-- =============================================

-- User picks for each round
CREATE TABLE pick (
    id SERIAL PRIMARY KEY,
    round_id INTEGER NOT NULL, -- Links to round.id
    user_id INTEGER NOT NULL, -- Links to app_user.id
    team_id INTEGER NOT NULL, -- Links to team.id (team picked to win)
    fixture_id INTEGER, -- Links to fixture.id (which match the pick is for)
    outcome VARCHAR(10), -- 'win', 'lose', 'void' (calculated after results)
    entered_by_user_id INTEGER, -- Links to app_user.id (NULL = self, otherwise organizer who entered)
    locked_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_pick_round ON pick(round_id);
CREATE INDEX idx_pick_user ON pick(user_id);
CREATE INDEX idx_pick_team ON pick(team_id);
CREATE INDEX idx_pick_fixture ON pick(fixture_id);
CREATE UNIQUE INDEX idx_pick_unique ON pick(round_id, user_id);

-- =============================================
-- INVITATIONS & ACCESS
-- =============================================

-- Competition invitations and join codes
CREATE TABLE invitation (
    id SERIAL PRIMARY KEY,
    competition_id INTEGER NOT NULL, -- Links to competition.id
    created_by_user_id INTEGER NOT NULL, -- Links to app_user.id (organizer)
    invite_code VARCHAR(20) UNIQUE NOT NULL,
    email VARCHAR(255), -- NULL for general codes, specific for email invites
    max_uses INTEGER DEFAULT 1, -- 0 = unlimited
    current_uses INTEGER DEFAULT 0,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    used_at TIMESTAMP WITH TIME ZONE,
    used_by_user_id INTEGER -- Links to app_user.id when used
);

CREATE INDEX idx_invitation_competition ON invitation(competition_id);
CREATE INDEX idx_invitation_code ON invitation(invite_code);
CREATE INDEX idx_invitation_email ON invitation(email);
CREATE INDEX idx_invitation_expires ON invitation(expires_at);

-- =============================================
-- AUDIT & COMPLIANCE
-- =============================================

-- Simple audit log for all admin actions
CREATE TABLE audit_log (
    id SERIAL PRIMARY KEY,
    competition_id INTEGER, -- Links to competition.id (NULL for org-level actions)
    user_id INTEGER NOT NULL, -- Links to app_user.id (who performed action)
    action TEXT NOT NULL, -- Description of what was done
    details TEXT, -- Any additional details as free text
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_audit_competition ON audit_log(competition_id);
CREATE INDEX idx_audit_user ON audit_log(user_id);
CREATE INDEX idx_audit_created ON audit_log(created_at);

-- =============================================
-- SYSTEM DATA & CONFIGURATION
-- =============================================

-- System-wide settings and feature flags
CREATE TABLE system_config (
    id SERIAL PRIMARY KEY,
    key VARCHAR(100) UNIQUE NOT NULL,
    value TEXT,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_system_config_key ON system_config(key);

-- =============================================
-- USER ANALYTICS
-- =============================================

-- User activity tracking (for engagement analytics)
CREATE TABLE user_activity (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL, -- Links to app_user.id
    competition_id INTEGER, -- Links to competition.id (NULL for general activities)
    details TEXT NOT NULL, -- Description of what happened
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_user_activity_user ON user_activity(user_id);
CREATE INDEX idx_user_activity_competition ON user_activity(competition_id);
CREATE INDEX idx_user_activity_created ON user_activity(created_at);