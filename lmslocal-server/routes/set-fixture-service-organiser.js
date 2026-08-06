/*
=======================================================================================================================================
API Route: set-fixture-service-organiser
=======================================================================================================================================
Method: POST
Purpose: Lets an organiser switch their own competition into or out of the automated fixture
         service, from competition settings.

         NO LONGER CALLED. Competition settings now saves fixture_service as an ordinary field
         through /update-competition, with the round-state refusals and the stalled-round
         clearing dropped: the flag only says who supplies fixtures from the next push onwards,
         and organisers found a switch that silently bounced back - and then offered to delete a
         round - far more alarming than useful. Nothing in lmslocal-web or lmslocal-flutter
         reaches this route any more. It is still registered and still correct; delete it if it
         is still unused next time this area is touched.

         This is the organiser-facing twin of admin/set-fixture-service.js. Both flip
         competition.fixture_service, and both apply the identical round-boundary safety checks
         from services/fixtureServiceSwitch.js. Per CLAUDE.md this is a separate route rather
         than an admin bypass bolted onto an existing one.

         It is deliberately narrower than the admin route in two ways:
           1. The caller must be the competition's organiser.
           2. Opting in requires team_list.fixture_service_available. The push matches staged
              fixtures to competitions on team_list_id, so subscribing a competition on a list we
              do not stage would leave it waiting for rounds that never arrive. Admin can
              override that; an organiser cannot.
=======================================================================================================================================
Request Payload:
{
  "competition_id": 42,                      // integer, required
  "fixture_service": true,                   // boolean, required - true to opt in, false to opt out
  "clear_stalled_round": true                // boolean, optional - confirm discarding an unstarted
                                             //   round that is blocking the switch (see below)
}

Success Response (ALWAYS HTTP 200):
{
  "return_code": "SUCCESS",
  "competition_id": 42,                      // integer
  "fixture_service": true,                   // boolean, the value now stored
  "cleared_round": {                         // object|null, present only if a stalled round was discarded
    "round_number": 1,                       // integer
    "fixture_count": 10                      // integer
  },
  "message": "We'll add the fixtures and results from the next round"
}

Confirmation Response (ALWAYS HTTP 200) - the switch is possible but needs the round discarded:
{
  "return_code": "STALLED_ROUND_NEEDS_CLEARING",
  "round_number": 1,                         // integer
  "fixture_count": 10,                       // integer, fixtures that would be removed
  "message": "Round 1 has 10 fixtures and nobody has picked yet..."
}

Error Response (ALWAYS HTTP 200):
{
  "return_code": "ERROR_TYPE",
  "message": "Descriptive error message"
}
=======================================================================================================================================
Return Codes:
"SUCCESS"
"VALIDATION_ERROR"            - competition_id missing, or fixture_service not a boolean
"COMPETITION_NOT_FOUND"       - No competition with that id
"UNAUTHORIZED"                - Caller is not the organiser of this competition
"FIXTURE_SERVICE_UNAVAILABLE" - We do not stage fixtures for this competition's team list
"COMPETITION_COMPLETE"        - Competition has finished; opting it in would do nothing
"STALLED_ROUND_NEEDS_CLEARING"- Blocked only by an unstarted round; resend with clear_stalled_round
"ROUND_IN_PROGRESS"           - Latest round has unresulted fixtures; switching now would strand it
"ROUND_NOT_PROCESSED"         - Latest round is resulted but its eliminations have not been applied
"ROUND_NO_LONGER_CLEARABLE"   - A pick arrived between confirming and committing; nothing changed
"SERVER_ERROR"                - Database error or unexpected server failure
=======================================================================================================================================
Data Notes:
- Opting in does not backfill. The next push gives the competition the earliest gameweek whose
  kickoff clears its earliest_start_date; rounds it missed while opted out stay missed.
- Opting out is not retroactive either - rounds already pushed stay.
- Player history survives the switch. The push backfills allowed_teams only for players who have
  no rows at all, so a manually-run competition keeps its no-team-twice state.
- Pricing: during the launch promotion the service is free, so an opt-in records 0.00 in
  competition.fixture_service_price_paid. Opting out deliberately leaves price_paid and
  granted_at as they are - the record that this competition once held the service on promo terms
  is what identifies it as grandfathered later, and clearing it would lose that.

Clearing a stalled round:

- The common drop-off is an organiser who adds round 1's fixtures and never returns. That round
  blocks the switch (ROUND_IN_PROGRESS) and nothing will ever unblock it, so opting in is
  useless to exactly the people it would help most. When the round is provably untouched -
  see checkClearableStalledRound for the four conditions and why each is needed - this route
  offers to discard it, and the service then builds round 1 itself.

- It is a two-step confirmation, never implicit. The first call returns
  STALLED_ROUND_NEEDS_CLEARING with the fixture count so the organiser can be told exactly what
  they are losing; only a second call carrying clear_stalled_round deletes anything.

- Picks are never deleted. If any exist the round is not clearable at all and the usual refusal
  stands. That keeps this path free of the allowed_teams and lives restoration it would
  otherwise have to get right.

- There are no foreign keys on round (checked - none reference it), so nothing in the database
  would stop a delete from orphaning rows. Everything carrying a round_id is therefore handled
  explicitly: fixture and the two send queues are deleted with the round, while pick and
  player_progress are re-counted inside the transaction and a non-zero count aborts the whole
  thing rather than orphaning them.
=======================================================================================================================================
*/

