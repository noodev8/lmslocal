-- Matchday, phase 2: how a game ends, and the predictions themselves. docs/matchday.md §4.
--
-- Additive. Every existing competition is 'lms' and keeps both new columns null; nothing that
-- exists reads either, or the new table. Run BEFORE deploying the server code that uses them.

-- How a Matchday game ends: first to end_value points, or the highest total after end_value
-- rounds. Null for LMS, which ends when one player is left. The CHECK ties the two to the game,
-- so a Matchday competition cannot exist without an ending and an LMS one cannot carry one.
ALTER TABLE competition
  ADD COLUMN IF NOT EXISTS end_rule  VARCHAR(10),
  ADD COLUMN IF NOT EXISTS end_value INTEGER;

ALTER TABLE competition
  DROP CONSTRAINT IF EXISTS competition_end_rule_check;
ALTER TABLE competition
  ADD CONSTRAINT competition_end_rule_check CHECK (
    (game_type = 'lms' AND end_rule IS NULL AND end_value IS NULL)
    OR
    (game_type <> 'lms' AND end_rule IN ('points', 'rounds') AND end_value > 0)
  );

-- One row per player per fixture they backed. A skipped fixture has no row and scores 0.
--
-- NOT the pick table: pick is read in some forty places as one row per player per round, plus
-- lives. Ten rows a round in there would need a guard on every one of those queries forever.
--
-- points is null until the fixture is settled, then 3 / 1 / -1 (3 / 1 / 0 from 2026-11-23, see
-- 2026-11-23-matchday-scoring-3-1-0.sql). It records what happened, like
-- pick.outcome; running totals are DERIVED (services/matchdayTable.js), never stored here.
--
-- FOREIGN KEYS ARE NO ACTION, deliberately. Any path that deletes fixtures, rounds, competitions
-- or users without first dealing with predictions then fails loudly instead of leaving orphans:
-- the calendar reconcile in particular deletes and re-inserts a round's fixtures
-- (services/fixtureService.js). fixture_id is nullable for exactly that case - cleared before the
-- delete and re-pointed by team after it - and a prediction whose team is no longer playing in
-- the round keeps it null and scores 0.
CREATE TABLE IF NOT EXISTS prediction (
  id             SERIAL PRIMARY KEY,
  competition_id INTEGER     NOT NULL REFERENCES competition (id),
  round_id       INTEGER     NOT NULL REFERENCES round (id),
  fixture_id     INTEGER              REFERENCES fixture (id),
  user_id        INTEGER     NOT NULL REFERENCES app_user (id),
  team           VARCHAR(20) NOT NULL,
  points         INTEGER,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT prediction_points_check CHECK (points IS NULL OR points IN (3, 1, 0, -1))
);

-- A changed prediction is an update of this row, never a second one. Null fixture_ids (orphaned
-- by a reconcile) do not collide with each other under a unique index, which is what we want.
CREATE UNIQUE INDEX IF NOT EXISTS prediction_user_fixture_key ON prediction (user_id, fixture_id);

-- The two ways predictions are read: a whole round for the table and settling, and one player's
-- coupon for a round.
CREATE INDEX IF NOT EXISTS prediction_round_idx ON prediction (round_id);
CREATE INDEX IF NOT EXISTS prediction_fixture_idx ON prediction (fixture_id);
CREATE INDEX IF NOT EXISTS prediction_competition_user_idx ON prediction (competition_id, user_id);
