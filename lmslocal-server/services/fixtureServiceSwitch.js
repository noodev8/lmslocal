/*
=======================================================================================================================================
Service: fixtureServiceSwitch
=======================================================================================================================================
Purpose: The safety check shared by every route that turns competition.fixture_service ON.

         Two routes flip this flag - admin/set-fixture-service.js (us, from the admin tool) and
         set-fixture-service-organiser.js (the organiser, from competition settings). They must
         agree, and both must agree with the push in services/fixtureService.js, which is why the
         check lives here rather than being written out twice.

         Only switching ON is guarded. Switching off hands control back to the organiser, which
         is always safe.
=======================================================================================================================================
Why the checks exist:

  ROUND_IN_PROGRESS - turning the service on mid-round strands the competition with nobody able
  to move it forward on the organiser's side: the push refuses to touch a competition whose
  latest round still has unresulted fixtures (fixtureService.js checks this before adding
  anything), and the moment the flag flips the organiser loses result entry - organizer-set-result
  rejects when fixture_service !== false.

  Admin CAN rescue a round in this state - push-results-to-competitions matches purely on
  home_team_short + away_team_short + kickoff_time (gameweek was removed from fixture_load
  entirely, see db/migrations/2026-08-02-fixture-load-single-batch.sql), so staging the same
  fixtures in the admin tool and pushing results resolves an existing manually-run round just
  fine. That is what allowUnfinishedRound is for below - an explicit, admin-only escape hatch for
  exactly that rescue. The organiser route never passes it, so organisers still cannot strand
  themselves this way; only admin can choose to take over a round deliberately.

  ROUND_NOT_PROCESSED - "every fixture has a result" is not "the round is finished". Applying
  those results is a separate step, recorded in fixture.processed. Switching in that state loses
  the round permanently: push-results only processes competitions whose fixtures it just updated
  and it matches result IS NULL, so a fully resulted round is never picked up, while push-fixtures
  sees a resulted round and simply builds the next one on top. The eliminations would never apply
  and players who should be out would carry on.
=======================================================================================================================================
*/

const { query } = require('../database');

/**
 * Decide whether a competition can safely be switched ON to the fixture service.
 *
 * @param {object} competition - row with at least { id, status }
 * @param {function} exec - optional (sql, params) executor, so this can run inside an open
 *                          transaction. Defaults to the pool.
 * @param {object} [options]
 * @param {boolean} [options.allowUnfinishedRound] - admin-only escape hatch. Skips the
 *   ROUND_IN_PROGRESS refusal so admin can take over an organiser-run round mid-flight and finish
 *   it via the admin results push. Never set by the organiser's own route - see the header above.
 *   ROUND_NOT_PROCESSED and COMPETITION_COMPLETE are unaffected by this and still block.
 * @returns {Promise<object|null>} null when safe, otherwise a ready-to-send response body
 *                                 ({ return_code, message, ...context })
 */
async function checkSafeToEnable(competition, exec = query, options = {}) {
  const { allowUnfinishedRound = false } = options;

  // Status casing is inconsistent in production ('SETUP', 'COMPLETE', lowercase 'active'),
  // so compare case-insensitively - see db/README.md.
  if (String(competition.status).toUpperCase() === 'COMPLETE') {
    return {
      return_code: 'COMPETITION_COMPLETE',
      message: 'This competition has finished, so the fixture service would never push to it'
    };
  }

  // Same inspection the push makes: look at the latest round only. A round with no fixtures is
  // fine (the push fills it), and a fully resulted and processed round is fine (the push adds the
  // next one). Anything in between is the case that has nobody able to move it forward.
  const roundResult = await exec(`
    SELECT
      r.round_number,
      COUNT(f.id)        AS total_fixtures,
      COUNT(f.result)    AS resulted_fixtures,
      COUNT(f.processed) AS processed_fixtures
    FROM round r
    LEFT JOIN fixture f ON f.round_id = r.id
    WHERE r.competition_id = $1
      AND r.round_number = (SELECT MAX(round_number) FROM round WHERE competition_id = $1)
    GROUP BY r.round_number
  `, [competition.id]);

  const latestRound = roundResult.rows[0];
  if (!latestRound) {
    return null; // No rounds yet - nothing to strand.
  }

  const total = parseInt(latestRound.total_fixtures, 10);
  const resulted = parseInt(latestRound.resulted_fixtures, 10);
  const processed = parseInt(latestRound.processed_fixtures, 10);

  if (total > 0 && resulted < total && !allowUnfinishedRound) {
    return {
      return_code: 'ROUND_IN_PROGRESS',
      message:
        `Round ${latestRound.round_number} has ${total - resulted} of ${total} fixtures ` +
        `still to be resulted. Switching now would leave it stuck - the fixture service ` +
        `will not advance a round that is in progress, and result entry is disabled as soon ` +
        `as this is on. Wait until the round is finished.`,
      round_number: latestRound.round_number,
      total_fixtures: total,
      unresolved_fixtures: total - resulted
    };
  }

  if (total > 0 && processed < total) {
    return {
      return_code: 'ROUND_NOT_PROCESSED',
      message:
        `Round ${latestRound.round_number} has all ${total} results in but ` +
        `${total - processed} not yet processed, so its eliminations have not been ` +
        `applied. Nothing would apply them after the switch. Process the round first.`,
      round_number: latestRound.round_number,
      total_fixtures: total,
      unprocessed_fixtures: total - processed
    };
  }

  return null;
}

