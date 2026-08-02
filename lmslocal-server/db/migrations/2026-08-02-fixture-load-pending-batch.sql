-- =====================================================================================================================================
-- Single pending fixture batch per team list
-- =====================================================================================================================================
-- fixture_load had no concept of its own push state - whether a batch had reached
-- competitions was reverse-engineered by joining against competition.fixture on team+kickoff.
-- That let the admin fixtures screen start a new gameweek batch while an older one was still
-- unpushed or unresulted, and the results screen would then serve that older, unrelated
-- gameweek instead of the one just staged.
--
-- fixtures_pushed mirrors the existing results_pushed column. add-staged-fixtures now refuses
-- to create a new gameweek until the current one has fixtures_pushed = true and
-- results_pushed = true on every row, which is a flag check against fixture_load itself -
-- no round or competition join needed.
-- =====================================================================================================================================

ALTER TABLE fixture_load
  ADD COLUMN IF NOT EXISTS fixtures_pushed BOOLEAN NOT NULL DEFAULT false;

-- Backfill: anything already resulted-and-pushed, or already matched into a competition's
-- fixture table, was necessarily pushed already.
UPDATE fixture_load fl
SET fixtures_pushed = true
WHERE results_pushed = true
   OR EXISTS (
     SELECT 1 FROM fixture f
     JOIN competition c ON c.id = f.competition_id
     WHERE f.home_team_short = fl.home_team_short
       AND f.away_team_short = fl.away_team_short
       AND f.kickoff_time    = fl.kickoff_time
       AND c.team_list_id    = fl.team_list_id
   );
