-- =====================================================================================================================================
-- Fixture service self-service opt-in
-- =====================================================================================================================================
-- Lets organisers subscribe a competition to the automated fixture service at creation time,
-- instead of an admin flipping competition.fixture_service by hand after the fact.
--
-- team_list.fixture_service_available marks the lists we actually stage fixtures for. The push
-- in services/fixtureService.js matches staged rows to competitions on team_list_id, so a
-- competition on an unstaged list would subscribe and then silently receive nothing. Only lists
-- flagged here are offered.
--
-- The two competition columns record the commercial terms at the moment of opt-in. During the
-- launch promotion price_paid is 0.00, which is what later distinguishes a grandfathered
-- competition from a paying one when charging starts.
-- =====================================================================================================================================

ALTER TABLE team_list
  ADD COLUMN IF NOT EXISTS fixture_service_available BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE competition
  ADD COLUMN IF NOT EXISTS fixture_service_price_paid NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS fixture_service_granted_at TIMESTAMP WITH TIME ZONE;

-- English Premier League 2026-27 is the only list with staged fixtures today.
UPDATE team_list SET fixture_service_available = true WHERE id = 1;