const express = require('express');
const { query, transaction } = require('../database');
const { logApiCall } = require('../utils/apiLogger');
const { verifyToken } = require('../middleware/auth');
const { checkSafeToEnable, checkClearableStalledRound } = require('../services/fixtureServiceSwitch');
const router = express.Router();

// Launch promotion. The service lists at £10 but is being given away while we build up
// organisers, so this is what an opt-in records. Raise it when charging starts - competitions
// already holding 0.00 are the grandfathered ones.
const PROMO_PRICE = 0.00;

router.post('/', verifyToken, async (req, res) => {
  logApiCall('set-fixture-service-organiser');

  try {
    const { competition_id, fixture_service, clear_stalled_round } = req.body;
    const user_id = req.user.id;

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

    const existing = await query(`
      SELECT c.id, c.name, c.status, c.organiser_id, c.team_list_id,
             tl.fixture_service_available
      FROM competition c
      LEFT JOIN team_list tl ON tl.id = c.team_list_id
      WHERE c.id = $1
    `, [competition_id]);

    if (existing.rows.length === 0) {
      return res.json({
        return_code: 'COMPETITION_NOT_FOUND',
        message: 'Competition not found'
      });
    }

    const competition = existing.rows[0];

    if (competition.organiser_id !== user_id) {
      return res.json({
        return_code: 'UNAUTHORIZED',
        message: 'Only the organiser can change this setting'
      });
    }

    // Set only when an unstarted round has to be discarded for the switch to be possible, and
    // only after the organiser has confirmed it.
    let stalledRoundToClear = null;

    // Only switching ON can strand a round or point at a list we do not stage. Switching off
    // hands control back to the organiser, which is always safe.
    if (fixture_service === true) {
      if (competition.fixture_service_available !== true) {
        return res.json({
          return_code: 'FIXTURE_SERVICE_UNAVAILABLE',
          message: 'The fixture service does not cover this competition\'s team list yet'
        });
      }

      const blocked = await checkSafeToEnable(competition);
      if (blocked) {
        // A competition blocked purely by an unstarted round can be rescued by discarding it.
        // Ask first - the organiser is losing fixtures they entered, so they get told how many.
        const clearable = await checkClearableStalledRound(competition);

        if (!clearable) {
          return res.json(blocked);
        }

        if (clear_stalled_round !== true) {
          return res.json({
            return_code: 'STALLED_ROUND_NEEDS_CLEARING',
            round_number: clearable.round_number,
            fixture_count: clearable.fixture_count,
            message:
              `Round ${clearable.round_number} has ${clearable.fixture_count} fixtures and ` +
              `nobody has picked yet. To take this over we need to remove that round and start ` +
              `you from round 1.`
          });
        }

        stalledRoundToClear = clearable;
      }
    }

    // Flag, pricing, any round clearance and the audit row together, so the trail cannot end up
    // disagreeing with the flag and a failure part-way leaves nothing half-done.
    const outcome = await transaction(async (client) => {
      const exec = (sql, params) => client.query(sql, params);

      if (stalledRoundToClear) {
        // Re-check inside the transaction. The earlier check was made outside it, and there are
        // no foreign keys to catch a pick that landed in between.
        const stillClearable = await checkClearableStalledRound(competition, exec);
        if (!stillClearable || stillClearable.round_id !== stalledRoundToClear.round_id) {
          throw new Error('ROUND_NO_LONGER_CLEARABLE');
        }

        const roundId = stalledRoundToClear.round_id;

        // Belt and braces on the same race: these must delete nothing. If either removes a row,
        // a pick or a progress record arrived after the re-check and we abort rather than
        // orphan it - there is no FK to do this for us.
        const strayPicks = await client.query('DELETE FROM pick WHERE round_id = $1', [roundId]);
        const strayProgress = await client.query('DELETE FROM player_progress WHERE round_id = $1', [roundId]);
        if (strayPicks.rowCount > 0 || strayProgress.rowCount > 0) {
          throw new Error('ROUND_NO_LONGER_CLEARABLE');
        }

        // Queued sends for a round that is about to stop existing would be wrong to deliver.
        // Only pending rows go - sent history stays as a record of what players received.
        await client.query(
          `DELETE FROM mobile_notification_queue WHERE round_id = $1 AND status = 'pending'`,
          [roundId]
        );
        await client.query(
          `DELETE FROM email_queue WHERE round_id = $1 AND status = 'pending'`,
          [roundId]
        );

        await client.query('DELETE FROM fixture WHERE round_id = $1', [roundId]);
        await client.query('DELETE FROM round WHERE id = $1', [roundId]);
      }

      if (fixture_service === true) {
        await client.query(`
          UPDATE competition
          SET fixture_service = true,
              fixture_service_price_paid = $1,
              fixture_service_granted_at = CURRENT_TIMESTAMP
          WHERE id = $2
        `, [PROMO_PRICE, competition_id]);
      } else {
        // Leave price_paid and granted_at untouched - see Data Notes above.
        await client.query(
          'UPDATE competition SET fixture_service = false WHERE id = $1',
          [competition_id]
        );
      }

      // A round of fixtures disappearing is otherwise unexplained, so it is named here.
      const clearedNote = stalledRoundToClear
        ? `, discarding unstarted round ${stalledRoundToClear.round_number} ` +
          `(${stalledRoundToClear.fixture_count} fixtures)`
        : '';

      await client.query(`
        INSERT INTO audit_log (competition_id, user_id, action, details)
        VALUES ($1, $2, 'Fixture Service Changed', $3)
      `, [
        competition_id,
        user_id,
        `Fixture service ${fixture_service ? 'enabled' : 'disabled'} by organiser${clearedNote}`
      ]);

      return { cleared: stalledRoundToClear };
    });

    return res.json({
      return_code: 'SUCCESS',
      competition_id,
      fixture_service,
      cleared_round: outcome.cleared
        ? {
            round_number: outcome.cleared.round_number,
            fixture_count: outcome.cleared.fixture_count
          }
        : null,
      message: fixture_service
        ? (outcome.cleared
            ? 'That round has been removed. We\'ll set up round 1 and take it from there'
            : 'We\'ll add the fixtures and results from the next round')
        : 'You\'re now entering fixtures and results yourself'
    });

  } catch (error) {
    // The race guard fired: a pick or progress record arrived while we were committing, so
    // nothing was changed. Tell the organiser rather than reporting a generic failure.
    if (error.message === 'ROUND_NO_LONGER_CLEARABLE') {
      return res.json({
        return_code: 'ROUND_NO_LONGER_CLEARABLE',
        message: 'A player has just made a pick, so that round can no longer be removed. Nothing has been changed.'
      });
    }

    console.error('set-fixture-service-organiser error:', error.message);
    return res.json({
      return_code: 'SERVER_ERROR',
      message: 'Could not change the fixture service setting'
    });
  }
});

module.exports = router;
