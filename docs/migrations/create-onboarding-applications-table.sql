/*
=======================================================================================================================================
Database Migration: Create onboarding_applications table
=======================================================================================================================================
Purpose: Store onboarding application submissions from venues/organizers interested in free setup support
Created: 2025-11-05
=======================================================================================================================================
*/

-- Create onboarding_applications table
CREATE TABLE IF NOT EXISTS onboarding_applications (
    id SERIAL PRIMARY KEY,
    venue_name VARCHAR(255) NOT NULL,
    venue_type VARCHAR(50) NOT NULL CHECK (venue_type IN ('pub', 'club', 'workplace', 'friends', 'other')),
    contact_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(50) NOT NULL,
    estimated_players INTEGER NOT NULL CHECK (estimated_players >= 10),
    preferred_start_date DATE,
    description TEXT,
    status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'contacted', 'approved', 'rejected', 'completed')),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP,
    notes TEXT
);

-- Create indexes for common queries
CREATE INDEX idx_onboarding_applications_status ON onboarding_applications(status);
CREATE INDEX idx_onboarding_applications_email ON onboarding_applications(email);
CREATE INDEX idx_onboarding_applications_created_at ON onboarding_applications(created_at DESC);

-- Add comments
COMMENT ON TABLE onboarding_applications IS 'Stores onboarding applications from venues/organizers for free setup support';
COMMENT ON COLUMN onboarding_applications.status IS 'Application status: pending, contacted, approved, rejected, completed';
COMMENT ON COLUMN onboarding_applications.venue_type IS 'Type of venue: pub, club, workplace, friends, other';
COMMENT ON COLUMN onboarding_applications.notes IS 'Internal notes for tracking application progress';
