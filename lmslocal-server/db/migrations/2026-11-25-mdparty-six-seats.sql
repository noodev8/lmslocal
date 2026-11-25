-- Matchday Party: a game of six, and shorter games (docs/matchday-party.md §2, 2026-11-25).
--
-- 1. Bots. Every room has six players; any seat no person takes is a bot, which plays like anyone
--    (ordinary names, nothing on screen marks it). The server needs to know which rows are bots, to
--    make their predictions and to give a joining person a bot's seat.
-- 2. Rounds are now 1, 2 or 3. The old 4, 6 and 8 stay allowed so that rooms created before this
--    (all deleted within a day by the prune) still satisfy the constraint; the server offers 1-3 only.
--
-- Additive: a column with a default, and a widened check. Nothing outside the mdparty_ tables reads
-- either.
ALTER TABLE mdparty_player
  ADD COLUMN IF NOT EXISTS is_bot BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE mdparty_room
  DROP CONSTRAINT IF EXISTS mdparty_room_rounds_total_check;
ALTER TABLE mdparty_room
  ADD CONSTRAINT mdparty_room_rounds_total_check CHECK (rounds_total IN (1, 2, 3, 4, 6, 8));
