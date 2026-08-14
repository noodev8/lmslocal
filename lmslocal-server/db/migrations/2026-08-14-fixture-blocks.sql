-- =====================================================================================================================================
-- Fixture blocks: a forward calendar, separate from the batch going out
-- =====================================================================================================================================
-- See docs/competition-start.md.
--
-- fixture_load does two jobs at once: it is the calendar of what is coming AND the batch being
-- pushed right now. Because they are one table, "only one batch pending per team list" - correct
-- for the batch - also forbids keying fixtures more than one gameweek ahead. That is why a new
-- competition has nothing in it until an operator stages and the organiser presses Ready, and
-- why the players they recruit in the meantime land on an empty screen.
--
-- These two tables take the calendar job. fixture_load keeps the batch job, unchanged: a block
-- is promoted INTO fixture_load when its kickoffs are confirmed, and everything downstream of
-- that point behaves exactly as it does today.
--
-- Additive only. Nothing is dropped and no existing row changes.
-- =====================================================================================================================================

CREATE TABLE IF NOT EXISTS fixture_block (
  id              SERIAL PRIMARY KEY,
  team_list_id    INTEGER NOT NULL REFERENCES team_list(id),
  -- What the organiser is shown when picking a start date, e.g. 'Sat 29 Aug'. Hand-written
  -- rather than derived, because the label is a marketing decision and the kickoffs are not
  -- always the whole story.
  label           VARCHAR(60) NOT NULL,
  -- As fixture_load.opens_gameweek: does this block START a gameweek, or continue one? Only a
  -- block that starts one may be offered as a competition's first round.
  opens_gameweek  BOOLEAN NOT NULL DEFAULT true,
  -- Set when the block is copied into fixture_load. NULL means still provisional: it can be
  -- edited, deleted, and offered to new competitions.
  staged_at       TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS fixture_block_item (
  id               SERIAL PRIMARY KEY,
  block_id         INTEGER NOT NULL REFERENCES fixture_block(id) ON DELETE CASCADE,
  home_team_short  VARCHAR(10) NOT NULL,
  away_team_short  VARCHAR(10) NOT NULL,
  kickoff_time     TIMESTAMPTZ NOT NULL
);

-- The screen and the create-competition offer both read "unpromoted blocks for this list,
-- soonest first", which is a lookup on these two columns.
CREATE INDEX IF NOT EXISTS idx_fixture_block_list_staged
  ON fixture_block (team_list_id, staged_at);

CREATE INDEX IF NOT EXISTS idx_fixture_block_item_block
  ON fixture_block_item (block_id);

-- A block's lock time is MIN(kickoff_time) over its items - the same derivation
-- services/fixtureService.js already uses for a staged batch. Deliberately NOT stored, so it
-- cannot drift from the fixtures it is supposed to describe.

-- ---------------------------------------------------------------------------------------------
-- round.source_block_id
-- ---------------------------------------------------------------------------------------------
-- Records that a round was created from a block and is therefore provisional until that block
-- is promoted and pushed. NULL on every existing round and on every round 2+, which is what
-- keeps this migration additive.
--
-- Two things need it: the push has to know which round to reconcile rather than create, and
-- deleting a block has to refuse when competitions are already sitting on it.

ALTER TABLE round
  ADD COLUMN IF NOT EXISTS source_block_id INTEGER REFERENCES fixture_block(id);

CREATE INDEX IF NOT EXISTS idx_round_source_block
  ON round (source_block_id) WHERE source_block_id IS NOT NULL;
