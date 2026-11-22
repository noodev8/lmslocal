-- Which game a competition is: 'lms' (Last Man Standing) or 'matchday'. docs/matchday.md §3, §4.1.
--
-- WHY: a second game is being built on the same fixtures, rounds and calendar. Everything
-- LMS-only - the elimination step of the results push, the LMS player routes, bots, every email's
-- copy, push notifications, and the app, which knows no other game - is guarded on
-- game_type = 'lms' (services/gameType.js). Guards name the game they allow, so a third game is
-- kept out of all of that by default.
--
-- Additive, and changes nothing that exists: every current row becomes 'lms', and the default
-- keeps every competition created by today's code 'lms' too. Run BEFORE deploying the server code
-- that reads it - that code fails on a missing column, and nothing else notices the column.
--
-- FIXED AT CREATION, like fixture_service: update-competition does not accept it. Changing the
-- game under players who joined for the other one is a new competition, not a setting.
--
-- The CHECK lists the games that exist. services/gameType.js GAME_TYPES holds the same keys with
-- their display names; change the two together.
ALTER TABLE competition
  ADD COLUMN IF NOT EXISTS game_type VARCHAR(20) NOT NULL DEFAULT 'lms'
  CONSTRAINT competition_game_type_check CHECK (game_type IN ('lms', 'matchday'));
