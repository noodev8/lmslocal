/*
=======================================================================================================================================
services/competitionEngagement.js — is this competition real, or is somebody kicking tyres?
=======================================================================================================================================
A competition that reaches ACTIVE and is then abandoned never leaves the "Active" tile. Comp 176
sat there from 16 July with one member (its own organiser) and not a single pick ever made, and
comp 179 the same from 1 August. Seven of thirty rows were like that, which made the headline
counts on the admin Competitions screen wrong in the flattering direction.

THE RULE, in one place because the count, the tab and the badge must never disagree:

  A competition is STALLED when nobody but the organiser has done anything, and it has gone
  quiet. Concretely - no real players (members who are neither the organiser nor a bot) OR no
  pick ever made, AND nothing has happened for QUIET_DAYS.

Three deliberate exemptions:

- COMPLETE competitions are never stalled. It ran, it finished, it is history - and a two-player
  competition that went the distance is exactly the thing this must not throw away.
- Anything that has been quiet for less than QUIET_DAYS is "new": too early to judge. An
  organiser who signs up on the Friday and recruits over the weekend is not a tyre kicker on the
  Saturday.
- competition.stalled_override, when set, wins outright - see below.

The signal is this blunt because the data is: every genuine competition on the platform had picks
within days of being created, and every dead one had none at all. Player counts alone would not
do it (comp 226 had 24 members before it started), and last-activity alone would not either (a
mid-season competition between gameweeks is quiet and perfectly healthy).

MANUAL OVERRIDE. competition.stalled_override is a tri-state: NULL trusts the calculation, true
forces stalled, false forces real. It exists because no rule survives contact with the real
world in both directions - a slow-burn competition that is genuinely coming needs rescuing from
the calculation, and an obvious write-off inside the quiet window needs condemning before it.
It is an override, not a cache: nothing writes the derived answer into it.
=======================================================================================================================================
*/

const { BOT_EMAIL_LIKE } = require('./botPool');

// How long a competition must have shown no sign of life before the calculation will call it.
// Seven days: long enough that a weekend of recruiting is not misread, short enough that the
// counts are honest within a week rather than a month.
const QUIET_DAYS = 7;

/*
SQL fragments for the two facts the rule needs beyond what the competitions query already has.
Correlated on an alias the caller supplies, and taking the bind placeholder holding BOT_EMAIL_LIKE
by name ($2, $3...) so the caller keeps ownership of both its FROM clause and its parameter list.

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

/**
 * Classify one competition.
 *
 * @param {object} row
 * @param {string} row.status            - lowercased competition status
 * @param {number} row.real_player_count - members who are neither the organiser nor a bot
 * @param {number} row.pick_count        - picks ever made, across every round
 * @param {string|Date} row.last_activity
 * @param {boolean|null} row.stalled_override
 * @returns {{is_stalled: boolean, stalled_source: 'derived'|'admin', stalled_reason: string|null, quiet_days: number}}
 */
function classifyCompetition(row) {
  const lastActivity = new Date(row.last_activity);
  const quietDays = Math.floor((Date.now() - lastActivity.getTime()) / 86400000);

  const realPlayers = Number(row.real_player_count) || 0;
  const picks = Number(row.pick_count) || 0;

  // Reasons are assembled even when an override is in force, so the screen can show what the
  // calculation thought alongside the admin's decision to disagree with it.
  const nobodyCame = realPlayers === 0;
  const nothingPlayed = picks === 0;

  const derivedStalled =
    row.status !== 'complete' &&
    quietDays >= QUIET_DAYS &&
    (nobodyCame || nothingPlayed);

  const isStalled = typeof row.stalled_override === 'boolean'
    ? row.stalled_override
    : derivedStalled;

  let reason = null;
  if (typeof row.stalled_override === 'boolean') {
    reason = row.stalled_override ? 'Marked by an admin' : 'Cleared by an admin';
  } else if (derivedStalled) {
    // Both halves can be true at once; say the stronger one, since "nobody joined" explains
    // "nothing was played" but not the other way round.
    reason = nobodyCame
      ? `Nobody joined, quiet ${quietDays}d`
      : `No picks ever made, quiet ${quietDays}d`;
  }

  return {
    is_stalled: isStalled,
    stalled_source: typeof row.stalled_override === 'boolean' ? 'admin' : 'derived',
    stalled_reason: reason,
    quiet_days: quietDays
  };
}

module.exports = {
  QUIET_DAYS,
  BOT_EMAIL_LIKE,
  realPlayerCountSql,
  pickCountSql,
  classifyCompetition
};
