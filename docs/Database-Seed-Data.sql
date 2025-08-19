-- Database Seed Data
-- Initial data population for LMSLocal

-- =============================================
-- SYSTEM CONFIGURATION
-- =============================================

INSERT INTO system_config (key, value, description) VALUES
('app_version', '1.0.0', 'Current application version'),
('maintenance_mode', 'false', 'System maintenance mode toggle'),
('max_competitions_per_org', '50', 'Maximum competitions per organisation'),
('max_players_per_competition', '200', 'Maximum players per competition'),
('free_tier_player_limit', '5', 'Free tier player limit per competition'),
('default_competition_timezone', 'Europe/London', 'Default timezone for new competitions'),
('email_verification_required', 'true', 'Require email verification for new users'),
('pick_edit_window_hours', '1', 'Hours before kickoff when picks lock'),
('invite_code_length', '8', 'Length of generated invite codes'),
('auth_token_expiry_hours', '168', 'Auth token expiry in hours (7 days)');

-- =============================================
-- EPL 2025-26 TEAM LIST & TEAMS
-- =============================================

-- Create EPL 2025-26 team list
INSERT INTO team_list (name, type, season, organisation_id, is_active) VALUES
('English Premier League 2025-26', 'epl', '2025-26', NULL, true);

-- Get the team_list_id for EPL (will be 1 if this is first insert)
-- Note: In production, use RETURNING clause or application logic to get the ID

-- Insert EPL 2025-26 teams (assuming team_list_id = 1)
INSERT INTO team (team_list_id, name, short_name, sort_order, is_active) VALUES
(1, 'Arsenal', 'ARS', 1, true),
(1, 'Aston Villa', 'AVL', 2, true),
(1, 'Bournemouth', 'BOU', 3, true),
(1, 'Brentford', 'BRE', 4, true),
(1, 'Brighton & Hove Albion', 'BHA', 5, true),
(1, 'Chelsea', 'CHE', 6, true),
(1, 'Crystal Palace', 'CRY', 7, true),
(1, 'Everton', 'EVE', 8, true),
(1, 'Fulham', 'FUL', 9, true),
(1, 'Sunderland', 'SUN', 10, true),
(1, 'Burnley', 'BUR', 11, true),
(1, 'Liverpool', 'LIV', 12, true),
(1, 'Manchester City', 'MCI', 13, true),
(1, 'Manchester United', 'MUN', 14, true),
(1, 'Newcastle United', 'NEW', 15, true),
(1, 'Nottingham Forest', 'NFO', 16, true),
(1, 'Leeds', 'LEE', 17, true),
(1, 'Tottenham Hotspur', 'TOT', 18, true),
(1, 'West Ham United', 'WHU', 19, true),
(1, 'Wolverhampton Wanderers', 'WOL', 20, true);

-- =============================================
-- SAMPLE DATA FOR DEVELOPMENT
-- =============================================

-- Sample organisation (for development/testing)
INSERT INTO organisation (name, slug, owner_user_id, is_active) VALUES
('Demo Pub Ltd', 'demo-pub', 1, true);

-- Sample subscription for demo org
INSERT INTO subscription (organisation_id, plan_type, status) VALUES
(1, 'free', 'active');

-- Sample admin user (for development)
INSERT INTO app_user (email, display_name, is_managed, email_verified) VALUES
('admin@lmslocal.com', 'System Admin', false, true);

-- Sample competition (inactive by default for safety)
INSERT INTO competition (
    organisation_id, 
    team_list_id, 
    name, 
    description, 
    status,
    lives_per_player,
    no_team_twice,
    lock_hours_before_kickoff
) VALUES (
    1, 
    1, 
    'Demo Competition - DO NOT USE', 
    'Sample competition for development testing',
    'setup',
    1,
    true,
    1
);

-- =============================================
-- DEVELOPMENT HELPER DATA
-- =============================================

-- Sample team list for custom sports (development)
INSERT INTO team_list (name, type, season, organisation_id, is_active) VALUES
('Sample Rugby Teams', 'custom', NULL, 1, false);

-- Sample custom teams (inactive for development)
INSERT INTO team (team_list_id, name, short_name, sort_order, is_active) VALUES
(2, 'Sample Team A', 'STA', 1, false),
(2, 'Sample Team B', 'STB', 2, false),
(2, 'Sample Team C', 'STC', 3, false);

-- =============================================
-- AUDIT CONFIGURATION
-- =============================================

