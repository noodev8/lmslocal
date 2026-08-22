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
/**
 * Whether a staged batch could actually reach this round's unresolved fixtures.
 *
 * Taking an organiser's round over is only half the job. The results push matches a staged row
 * to a competition's fixture on home team + away team + AND kickoff time, and an organiser who
 * keyed their own round chose that kickoff themselves - usually their own pick deadline rather
 * than the real one. Two of the three columns agree and the third does not, so the competition
 * matches nothing, never appears on the push screen, and its round is stranded with nobody able
 * to resolve it: the organiser has lost result entry and the service cannot see it.
 *
 * That is not hypothetical. Marshfield JYFC (57 players, all picked, sudden death) was taken
 * over mid-round with fixtures keyed for Thursday 19:30 against a batch kicking off Friday
 * 20:00, and simply vanished. It took a hand-written UPDATE to rescue.
 *
 * So: count how many of the unresolved fixtures a staged batch would match. Reported, not
 * refused - the admin may be switching a competition whose batch is not staged yet, and the
 * dates could line up perfectly later. What matters is that the dialog can say so before the
 * override is taken, rather than the answer arriving at push time as an absence.
 *
 * @returns {Promise<{batch_staged: boolean, matched_fixtures: number, round_kickoff: string|null,
 *                    batch_kickoff: string|null}>}
 */
async function checkBatchReach(competition, roundId, exec) {
  const result = await exec(`
    SELECT
      (SELECT COUNT(*) FROM fixture_load WHERE team_list_id = $2)   AS staged_rows,
      (SELECT MIN(kickoff_time) FROM fixture_load
        WHERE team_list_id = $2)                                    AS batch_kickoff,
      MIN(f.kickoff_time)                                           AS round_kickoff,
      COUNT(fl.fixture_id)                                          AS matched_fixtures
    FROM fixture f
    LEFT JOIN fixture_load fl
      ON fl.team_list_id = $2
     AND fl.home_team_short = f.home_team_short
     AND fl.away_team_short = f.away_team_short
     AND fl.kickoff_time = f.kickoff_time
    WHERE f.round_id = $1
      AND f.result IS NULL
  `, [roundId, competition.team_list_id]);

  const row = result.rows[0] || {};

  return {
    batch_staged: parseInt(row.staged_rows, 10) > 0,
    matched_fixtures: parseInt(row.matched_fixtures, 10) || 0,
    round_kickoff: row.round_kickoff || null,
    batch_kickoff: row.batch_kickoff || null
  };
}

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
      r.id AS round_id,
      r.round_number,
      COUNT(f.id)        AS total_fixtures,
      COUNT(f.result)    AS resulted_fixtures,
      COUNT(f.processed) AS processed_fixtures
    FROM round r
    LEFT JOIN fixture f ON f.round_id = r.id
    WHERE r.competition_id = $1
      AND r.round_number = (SELECT MAX(round_number) FROM round WHERE competition_id = $1)
    GROUP BY r.id, r.round_number
  `, [competition.id]);

  const latestRound = roundResult.rows[0];
  if (!latestRound) {
    return null; // No rounds yet - nothing to strand.
  }

  const total = parseInt(latestRound.total_fixtures, 10);
  const resulted = parseInt(latestRound.resulted_fixtures, 10);
  const processed = parseInt(latestRound.processed_fixtures, 10);

  if (total > 0 && resulted < total && !allowUnfinishedRound) {
    const reach = await checkBatchReach(competition, latestRound.round_id, exec);

    return {
      return_code: 'ROUND_IN_PROGRESS',
      message:
        `Round ${latestRound.round_number} has ${total - resulted} of ${total} fixtures ` +
        `still to be resulted. Switching now would leave it stuck - the fixture service ` +
        `will not advance a round that is in progress, and result entry is disabled as soon ` +
        `as this is on. Wait until the round is finished.`,
      round_number: latestRound.round_number,
      total_fixtures: total,
      unresolved_fixtures: total - resulted,
      ...reach
    };
  }

  // resulted === total is required here, not just implied by having fallen through the check
  // above - that check can now be bypassed by allowUnfinishedRound, and without this guard an
  // unresulted round (resulted=0, processed=0) would wrongly trip this branch too, since
  // processed < total is true either way.
  if (total > 0 && resulted === total && processed < total) {
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
  *                        frees the team again (unselect-pick, admin-set-pick) or deletes the
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
