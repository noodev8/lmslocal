/*
=======================================================================================================================================
services/competitionEngagement.js — the facts the admin screens show about how alive a competition is
=======================================================================================================================================
Purpose: SQL fragments for "how much has actually happened in this competition" — real players,
         picks ever made, and when a person last did something. Shared by the three admin routes
         so a figure on one screen means the same as the figure on another.

THIS FILE NO LONGER DECIDES ANYTHING (2026-09-04). It used to carry classifyCompetition, a derived
"stalled" rule — no real players or no picks, quiet 7 days — which the Competitions, Stats and
Organisers screens each ran to work out what to count. That rule is gone, replaced by
competition.archived_at: an admin presses Archive, and archived is what that means.

Why the rule went, since it was doing a real job. It was invented because the counts flattered —
seven of thirty rows sat in the "Active" tile having never seen a pick. But it could only ever be
evaluated in JavaScript (it needs three facts and a clock), and "never a second copy in SQL" then
forced every consumer into a first round trip over the whole competition table before it could ask
its actual question. One column removes all three copies of that dance, and makes the same answer
available to anything else that needs it — the email candidate queries being the reason this came
up at all, since none of them could have run the JS rule.

What replaced the rule's OTHER job — pointing at the dead ones so somebody notices — is the numbers
below, shown on the Competitions screen as a sortable "quiet Nd" column. DERIVE TO INFORM, NEVER TO
DECIDE. That split is the whole design: a calculation that only ever renders can be wrong without
costing anything, which is what let the decision move to a human without losing the signal.

The tri-state override went with it. archived_at is a timestamp or it is nothing; there is no
"cleared by an admin" case to represent. The false leg — rescue a competition the rule has
wrongly written off — was never used on a single row, which is the clearest evidence there was
that the calculation was doing work nobody wanted done.
=======================================================================================================================================
*/

const { BOT_EMAIL_LIKE } = require('./botPool');

/*
SQL fragments for the facts the screens display. Correlated on an alias the caller supplies, and
taking the bind placeholder holding BOT_EMAIL_LIKE by name ($2, $3...) so the caller keeps
ownership of both its FROM clause and its parameter list.

"Real" players exclude the organiser (who is a member of their own competition in almost every
case, so a member count of 1 means nobody came) and bots (placeholder seeding, never evidence
that a person showed up).
*/
const realPlayerCountSql = (comp, botParam) => `
  (SELECT COUNT(*)
     FROM competition_user cu
     JOIN app_user au ON au.id = cu.user_id
    WHERE cu.competition_id = ${comp}.id
      AND cu.user_id IS DISTINCT FROM ${comp}.organiser_id
      AND au.email NOT LIKE ${botParam})`;

const pickCountSql = (comp) => `
  (SELECT COUNT(*)
     FROM pick p
     JOIN round r ON r.id = p.round_id
    WHERE r.competition_id = ${comp}.id)`;

/*
When something last happened IN this competition, which the screen turns into "quiet Nd".

IT LIVES HERE BECAUSE IT HAD THREE COPIES (2026-09-01). get-admin-competitions, get-admin-stats
and get-admin-organisers each carried the same GREATEST spelled out. It drove the stalled rule
then and only drives a column now, but the reason for one definition is unchanged: two screens
showing a different "last activity" for the same competition is a bug either way.

WHAT COUNTS, and the line it draws: things PEOPLE did in this competition.

  - the latest pick        somebody played
  - the latest join        somebody turned up. This arm is why the expression exists at all -
                           picks alone showed a SETUP competition as untouched since the day it
                           was created however many people had joined since (comp 173 read
                           "29 June" on a day somebody joined it)
  - the competition's own created_at, so a brand new one is never "quiet since never"

WHAT DOES NOT COUNT: MAX(round.created_at), removed 2026-09-01. A fixture push creates a round, so
every push stamped every competition it touched with the push time - one morning's batch moved
fourteen competitions to "today" when four had seen no player activity since 24-28 August. A round
arriving is a thing WE did, on our own schedule, to every eligible competition at once; it is not
evidence anybody is using it.

GREATEST ignores NULLs and comp.created_at is NOT NULL, so this always resolves.

  @param {string} comp - the caller's competition alias, e.g. 'c'
*/
const lastActivitySql = (comp) => `
  GREATEST(
    (SELECT MAX(p.created_at)
       FROM pick p
       JOIN round r ON r.id = p.round_id
      WHERE r.competition_id = ${comp}.id),
    (SELECT MAX(cu.joined_at)
       FROM competition_user cu
      WHERE cu.competition_id = ${comp}.id),
    ${comp}.created_at
  )`;

/**
 * Whole days since a person last did anything here. Display only — nothing branches on it.
 *
 * @param {string|Date} lastActivity - the value of lastActivitySql for this row
 * @returns {number}
 */
function quietDays(lastActivity) {
  return Math.floor((Date.now() - new Date(lastActivity).getTime()) / 86400000);
}

module.exports = {
  BOT_EMAIL_LIKE,
  realPlayerCountSql,
  pickCountSql,
  lastActivitySql,
  quietDays
};
