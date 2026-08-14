-- =====================================================================================================================================
-- fixture_load.source_block_id - which calendar block this batch was promoted from
-- =====================================================================================================================================
-- See docs/competition-start.md.
--
-- A competition created against a block gets round 1 immediately, provisional: real fixtures and
-- a real lock time, keyed weeks ahead and liable to move. When that block is finally promoted
-- and pushed, the push must RECONCILE that existing round - refresh its lock time and replace its
-- fixtures with the confirmed ones - rather than create a second round.
--
-- To do that the push has to know which block the staged batch came from. Nothing else in
-- fixture_load carries it: matching on team and kickoff is exactly the fragile reverse-engineering
-- the fixtures_pushed column was added to kill, and a moved kickoff is precisely the case where it
-- would fail.
--
-- NULL for a batch staged by hand through add-staged-fixtures, which is still supported and is
-- what every existing row is. A NULL here simply means "no round anywhere is waiting to be
-- reconciled to this", which is the correct reading for those.
-- =====================================================================================================================================

ALTER TABLE fixture_load
  ADD COLUMN IF NOT EXISTS source_block_id INTEGER REFERENCES fixture_block(id);
