-- =====================================================================================
-- Collapse email_preference groups from CONSUMER x SECTION to SECTION
-- Written 2026-08-11, alongside the outline being cut to two sections (Game, Info).
-- =====================================================================================
--
-- WHY THIS IS NOT OPTIONAL. getPreferences() only ever looks for 'game' and 'info' now,
-- so every row still holding one of the seven old dotted keys is invisible to the code.
-- An invisible row means the default applies, and the default is SUBSCRIBED - so without
-- this, everyone who has unsubscribed silently starts receiving that mail again.
--
-- Old key            -> new key
--   player.game       -> game
--   organiser.game    -> game
--   player.welcome    -> info
--   organiser.welcome -> info
--   organiser.tips    -> info
--   platform.welcome  -> info
--   platform.info     -> info
--   all               -> all      (the kill switch is unchanged)
--
-- MERGE RULE: opted out of ANY old group that maps to a new one means opted out of the
-- new one. Two rows can collapse onto the same key with different values - somebody with
-- player.game off and organiser.game on - and in that case the OFF must win. Restoring
-- mail somebody switched off is the one outcome worth being cautious about; the reverse
-- is a switch they can turn back on themselves.
--
-- Run inside one transaction (db/write.js does this) and read the counts before and
-- after. Safe to run twice: the second run finds no legacy keys.
-- =====================================================================================

BEGIN;

-- One row per user per new group, enabled=false where ANY contributing old row was false.
INSERT INTO email_preference (user_id, competition_id, email_type, enabled, updated_at)
SELECT
  user_id,
  0                                  AS competition_id,
  new_key                            AS email_type,
  bool_and(enabled)                  AS enabled,   -- false wins, per the merge rule above
  NOW()                              AS updated_at
FROM (
  SELECT
    ep.user_id,
    ep.enabled,
    CASE ep.email_type
      WHEN 'player.game'       THEN 'game'
      WHEN 'organiser.game'    THEN 'game'
      WHEN 'player.welcome'    THEN 'info'
      WHEN 'organiser.welcome' THEN 'info'
      WHEN 'organiser.tips'    THEN 'info'
      WHEN 'platform.welcome'  THEN 'info'
      WHEN 'platform.info'     THEN 'info'
    END AS new_key
  FROM email_preference ep
  WHERE ep.competition_id = 0
    AND ep.email_type IN (
      'player.game', 'organiser.game', 'player.welcome',
      'organiser.welcome', 'organiser.tips', 'platform.welcome', 'platform.info'
    )
) mapped
WHERE new_key IS NOT NULL
  -- Don't duplicate a row the new code has already written for this user and group.
  -- NOT EXISTS rather than ON CONFLICT: the table has no unique constraint across
  -- (user_id, competition_id, email_type), so ON CONFLICT has nothing to target and would
  -- silently do nothing at all. This is the same reason setPreference() upserts by hand.
  AND NOT EXISTS (
    SELECT 1 FROM email_preference existing
    WHERE existing.user_id = mapped.user_id
      AND existing.competition_id = 0
      AND existing.email_type = mapped.new_key
  )
GROUP BY user_id, new_key;

-- The old keys are unreachable from here on; leaving them would only invite a future
-- reader to believe they still mean something.
DELETE FROM email_preference
WHERE competition_id = 0
  AND email_type IN (
    'player.game', 'organiser.game', 'player.welcome',
    'organiser.welcome', 'organiser.tips', 'platform.welcome', 'platform.info'
  );

COMMIT;
