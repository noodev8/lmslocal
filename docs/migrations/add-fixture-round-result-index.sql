-- =====================================================
-- Migration: Add fixture round_result index
-- Date: 2025-10-04
-- Purpose: Optimize checking if any results exist for a round
-- =====================================================

-- Add composite index for efficient result checking
CREATE INDEX IF NOT EXISTS idx_fixture_round_result
ON fixture (round_id, result);

-- Add comment
COMMENT ON INDEX idx_fixture_round_result IS 'Optimize checking if any results exist for a round (used by organiser-mid-round-submit-tip)';
