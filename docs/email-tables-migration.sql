-- =====================================================================================================================
-- Email System Database Tables Migration
-- =====================================================================================================================
-- Purpose: Create tables for email queue management, tracking, and preferences
-- Created: 2025-10-02
-- =====================================================================================================================

-- =====================================================================================================================
-- Table: email_queue
-- Purpose: Store pending and scheduled emails before they are sent
-- =====================================================================================================================
CREATE TABLE email_queue (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
    competition_id INTEGER REFERENCES competitions(id) ON DELETE CASCADE,
    email_type VARCHAR(50) NOT NULL, -- 'welcome', 'pick_reminder', 'results'
    priority INTEGER DEFAULT 5, -- 1=critical (6hr reminder), 5=normal (24hr), 10=low (48hr, welcome)
    scheduled_send_at TIMESTAMP NOT NULL, -- When this email should be sent
    consolidation_window_end TIMESTAMP, -- Hold until this time for consolidation (future feature)
    template_data JSONB NOT NULL, -- Dynamic content for email template
    status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'processing', 'sent', 'failed', 'cancelled'
    attempts INTEGER DEFAULT 0, -- Number of send attempts
    last_attempt_at TIMESTAMP,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    sent_at TIMESTAMP -- When email was successfully sent
);

-- Indexes for performance
CREATE INDEX idx_email_queue_status ON email_queue(status);
CREATE INDEX idx_email_queue_scheduled ON email_queue(scheduled_send_at);
CREATE INDEX idx_email_queue_user ON email_queue(user_id);
CREATE INDEX idx_email_queue_competition ON email_queue(competition_id);
CREATE INDEX idx_email_queue_type ON email_queue(email_type);

-- Comments for clarity
COMMENT ON TABLE email_queue IS 'Queue for scheduled and pending emails';
COMMENT ON COLUMN email_queue.priority IS '1=critical, 5=normal, 10=low priority';
COMMENT ON COLUMN email_queue.template_data IS 'JSON object with data for email template rendering';
COMMENT ON COLUMN email_queue.consolidation_window_end IS 'Future feature: hold email until this time to consolidate with others';

-- =====================================================================================================================
-- Table: email_tracking
-- Purpose: Track email delivery, opens, clicks, and engagement metrics
-- =====================================================================================================================
CREATE TABLE email_tracking (
    id SERIAL PRIMARY KEY,
    email_id VARCHAR(255) UNIQUE NOT NULL, -- Unique identifier for this email send (our internal ID)
    user_id INTEGER NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
    competition_id INTEGER REFERENCES competitions(id) ON DELETE SET NULL,
    email_type VARCHAR(50) NOT NULL, -- 'welcome', 'pick_reminder', 'results'
    subject VARCHAR(255) NOT NULL,
    sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    opened_at TIMESTAMP,
    clicked_at TIMESTAMP,
    click_action VARCHAR(100), -- 'make_pick', 'view_results', 'manage_preferences', 'view_competition'
    unsubscribed_at TIMESTAMP,
    bounce_type VARCHAR(50), -- 'hard', 'soft', 'none', NULL
    resend_message_id VARCHAR(255), -- Resend's unique message ID for correlation
    resend_event_data JSONB -- Store raw Resend webhook data for debugging
);

-- Indexes for performance
CREATE INDEX idx_email_tracking_user ON email_tracking(user_id);
CREATE INDEX idx_email_tracking_competition ON email_tracking(competition_id);
CREATE INDEX idx_email_tracking_type ON email_tracking(email_type);
CREATE INDEX idx_email_tracking_sent ON email_tracking(sent_at);
CREATE INDEX idx_email_tracking_opened ON email_tracking(opened_at);
CREATE INDEX idx_email_tracking_resend_id ON email_tracking(resend_message_id);

