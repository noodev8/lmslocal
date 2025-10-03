-- =======================================================================================================================================
-- Email Preference Table Constraint
-- =======================================================================================================================================
-- Purpose: Add unique constraint to prevent duplicate preferences for same user/competition/email_type combination
-- =======================================================================================================================================

-- Add unique constraint to email_preference table
-- This ensures one preference record per user, per competition, per email type
-- Allows ON CONFLICT ... DO UPDATE upsert pattern in update-email-preferences route

ALTER TABLE email_preference
ADD CONSTRAINT unique_user_competition_email_type
UNIQUE (user_id, competition_id, email_type);

-- Create composite index for most common lookup pattern
CREATE INDEX idx_email_prefs_lookup ON email_preference(user_id, competition_id, email_type);

-- =======================================================================================================================================
-- Notes:
-- - competition_id = 0 for global preferences
-- - email_type can be NULL (for "mute entire competition")
-- - This constraint allows: user_id=1, competition_id=0, email_type='pick_reminder'
--   but prevents duplicate of same combination
-- =======================================================================================================================================