-- Sample audit entry for system initialization
INSERT INTO audit_log (
    competition_id,
    user_id,
    action,
    details,
    created_at
) VALUES (
    NULL,
    1,
    'System initialization completed',
    'Initial database setup and seed data population',
    CURRENT_TIMESTAMP
);

-- =============================================
-- INDEXES FOR PERFORMANCE (if not in migrations)
-- =============================================

-- Additional performance indexes for common queries
-- (These may already be in migration files)

-- Competition user lookups
CREATE INDEX IF NOT EXISTS idx_comp_user_active_players 
ON competition_user(competition_id, status) 
WHERE status = 'active';

-- Pick history for "no team twice" rule
CREATE INDEX IF NOT EXISTS idx_pick_user_team_history 
ON pick(user_id, team_id);

-- Round lock time queries
CREATE INDEX IF NOT EXISTS idx_round_lock_pending 
ON round(lock_time) 
WHERE status = 'open';

-- Auth token cleanup queries
CREATE INDEX IF NOT EXISTS idx_user_expired_tokens 
ON app_user(auth_token_expires) 
WHERE auth_token_expires < CURRENT_TIMESTAMP;

-- =============================================
-- VIEWS FOR COMMON QUERIES
-- =============================================

-- View for active competition summary
CREATE VIEW v_active_competitions AS
SELECT 
    c.id,
    c.name,
    c.status,
    o.name as organisation_name,
    COUNT(cu.user_id) as total_players,
    COUNT(CASE WHEN cu.status = 'active' THEN 1 END) as active_players,
    c.created_at,
    c.updated_at
FROM competition c
JOIN organisation o ON c.organisation_id = o.id
LEFT JOIN competition_user cu ON c.id = cu.competition_id
WHERE c.status IN ('active', 'locked')
GROUP BY c.id, c.name, c.status, o.name, c.created_at, c.updated_at;

-- View for user competition dashboard
CREATE VIEW v_user_competitions AS
SELECT 
    cu.user_id,
    c.id as competition_id,
    c.name as competition_name,
    c.status as competition_status,
    cu.status as user_status,
    cu.lives_remaining,
    cu.role,
    o.name as organisation_name,
    COALESCE(r.round_number, 0) as current_round
FROM competition_user cu
JOIN competition c ON cu.competition_id = c.id
JOIN organisation o ON c.organisation_id = o.id
LEFT JOIN round r ON c.id = r.competition_id 
    AND r.status = 'open'
WHERE cu.status != 'pending';

-- =============================================
-- FUNCTIONS FOR COMMON OPERATIONS
-- =============================================

-- Function to generate unique invite codes
CREATE OR REPLACE FUNCTION generate_invite_code() 
RETURNS VARCHAR(8) AS $$
DECLARE
    chars VARCHAR(36) := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    result VARCHAR(8) := '';
    i INTEGER;
BEGIN
    FOR i IN 1..8 LOOP
        result := result || substr(chars, (random() * 35 + 1)::integer, 1);
    END LOOP;
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Function to check if team can be picked (no team twice rule)
CREATE OR REPLACE FUNCTION can_pick_team(
    p_user_id INTEGER,
    p_competition_id INTEGER,
    p_team_id INTEGER
) RETURNS BOOLEAN AS $$
DECLARE
    pick_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO pick_count
    FROM pick p
    JOIN round r ON p.round_id = r.id
    WHERE r.competition_id = p_competition_id
        AND p.user_id = p_user_id
        AND p.team_id = p_team_id;
    
    RETURN pick_count = 0;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- CLEANUP PROCEDURES
-- =============================================

-- Procedure to clean up expired auth tokens
CREATE OR REPLACE FUNCTION cleanup_expired_tokens() 
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    UPDATE app_user 
    SET auth_token = NULL, auth_token_expires = NULL
    WHERE auth_token_expires < CURRENT_TIMESTAMP;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- NOTES FOR PRODUCTION
-- =============================================

/*
PRODUCTION DEPLOYMENT NOTES:

1. Remove or modify sample data before production deployment
2. Ensure proper database user permissions
3. Consider table partitioning for audit_log and user_activity tables
4. Set up regular cleanup jobs for expired tokens and old audit logs
5. Monitor index performance and add additional indexes as needed
6. Consider read replicas for analytics queries
7. Set up database backups and point-in-time recovery
8. Monitor performance of explicit rule columns vs previous JSONB approach

SECURITY CONSIDERATIONS:

1. Never store passwords in plain text
2. Ensure auth tokens are cryptographically secure
3. Implement rate limiting on auth token generation
4. Regular security audits of audit_log table
5. Ensure proper SSL/TLS for database connections
6. Consider encryption at rest for sensitive data
*/