-- =====================================================================================================================================
-- Give any already-staged batch a fixture_block, so it can be offered as a start date
-- =====================================================================================================================================
-- See docs/competition-start.md.
--
-- add-staged-fixtures now creates a fixture_block alongside every batch it stages, so a new
-- competition can start on the batch going out right now - normally the SOONEST round anybody
-- could join - and so the push can reconcile that competition's round 1 rather than create a
-- second one.
--
-- Batches staged before that change have no block, so they are invisible to the create wizard.
-- This gives them one, retrospectively, with the same shape the route now writes:
--
--   * one block per (team_list_id, kickoff_time, opens_gameweek) group in fixture_load
--   * staged_at set - it is already out, nobody will ever promote it
--   * label derived from the kickoff in UK time, matching labelForKickoff in the route
--
--     One divergence, cosmetic and harmless: to_char('Mon') renders September as "Sep" where
--     JavaScript's en-GB short month gives "Sept". Labels written from here on come from the
--     route, so they are internally consistent; only a September batch backfilled by this script
--     would read slightly differently from one staged normally. Nothing matches on the label
--     except this migration's own self-consistent join below.
--   * fixture_block_item mirroring the fixture_load rows
--   * fixture_load.source_block_id pointed back at it
--
-- Idempotent: only rows with source_block_id IS NULL are touched, so re-running does nothing.
--
-- A batch with results already entered gets a block too. It will not be OFFERED - the offerable
-- rule in services/fixtureBlock.js excludes any block whose fixture_load rows carry a score - but
-- giving it an id costs nothing and keeps "every batch has a block" true without exception.
-- =====================================================================================================================================

-- One block per distinct staged batch.
WITH batches AS (
  SELECT DISTINCT team_list_id, kickoff_time, opens_gameweek
  FROM fixture_load
  WHERE source_block_id IS NULL
),
created AS (
  INSERT INTO fixture_block (team_list_id, label, opens_gameweek, staged_at)
  SELECT
    b.team_list_id,
    -- Matches labelForKickoff: "Fri 21 Aug", in UK time.
    to_char(b.kickoff_time AT TIME ZONE 'Europe/London', 'Dy DD Mon'),
    b.opens_gameweek,
    NOW()
  FROM batches b
  RETURNING id, team_list_id, label, opens_gameweek
)
UPDATE fixture_load fl
SET source_block_id = c.id
FROM created c
WHERE fl.source_block_id IS NULL
  AND fl.team_list_id = c.team_list_id
  AND fl.opens_gameweek = c.opens_gameweek
  AND to_char(fl.kickoff_time AT TIME ZONE 'Europe/London', 'Dy DD Mon') = c.label;

-- Mirror the fixtures onto the new blocks. Read from fixture_load, which is where the batch
-- actually lives; the block items exist so the create path has one place to read fixtures from
-- whichever kind of block it is handed.
INSERT INTO fixture_block_item (block_id, home_team_short, away_team_short, kickoff_time)
SELECT fl.source_block_id, fl.home_team_short, fl.away_team_short, fl.kickoff_time
FROM fixture_load fl
WHERE fl.source_block_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM fixture_block_item i WHERE i.block_id = fl.source_block_id
  );
