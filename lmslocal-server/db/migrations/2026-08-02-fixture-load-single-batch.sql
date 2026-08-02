-- =====================================================================================================================================
-- Retire gameweek/results_pushed/fixtures_pushed from fixture_load
-- =====================================================================================================================================
-- fixture_load used to be a gameweek-numbered queue of batches, tracked via results_pushed /
-- fixtures_pushed. The admin flow now only ever allows one pending batch at a time
-- (add-staged-fixtures blocks staging while fixture_load is non-empty), which makes gameweek
-- numbering and the push-tracking columns dead weight - the table itself IS the pending batch;
-- non-empty means something is outstanding, empty means clear to stage again.
--
-- fixture_load holds no data that matters at this point, so this truncates rather than
-- migrating rows.
-- =====================================================================================================================================

TRUNCATE fixture_load RESTART IDENTITY;

ALTER TABLE fixture_load
  DROP COLUMN gameweek,
  DROP COLUMN results_pushed,
  DROP COLUMN results_pushed_at,
  DROP COLUMN fixtures_pushed;
