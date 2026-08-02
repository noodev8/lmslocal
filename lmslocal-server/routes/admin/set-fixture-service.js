/*
=======================================================================================================================================
API Route: set-fixture-service
=======================================================================================================================================
Method: POST
Purpose: Opt a competition into or out of the automated fixture service.

         competition.fixture_service is the flag every push reads: fixtures and results only
         reach competitions where it is true (services/fixtureService.js, and the UPDATE in
         push-results-to-competitions). Until now nothing could set it - create-competition
         hardcodes false and no route ever changed it - so opting a competition in meant a
         hand-written UPDATE against the production database.
=======================================================================================================================================
Request Payload:
{
  "competition_id": 42,                      // integer, required
  "fixture_service": true                    // boolean, required - true to opt in, false to opt out
}

Success Response (ALWAYS HTTP 200):
{
  "return_code": "SUCCESS",
  "competition_id": 42,                      // integer
  "competition_name": "Friday Night LMS",    // string
  "fixture_service": true,                   // boolean, the value now stored
  "team_list_id": 1                          // integer, which staged fixtures it will now receive
}

Error Response (ALWAYS HTTP 200):
{
  "return_code": "ERROR_TYPE",
  "message": "Descriptive error message"
}
=======================================================================================================================================
Return Codes:
"SUCCESS"
"VALIDATION_ERROR"          - competition_id missing, or fixture_service not a boolean
"COMPETITION_NOT_FOUND"     - No competition with that id
"COMPETITION_COMPLETE"      - Competition has finished; opting it in would do nothing
"ROUND_IN_PROGRESS"         - Latest round has unresulted fixtures; switching now would strand it
"ROUND_NOT_PROCESSED"       - Latest round is resulted but its eliminations have not been applied
"UNAUTHORIZED"              - Missing, invalid, expired, or non-admin token
"TOKEN_EXPIRED"             - Admin session has expired
"SERVER_ERROR"              - Database error or unexpected server failure
=======================================================================================================================================
Data Notes:
- Opting in does not backfill. The next push gives the competition the earliest gameweek whose
  kickoff clears its earliest_start_date; rounds it missed while opted out stay missed.
- Opting in a competition that has been run manually is allowed, but only at a round boundary -
  see ROUND_IN_PROGRESS below.
- Opting out is not retroactive either - rounds already pushed stay, and results already staged
  for them will still be applied while the round exists.
- Player history survives the switch. The push backfills allowed_teams only for players who have
  no rows at all (services/fixtureService.js), so a manually-run competition keeps its
  no-team-twice state rather than handing used teams back.
- The switch is not silent to players: the next push queues new_round and pick_reminder
  notifications for every active player with a device token.
- Every change writes an audit_log row, because from the organiser's side a competition that
  suddenly starts creating its own rounds is otherwise unexplained.

Why ROUND_IN_PROGRESS exists:

  Turning the service on mid-round strands the competition with nobody able to move it forward.
  The push refuses to touch a competition whose latest round still has unresulted fixtures
  (fixtureService.js checks this before adding anything), and the moment the flag flips the
  organiser loses result entry - organizer-set-result rejects when fixture_service !== false.
  So the round cannot be finished by the organiser and cannot be advanced by the service.

  An admin cannot rescue it either: manually added fixtures carry gameweek 0, and
  push-results only ever matches staged rows with gameweek > 0.

  Switching at a round boundary avoids all of it, so that is the only time this allows it. Note
  the check is deliberately the same shape as the push's own, so the two cannot disagree about
  what "in progress" means.

  ROUND_NOT_PROCESSED is the second half of the same idea. "Every fixture has a result" is not
  the same as "the round is finished" - applying those results is a separate step, recorded in
  fixture.processed. A resulted-but-unprocessed round would be silently abandoned by the switch,
  so it is refused too. See the comment at the check itself for why nothing picks it up.
=======================================================================================================================================
*/

const express = require('express');
const { query, transaction } = require('../../database');
const { logApiCall } = require('../../utils/apiLogger');
const { verifyAdminToken } = require('../../middleware/admin-auth');
const router = express.Router();

