-- Matchday Party: the banker (docs/matchday-party.md §2, 2026-11-25).
--
-- Once a round a player may mark one of their predictions as their banker: +6 if it wins, -3 if it
-- draws or loses. It is part of the coupon they send, so it lives on the coupon's row: one banker per
-- player per round, by construction. Null = no banker this round.
--
-- Additive: a nullable column on a party table nothing else reads. If the fixture goes (its room is
-- deleted), the column goes to null with it rather than blocking the delete.
ALTER TABLE mdparty_submission
  ADD COLUMN IF NOT EXISTS banker_fixture_id INTEGER REFERENCES mdparty_fixture (id) ON DELETE SET NULL;
