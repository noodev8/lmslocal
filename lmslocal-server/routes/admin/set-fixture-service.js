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
  "fixture_service": true,                   // boolean, required - true to opt in, false to opt out
  "override_round_in_progress": false        // boolean, optional - admin-only escape hatch, see below
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
- Opting in does not backfill. The next push gives the competition whatever batch is currently
  staged, once it clears the eligibility rules in services/fixtureService.js; rounds it missed while opted out stay
  missed.
- Opting in a competition that has been run manually is allowed at a round boundary without any
  extra flag - see ROUND_IN_PROGRESS below. Mid-round, it needs override_round_in_progress.
- Opting out is not retroactive either - rounds already pushed stay, and results already staged
  for them will still be applied while the round exists.
- Player history survives the switch. Nothing is backfilled - the no-team-twice rule reads
  no rows at all (services/fixtureService.js), so a manually-run competition keeps its
  no-team-twice state rather than handing used teams back.
- The switch is not silent to players: the next push queues new_round and pick_reminder
  notifications for every active player with a device token.
- Every change writes an audit_log row, because from the organiser's side a competition that
  suddenly starts creating its own rounds is otherwise unexplained.

Why ROUND_IN_PROGRESS and ROUND_NOT_PROCESSED exist:

  See services/fixtureServiceSwitch.js, which holds both checks and the reasoning. They are
  shared with set-fixture-service-organiser.js (the organiser doing this themselves from
  competition settings) so the two routes cannot disagree about what "in progress" means -
  and so neither can disagree with the push's own check in services/fixtureService.js.

  override_round_in_progress is this route's alone - set-fixture-service-organiser.js never
  passes it, so an organiser can never strand themselves this way. It exists because admin CAN
  finish an in-progress round after switching (stage the same fixtures and push results - the
  match no longer needs the round to have originated from the fixture service, see
  fixtureServiceSwitch.js), so the refusal is only protecting against the organiser losing
  manual entry with nobody able to finish the round - not admin, who is the one finishing it.
  ROUND_NOT_PROCESSED has no such override: an unprocessed but fully-resulted round is never
  picked up by push-results either (it only matches result IS NULL), so there is no rescue path
  for admin there - it must be processed the normal way first, same as always.

  This route is the admin path: no ownership check, and it can opt a competition into a team
  list we do not currently stage. The organiser route is narrower on both counts.
=======================================================================================================================================
*/

const express = require('express');
const { query, transaction } = require('../../database');
const { logApiCall } = require('../../utils/apiLogger');
const { verifyAdminToken } = require('../../middleware/admin-auth');
const { checkSafeToEnable } = require('../../services/fixtureServiceSwitch');
const router = express.Router();

router.post('/', verifyAdminToken, async (req, res) => {
  logApiCall('set-fixture-service');

  try {
    const { competition_id, fixture_service, override_round_in_progress } = req.body;

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

    // Only switching ON can strand a round. Switching off hands control back to the organiser,
    // which is always safe. The checks live in services/fixtureServiceSwitch.js because the
    // organiser-facing route applies exactly the same ones - see the header there for why each
    // exists.
    if (fixture_service === true) {
      const blocked = await checkSafeToEnable(competition, query, {
        allowUnfinishedRound: override_round_in_progress === true
      });
      if (blocked) {
        return res.json(blocked);
      }
    }

    // Flag and audit row together, so the trail cannot end up disagreeing with the flag.
    await transaction(async (client) => {
      await client.query(
        'UPDATE competition SET fixture_service = $1 WHERE id = $2',
        [fixture_service, competition_id]
      );

      const overrideNote = override_round_in_progress === true
        ? ' (round was in progress - admin chose to take it over)'
        : '';

      await client.query(`
        INSERT INTO audit_log (competition_id, user_id, action, details)
        VALUES ($1, $2, 'Fixture Service Changed', $3)
      `, [
        competition_id,
        req.admin.id,
        `Fixture service ${fixture_service ? 'enabled' : 'disabled'} by admin ${req.admin.email}${overrideNote}`
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