-- Comments for clarity
COMMENT ON TABLE email_tracking IS 'Comprehensive email engagement tracking and analytics';
COMMENT ON COLUMN email_tracking.email_id IS 'Our internal unique identifier (used in email headers and links)';
COMMENT ON COLUMN email_tracking.resend_message_id IS 'Resend service message ID for webhook correlation';
COMMENT ON COLUMN email_tracking.click_action IS 'Which button/link was clicked for conversion tracking';

-- =====================================================================================================================
-- Table: email_preferences
-- Purpose: User email notification preferences (granular control)
-- =====================================================================================================================
CREATE TABLE email_preferences (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
    competition_id INTEGER REFERENCES competitions(id) ON DELETE CASCADE, -- NULL = global preference
    email_type VARCHAR(50) NOT NULL, -- 'welcome', 'pick_reminder', 'results', 'all'
    enabled BOOLEAN DEFAULT TRUE,
    frequency VARCHAR(20) DEFAULT 'all', -- 'all', 'digest', 'critical_only', 'none'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, competition_id, email_type)
);

-- Indexes for performance
CREATE INDEX idx_email_prefs_user ON email_preferences(user_id);
CREATE INDEX idx_email_prefs_competition ON email_preferences(competition_id);
CREATE INDEX idx_email_prefs_enabled ON email_preferences(enabled);

-- Comments for clarity
COMMENT ON TABLE email_preferences IS 'User email notification preferences with granular control';
COMMENT ON COLUMN email_preferences.competition_id IS 'NULL means global preference, non-NULL means competition-specific override';
COMMENT ON COLUMN email_preferences.email_type IS 'Type of email this preference applies to, or "all" for global control';
COMMENT ON COLUMN email_preferences.frequency IS 'How often to send: all, digest (consolidated), critical_only, none';

-- =====================================================================================================================
-- Table: email_templates
-- Purpose: Store reusable email templates with versioning
-- =====================================================================================================================
CREATE TABLE email_templates (
    id SERIAL PRIMARY KEY,
    template_key VARCHAR(100) UNIQUE NOT NULL, -- 'pick_reminder_24hr', 'pick_reminder_6hr', 'welcome', 'results_survivor', 'results_eliminated'
    template_name VARCHAR(255) NOT NULL,
    subject_template TEXT NOT NULL, -- Subject line with {{variables}}
    html_template TEXT NOT NULL, -- HTML email body with {{variables}}
    text_template TEXT NOT NULL, -- Plain text fallback with {{variables}}
    version INTEGER DEFAULT 1,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index for performance
CREATE INDEX idx_email_templates_key ON email_templates(template_key);
CREATE INDEX idx_email_templates_active ON email_templates(is_active);

-- Comments for clarity
COMMENT ON TABLE email_templates IS 'Reusable email templates with variable substitution';
COMMENT ON COLUMN email_templates.template_key IS 'Unique identifier for template lookup';
COMMENT ON COLUMN email_templates.subject_template IS 'Subject with {{variable}} placeholders';
COMMENT ON COLUMN email_templates.html_template IS 'HTML body with {{variable}} placeholders';
COMMENT ON COLUMN email_templates.text_template IS 'Plain text fallback with {{variable}} placeholders';

-- =====================================================================================================================
-- Initial Data: Default Email Preferences for All Users
-- =====================================================================================================================
-- NOTE: For initial rollout, all users will have emails enabled by default
-- Users can opt-out via preferences page
-- Pick reminders are critical and should default to ON

-- =====================================================================================================================
-- Rollback Script (if needed)
-- =====================================================================================================================
-- Uncomment and run if you need to remove these tables:
-- DROP TABLE IF EXISTS email_templates CASCADE;
-- DROP TABLE IF EXISTS email_preferences CASCADE;
-- DROP TABLE IF EXISTS email_tracking CASCADE;
-- DROP TABLE IF EXISTS email_queue CASCADE;

-- =====================================================================================================================
-- Migration Complete
-- =====================================================================================================================