/**
 * Decide whether a competition's latest round is a stalled setup round that can be safely
 * thrown away, so the fixture service can take the competition over from round 1.
 *
 * This is the common drop-off: an organiser creates the competition, adds round 1's fixtures,
 * and never comes back. checkSafeToEnable correctly refuses those with ROUND_IN_PROGRESS - the
 * push will not advance a round with unresulted fixtures, so flipping the flag alone would
 * strand them. Clearing the dead round is what actually unblocks it.
 *
 * All four conditions must hold, and each rules out a different kind of "something happened":
 *
 *   status = SETUP     - the competition was never started
 *   no results         - no fixture has been resulted, so nothing has been decided
 *   no picks           - no player has chosen. Because every path that deletes a pick either
 *                        restores allowed_teams (unselect-pick, admin-set-pick) or deletes the
 *                        player outright (remove-player), an empty pick set genuinely means no
 *                        team was ever consumed - there is nothing to give back.
 *   no player_progress - the sharper one. Progress rows are written at result-processing time
 *                        (organizer-process-results), and one of those branches penalises
 *                        players who did NOT pick. So a round can hold zero picks and still have
 *                        deducted lives. Checking picks alone would miss it.
 *
 * Anything short of all four falls back to the ROUND_IN_PROGRESS refusal, which is why this
 * never has to decide whether a given amount of player activity is "small enough" to discard.
 *
 * @param {object} competition - row with at least { id, status }
 * @param {function} exec - optional (sql, params) executor, so this can be re-run inside the
 *                          transaction that performs the delete.
 * @returns {Promise<object|null>} null when the round must not be cleared, otherwise
 *                                 { round_id, round_number, fixture_count }
 */
async function checkClearableStalledRound(competition, exec = query) {
  if (String(competition.status).toUpperCase() !== 'SETUP') {
    return null;
  }

  const result = await exec(`
    SELECT
      r.id           AS round_id,
      r.round_number,
      COUNT(DISTINCT f.id)  AS fixture_count,
      COUNT(DISTINCT f.result) AS resulted_count,
      COUNT(DISTINCT p.id)  AS pick_count,
      COUNT(DISTINCT pp.id) AS progress_count
    FROM round r
    LEFT JOIN fixture f ON f.round_id = r.id
    LEFT JOIN pick p ON p.round_id = r.id
    LEFT JOIN player_progress pp ON pp.round_id = r.id
    WHERE r.competition_id = $1
      AND r.round_number = (SELECT MAX(round_number) FROM round WHERE competition_id = $1)
    GROUP BY r.id, r.round_number
  `, [competition.id]);

  const round = result.rows[0];
  if (!round) {
    return null; // No round to clear.
  }

  if (parseInt(round.resulted_count, 10) > 0) return null;
  if (parseInt(round.pick_count, 10) > 0) return null;
  if (parseInt(round.progress_count, 10) > 0) return null;

  return {
    round_id: round.round_id,
    round_number: round.round_number,
    fixture_count: parseInt(round.fixture_count, 10)
  };
}

module.exports = { checkSafeToEnable, checkClearableStalledRound };
