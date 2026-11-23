-- Matchday scoring 3 / 1 / -1 becomes 3 / 1 / 0 (docs/matchday.md §1, 2026-11-23).
--
-- APPLY AFTER THE SERVER WITH 3 / 1 / 0 IS DEPLOYED. A server still running the old
-- services/matchdayScoring.js writes -1 for a lost prediction, and once the CHECK below is narrowed
-- that write fails - taking the whole results push for that competition with it.
--
-- prediction.points records what a prediction was worth. Under the new rule a lost one is worth 0,
-- and services/matchdayTable.js no longer floors totals, so an old -1 left in place would take a
-- total below 0. At the time of writing every -1 row is in organiser 50's test competitions.
--
-- Safe to run twice.

BEGIN;

UPDATE prediction SET points = 0, updated_at = NOW() WHERE points = -1;

ALTER TABLE prediction DROP CONSTRAINT IF EXISTS prediction_points_check;
ALTER TABLE prediction ADD CONSTRAINT prediction_points_check CHECK (points IS NULL OR points IN (3, 1, 0));

COMMIT;
