/*
=======================================================================================================================================
services/pickProgress.js — how many picks are in, and how many are still owed
=======================================================================================================================================
The one definition of a competition's CURRENT ROUND and its pick progress, shared by the admin
Competitions list (a single at-a-glance cell per row) and the per-competition stats screen (the
same figure, plus the names behind it).

Same reason evaluateCompetition lives in services/fixtureService.js: a list that says "14/18" and
a detail screen that then says "13 of 17" is worse than neither, because there is no way to tell
from the outside which one lied.

THE DEFINITIONS

  Current round   The competition's highest round_number. Not "the open one" - a competition
                  between gameweeks has a locked latest round and that is still the round you are
                  looking at. Whether it is open is a separate flag (is_locked), so the screen can
                  say "4 still to pick" or "4 never picked" from the same two numbers.

  Players due     Members with competition_user.status = 'active'. Eliminated players owe nothing.
                  This matches "still in" on the Competitions list, deliberately - the two columns
                  sit inches apart and must mean the same thing.

  Picks made      Picks for that round BY THOSE SAME ACTIVE MEMBERS. The population has to match
                  the denominator or the fraction is nonsense: once a round is resulted the losers
                  flip to 'out' and take their picks with them, and counting every pick row
                  against a shrunken denominator would read 9/4.

  Outstanding     due - made. Split out by bot, because a competition showing four outstanding
                  that is four bots is not a competition anyone needs to chase; bots pick when
                  admin tells them to (services/botPool.js, /admin/set-bot-picks).

WHAT THIS IS NOT

Not services/pickReminder.js. That answers "who should we email", which is a narrower question
carrying a 24-hour window, an opt-out check, a guest-email exclusion and a
don't-send-twice guard. None of those belong in a count of who has picked. The two numbers are
allowed to differ and usually will.
=======================================================================================================================================
*/

const { BOT_EMAIL_LIKE } = require('./botPool');

/*
The current round and its pick progress, as a LATERAL the caller joins onto its competition alias.

A LATERAL rather than four correlated subselects so the round is located once per competition
instead of once per column - the list query already carries a dozen subselects and this is the
one place that would have multiplied them.

LEFT JOIN it (ON TRUE): a competition with no round yet is normal, not an error, and every
column below comes back NULL for it.

  @param {string} comp     - the caller's competition alias, e.g. 'c'
  @param {string} botParam - the caller's bind placeholder holding BOT_EMAIL_LIKE, e.g. '$2'
*/
const currentRoundProgressLateral = (comp, botParam) => `
  LEFT JOIN LATERAL (
    SELECT
      r.id                                                   AS current_round_id,
      r.round_number                                         AS current_round_number,
      r.lock_time                                            AS current_round_lock_time,
      (SELECT COUNT(*)
         FROM competition_user cu
        WHERE cu.competition_id = ${comp}.id
          AND cu.status = 'active')                          AS players_due,
      (SELECT COUNT(*)
         FROM pick p
         JOIN competition_user cu ON cu.competition_id = ${comp}.id
                                 AND cu.user_id = p.user_id
                                 AND cu.status = 'active'
        WHERE p.round_id = r.id)                             AS picks_made,
      -- Outstanding that is only bots. Counted here rather than subtracted on the client so the
      -- screen never has to know what a bot is.
      (SELECT COUNT(*)
         FROM competition_user cu
         JOIN app_user au ON au.id = cu.user_id
        WHERE cu.competition_id = ${comp}.id
          AND cu.status = 'active'
          AND au.email LIKE ${botParam}
          AND NOT EXISTS (SELECT 1 FROM pick p
                           WHERE p.round_id = r.id AND p.user_id = cu.user_id))
                                                             AS bots_outstanding
    FROM round r
    WHERE r.competition_id = ${comp}.id
    ORDER BY r.round_number DESC
    LIMIT 1
  ) pick_progress ON TRUE`;

/**
 * Turn the LATERAL's raw columns into the shape both screens read.
 *
 * @param {object} row - a row from a query carrying currentRoundProgressLateral's columns
 * @returns {{current_round: object|null}}
 */
function describePickProgress(row) {
  if (row.current_round_id === null || row.current_round_id === undefined) {
    return { current_round: null };
  }

  const due = parseInt(row.players_due, 10) || 0;
  const made = parseInt(row.picks_made, 10) || 0;
  const botsOutstanding = parseInt(row.bots_outstanding, 10) || 0;

  // Clamped at zero. It cannot go negative given the population match above, but this figure is
  // read as "how many people do I need to chase" and a negative would be actively misleading.
  const outstanding = Math.max(due - made, 0);

  const lockTime = row.current_round_lock_time;

  return {
    current_round: {
      round_id: row.current_round_id,
      round_number: row.current_round_number,
      lock_time: lockTime,
      is_locked: lockTime !== null && new Date(lockTime).getTime() <= Date.now(),
      players_due: due,
      picks_made: made,
      picks_outstanding: outstanding,
      bots_outstanding: botsOutstanding,
      real_outstanding: Math.max(outstanding - botsOutstanding, 0)
    }
  };
}

module.exports = {
  BOT_EMAIL_LIKE,
  currentRoundProgressLateral,
  describePickProgress
};
