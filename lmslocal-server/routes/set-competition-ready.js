/*
=======================================================================================================================================
API Route: set-competition-ready
=======================================================================================================================================
Method: POST
Purpose: Organiser declares their competition ready to start, so the fixture service may give it
         its first round. Also un-declares it.
=======================================================================================================================================
Request Payload:
{
  "competition_id": 123,                   // integer, required - competition to mark
  "ready": true                            // boolean, required - true to start, false to hold
}

Success Response (ALWAYS HTTP 200):
{
  "return_code": "SUCCESS",
  "ready_at": "2026-08-06T10:30:00.000Z",  // string|null, when they pressed it (null once held)
  "round_started": true,                   // boolean, a first round was published then and there
  "round_number": 1,                       // integer|null, which round that was (null if none)
  "message": "Competition is ready to start"
}

Error Response (ALWAYS HTTP 200):
{
  "return_code": "ERROR_TYPE",
  "message": "Descriptive error message"
}
=======================================================================================================================================
Return Codes:
"SUCCESS"
"VALIDATION_ERROR"
"COMPETITION_NOT_FOUND"
"UNAUTHORIZED"
"FORBIDDEN"
"ALREADY_STARTED"
"SERVER_ERROR"
=======================================================================================================================================
Why this exists:

The organiser used to be asked at creation how long to wait before their first round - a guess,
made before they had invited anyone, that could not be corrected afterwards and that implied we
knew when the next fixtures were. We don't. This replaces the guess with an act: nothing is pushed
until they say they are ready, however long that takes.

`ready: false` is accepted right up until the first round arrives, but **nothing in the UI sends
it**: an organiser who isn't ready simply doesn't press the button, and offering to undo an act
they haven't taken only makes the act look riskier than it is. It stays here for support - undoing
an accidental press - and for anyone reaching the route directly.

Once a round exists the gate has done its job and the answer is ALREADY_STARTED either way, since
the ready check only ever applies to a first round (services/fixtureService.js).

**Pressing ready publishes the round immediately.** Ready was the last thing standing between the
organiser and their first round: the batch was staged, it passed every rule, and the only remaining
step was an operator opening the admin screen and pressing push. That left the organiser looking at
a card saying "you're all set" beside a Play button that did nothing. Publishing here closes that
gap - picks open the moment they say go.

**Ready therefore means "start me on the round I can see", not a standing order.** The UI only
offers the button when `get-competition-start-outlook` says `can_start`, so this route should never
be reached without a qualifying batch. It stays tolerant of that anyway rather than rejecting it:
the flag is harmless on its own, and `round_started: false` tells the caller nothing was published.
An organiser who cannot start yet is told when to come back instead - see startBlockedText in
lmslocal-web/src/lib/roundState.ts.

The push runs in **its own transaction, after the ready flag has committed**, and its failures are
swallowed deliberately. Ready is the organiser's decision and must stick even if publishing fails;
a failed push leaves the competition ready and waiting for the admin screen, which is a working
state, not a broken one. Rolling the flag back would tell an organiser their press failed when it
did not.
=======================================================================================================================================
*/

const express = require('express');
const { transaction } = require('../database');
const { verifyToken } = require('../middleware/auth');
const { logApiCall } = require('../utils/apiLogger');
const { pushFixturesToCompetition } = require('../services/fixtureService');
const router = express.Router();

router.post('/', verifyToken, async (req, res) => {
  logApiCall('set-competition-ready');

  try {
    const { competition_id, ready } = req.body;
    const user_id = req.user.id;

    if (!competition_id || !Number.isInteger(competition_id)) {
      return res.json({
        return_code: "VALIDATION_ERROR",
        message: "Competition ID is required and must be a valid integer"
      });
    }

    if (typeof ready !== 'boolean') {
      return res.json({
        return_code: "VALIDATION_ERROR",
        message: "Ready must be true or false"
      });
    }

    const result = await transaction(async (client) => {
      const competitionResult = await client.query(
        `SELECT id, organiser_id, fixture_service, ready_at
         FROM competition
         WHERE id = $1
         FOR UPDATE`,
        [competition_id]
      );

      if (competitionResult.rows.length === 0) {
        throw new Error('COMPETITION_NOT_FOUND: Competition not found');
      }

      const competition = competitionResult.rows[0];

      if (competition.organiser_id !== user_id) {
        throw new Error('UNAUTHORIZED: Only the competition organiser can do this');
      }

      // Nothing to be ready for otherwise - an organiser entering their own fixtures starts the
      // competition by entering them.
      if (competition.fixture_service !== true) {
        throw new Error('FORBIDDEN: This competition is not on the fixture service');
      }

      const roundCountResult = await client.query(
        'SELECT COUNT(*) AS rounds FROM round WHERE competition_id = $1',
        [competition_id]
      );

      if (parseInt(roundCountResult.rows[0].rounds) > 0) {
        throw new Error('ALREADY_STARTED: This competition has already started');
      }

      const updated = await client.query(
        `UPDATE competition
         SET ready_at = CASE WHEN $2 THEN COALESCE(ready_at, CURRENT_TIMESTAMP) ELSE NULL END
         WHERE id = $1
         RETURNING ready_at`,
        [competition_id, ready]
      );

      await client.query(
        `INSERT INTO audit_log (competition_id, user_id, action, details)
         VALUES ($1, $2, 'Competition Ready Changed', $3)`,
        [
          competition_id,
          user_id,
          ready ? 'Organiser declared the competition ready to start' : 'Organiser put the start back on hold'
        ]
      );

      return updated.rows[0];
    });

    // Separate transaction, after the flag is committed - see the header. pushFixturesToCompetition
    // re-checks eligibility itself, which is what makes NOT_ELIGIBLE here mean "the screen offered
    // a button it should not have" rather than an ordinary outcome.
    let pushed = null;
    if (result.ready_at) {
      try {
        pushed = await transaction(async (client) => pushFixturesToCompetition(client, competition_id));
      } catch (pushError) {
        if (pushError.message !== 'NOT_ELIGIBLE') {
          console.error('set-competition-ready push failed:', competition_id, pushError.message);
        }
      }
    }

    res.json({
      return_code: "SUCCESS",
      ready_at: result.ready_at,
      round_started: pushed !== null,
      round_number: pushed ? pushed.round_number : null,
      message: result.ready_at
        ? (pushed ? "Your first round is live" : "Competition is ready to start")
        : "Competition is on hold"
    });

  } catch (error) {
    const [code, ...messageParts] = error.message.split(': ');
    const known = ['COMPETITION_NOT_FOUND', 'UNAUTHORIZED', 'FORBIDDEN', 'ALREADY_STARTED'];

    if (known.includes(code)) {
      return res.json({
        return_code: code,
        message: messageParts.join(': ')
      });
    }

    console.error('set-competition-ready error:', error.message);
    res.json({
      return_code: "SERVER_ERROR",
      message: "Failed to update the competition"
    });
  }
});

module.exports = router;
