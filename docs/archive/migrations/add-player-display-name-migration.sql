-- ========================================
-- Add player_display_name to competition_user
-- ========================================
-- Date: 2025-11-18
-- Purpose: Allow users to have different display names per competition
-- Field: player_display_name VARCHAR(100)

-- STEP 1: Add the new column (NULL allowed initially)
ALTER TABLE competition_user
ADD COLUMN player_display_name VARCHAR(100);

-- STEP 2: Verify column added
SELECT column_name, data_type, character_maximum_length
FROM information_schema.columns
WHERE table_name = 'competition_user'
  AND column_name = 'player_display_name';

-- STEP 3: Backfill existing rows from app_user.display_name
UPDATE competition_user cu
SET player_display_name = u.display_name
FROM app_user u
WHERE cu.user_id = u.id
  AND cu.player_display_name IS NULL;

-- STEP 4: Verify backfill
SELECT
  COUNT(*) as total_rows,
  COUNT(player_display_name) as rows_with_player_display_name,
  COUNT(*) - COUNT(player_display_name) as rows_still_null
FROM competition_user;

-- STEP 5: Check sample data
SELECT
  cu.id,
  cu.user_id,
  cu.competition_id,
  cu.player_display_name,
  u.display_name as global_display_name
FROM competition_user cu
INNER JOIN app_user u ON cu.user_id = u.id
LIMIT 10;

-- Expected result: All rows should have player_display_name populated
-- rows_still_null should be 0
