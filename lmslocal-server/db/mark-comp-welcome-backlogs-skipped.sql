-- =====================================================================================
-- Mark the pre-CUTOFF Join Comp and Created Comp backlogs as sent (status 'skipped')
-- Run once, 2026-08-14. See docs/email/README.md, "Mark as sent".
-- =====================================================================================
-- The third and fourth of these, after db/mark-join-lms-backlog-skipped.sql. Same move:
-- the CUTOFF constant in each service excluded a backlog by DATE, in code, invisibly -
-- nothing on the admin screen said it was there, so the count shown had a filter behind
-- it nobody could see. These rows replace it, and the constants come out.
--
-- The once-ever guard in each candidate query already excludes any row whatever its
-- status, so a 'skipped' row does the job with no change to the eligibility SQL.
--
-- Nothing is emailed and no email_tracking row is opened: there was no message.
--
-- BOTH statements deliberately IGNORE opt-out AND membership status. A preference can
-- be reversed and competition_user.status can be set back to active from the admin
-- tool - either would resurrect a months-old welcome. "Nobody who was already here"
-- has to hold whatever happens later, so the net is cast wider than candidacy is.
-- That is why the welcome count here is 104 rather than the 35 currently eligible.
--
-- Identifiers match what each queueCandidate writes exactly, or the guards would not
-- see these rows: welcome is (user, competition), created_comp is (organiser,
-- competition), both with a NULL round.
--
-- Reversible:
--   DELETE FROM email_queue WHERE status='skipped' AND email_type IN ('welcome','created_comp');
-- =====================================================================================

-- ------------------------------------------------------------------------------------
-- Join Comp ('welcome') - everyone who joined someone else's competition before CUTOFF
-- ------------------------------------------------------------------------------------
INSERT INTO email_queue (
  user_id, competition_id, round_id, email_type,
  scheduled_send_at, template_data, status, attempts
)
SELECT
  cu.user_id,
  c.id,
  NULL,
  'welcome',
  NOW(),
  jsonb_build_object(
    'skipped', true,
    'skipped_at', NOW(),
    'reason', 'Pre-CUTOFF backlog written off when joinComp CUTOFF was retired'
  ),
  'skipped',
  0
FROM competition_user cu

INNER JOIN competition c
  ON c.id = cu.competition_id
  -- The organiser joining their own competition is never a candidate for this email -
  -- created_comp is theirs. Structural, not a preference, so it is excluded here too.
  AND c.organiser_id != cu.user_id

INNER JOIN app_user u
  ON u.id = cu.user_id
  AND u.email IS NOT NULL
  AND u.email != ''
  AND u.email NOT LIKE '%@lms-guest.com'

WHERE cu.joined_at < '2026-08-11T17:03:00Z'::timestamptz
  AND NOT EXISTS (
    SELECT 1 FROM email_queue eq
    WHERE eq.user_id = cu.user_id
      AND eq.competition_id = c.id
      AND eq.email_type = 'welcome'
  );

-- ------------------------------------------------------------------------------------
-- Created Comp - every competition created before CUTOFF, to whoever created it
-- ------------------------------------------------------------------------------------
INSERT INTO email_queue (
  user_id, competition_id, round_id, email_type,
  scheduled_send_at, template_data, status, attempts
)
SELECT
  c.organiser_id,
  c.id,
  NULL,
  'created_comp',
  NOW(),
  jsonb_build_object(
    'skipped', true,
    'skipped_at', NOW(),
    'reason', 'Pre-CUTOFF backlog written off when createdComp CUTOFF was retired'
  ),
  'skipped',
  0
FROM competition c

INNER JOIN app_user u
  ON u.id = c.organiser_id
  AND u.email IS NOT NULL
  AND u.email != ''
  AND u.email NOT LIKE '%@lms-guest.com'

WHERE c.created_at < '2026-08-11T16:45:00Z'::timestamptz
  -- Once per competition, ever - the guard is on the competition, not the organiser.
  AND NOT EXISTS (
    SELECT 1 FROM email_queue eq
    WHERE eq.competition_id = c.id
      AND eq.email_type = 'created_comp'
  );
