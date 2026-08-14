-- =====================================================================================
-- Mark the pre-CUTOFF Join LMS backlog as sent (status 'skipped')
-- Run once, 2026-08-14. See docs/email/README.md, "Mark as sent".
-- =====================================================================================
-- Every account that existed before joinLms.js's CUTOFF gets a 'skipped' row: no email
-- was built and none was sent, but the once-ever guard
--   NOT EXISTS (... eq.email_type = 'join_lms')
-- now excludes them permanently. That is what makes it safe to delete the CUTOFF
-- constant afterwards - the backlog becomes data instead of a date in code, and the
-- number on the admin card has nothing invisible behind it.
--
-- A welcome to somebody who signed up in September 2025 is a bad email on its own
-- terms, so these are written off rather than sent.
--
-- Deliberately NOT filtered by opt-out. An opt-out suppresses today but can be reversed
-- tomorrow, and that would make a year-old welcome eligible again. "Nobody who already
-- existed" has to hold whatever anyone does with their preferences later.
--
-- Identifiers match what joinLms.queueCandidate writes exactly - user only, no
-- competition, no round - or the guard above would not see these rows.
--
-- Reversible: DELETE FROM email_queue WHERE email_type='join_lms' AND status='skipped';
-- =====================================================================================

INSERT INTO email_queue (
  user_id, competition_id, round_id, email_type,
  scheduled_send_at, template_data, status, attempts
)
SELECT
  u.id,
  NULL,
  NULL,
  'join_lms',
  NOW(),
  jsonb_build_object(
    'skipped', true,
    'skipped_at', NOW(),
    'reason', 'Pre-CUTOFF backlog written off when joinLms CUTOFF was retired'
  ),
  'skipped',
  0
FROM app_user u
WHERE u.email IS NOT NULL
  AND u.email != ''
  -- Guests and bots, same test the candidate query uses.
  AND u.email NOT LIKE '%@lms-guest.com'
  AND u.created_at < '2026-08-11T13:00:00Z'::timestamptz
  -- Never touch anyone who already has a row, whatever its status.
  AND NOT EXISTS (
    SELECT 1 FROM email_queue eq
    WHERE eq.user_id = u.id
      AND eq.email_type = 'join_lms'
  );