router.post('/', verifyAdminToken, async (req, res) => {
  logApiCall('set-fixture-service');

  try {
    const { competition_id, fixture_service } = req.body;

    if (!Number.isInteger(competition_id)) {
      return res.json({
        return_code: 'VALIDATION_ERROR',
        message: 'competition_id is required'
      });
    }

    if (typeof fixture_service !== 'boolean') {
      return res.json({
        return_code: 'VALIDATION_ERROR',
        message: 'fixture_service must be true or false'
      });
    }

    const existing = await query(
      'SELECT id, name, status, team_list_id FROM competition WHERE id = $1',
      [competition_id]
    );

    if (existing.rows.length === 0) {
      return res.json({
        return_code: 'COMPETITION_NOT_FOUND',
        message: 'No competition with that id'
      });
    }

    const competition = existing.rows[0];

    // Status casing is inconsistent in production ('SETUP', 'COMPLETE', lowercase 'active'),
    // so compare case-insensitively - see db/README.md.
    if (fixture_service === true && String(competition.status).toUpperCase() === 'COMPLETE') {
      return res.json({
        return_code: 'COMPETITION_COMPLETE',
        message: 'This competition has finished, so the fixture service would never push to it'
      });
    }

    // Only switching ON can strand a round. Switching off hands control back to the organiser,
    // which is always safe.
    if (fixture_service === true) {
      // Same inspection the push makes: look at the latest round only. A round with no fixtures
      // is fine (the push fills it), and a fully resulted round is fine (the push adds the next
      // one). Anything in between is the case that has nobody able to move it forward.
      const roundResult = await query(`
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
      `, [competition_id]);

      const latestRound = roundResult.rows[0];

      if (latestRound) {
        const total = parseInt(latestRound.total_fixtures, 10);
        const resulted = parseInt(latestRound.resulted_fixtures, 10);
        const processed = parseInt(latestRound.processed_fixtures, 10);

        if (total > 0 && resulted < total) {
          return res.json({
            return_code: 'ROUND_IN_PROGRESS',
            message:
              `Round ${latestRound.round_number} has ${total - resulted} of ${total} fixtures ` +
              `still to be resulted. Switching now would leave it stuck - the fixture service ` +
              `will not advance a round that is in progress, and the organiser loses result ` +
              `entry as soon as this is on. Wait until the round is finished.`,
            round_number: latestRound.round_number,
            total_fixtures: total,
            unresolved_fixtures: total - resulted
          });
        }

        // Resulted is not the same as finished. A round can hold every result and still not
        // have had them applied - eliminations, no-pick penalties and the winner check all
        // happen in a separate processing step, recorded in fixture.processed.
        //
        // Switching in that state loses the round permanently: push-results only processes
        // competitions whose fixtures it just updated, and it matches result IS NULL, so a
        // fully resulted round is never picked up. push-fixtures meanwhile sees a resulted
        // round and simply builds the next one on top. The eliminations would never apply and
        // players who should be out would carry on.
        if (total > 0 && processed < total) {
          return res.json({
            return_code: 'ROUND_NOT_PROCESSED',
            message:
              `Round ${latestRound.round_number} has all ${total} results in but ` +
              `${total - processed} not yet processed, so its eliminations have not been ` +
              `applied. Nothing would apply them after the switch. Ask the organiser to ` +
              `process the round first.`,
            round_number: latestRound.round_number,
            total_fixtures: total,
            unprocessed_fixtures: total - processed
          });
        }
      }
    }

    // Flag and audit row together, so the trail cannot end up disagreeing with the flag.
    await transaction(async (client) => {
      await client.query(
        'UPDATE competition SET fixture_service = $1 WHERE id = $2',
        [fixture_service, competition_id]
      );

      await client.query(`
        INSERT INTO audit_log (competition_id, user_id, action, details)
        VALUES ($1, $2, 'Fixture Service Changed', $3)
      `, [
        competition_id,
        req.admin.id,
        `Fixture service ${fixture_service ? 'enabled' : 'disabled'} by admin ${req.admin.email}`
      ]);
    });

    return res.json({
      return_code: 'SUCCESS',
      competition_id,
      competition_name: competition.name,
      fixture_service,
      team_list_id: competition.team_list_id
    });

  } catch (error) {
    console.error('set-fixture-service error:', error.message);
    return res.json({
      return_code: 'SERVER_ERROR',
      message: 'Could not change the fixture service setting'
    });
  }
});

module.exports = router;
