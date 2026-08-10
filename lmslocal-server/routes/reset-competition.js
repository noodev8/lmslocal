/*
=======================================================================================================================================
API Route: reset-competition
=======================================================================================================================================
Method: POST
Purpose: Completely resets a competition to its initial state, clearing all game data. The invite
         code is deliberately preserved - see the note below.
=======================================================================================================================================
Request Payload:
{
  "competition_id": 123                    // integer, required - ID of competition to reset
}

Request Payload (optional, see "What a reset costs" below):
{
  "quoted_cost": 180                       // integer, optional - the price the organiser was shown
}

Success Response (ALWAYS HTTP 200):
{
  "return_code": "SUCCESS",
  "message": "Competition reset successfully",     // string, success confirmation message
  "credits_used": 180,                             // integer, places this reset spent (0 = free)
  "credits_remaining": 45,                         // integer, organiser's balance afterwards
  "competition": {                                 // object, updated competition details
    "id": 123,                                    // integer, competition ID
    "name": "My Competition",                     // string, competition name
    "status": "LOCKED",                           // string, reset to LOCKED status
    "invite_code": "7392",                        // string, UNCHANGED - the competition keeps it
    "reset_at": "2025-09-06T10:30:00.000Z",     // string, ISO datetime when reset occurred
    "players_affected": 15                        // integer, number of players who had their data reset
  }
}

Error Response (ALWAYS HTTP 200):
{
  "return_code": "INSUFFICIENT_CREDITS",
  "message": "Descriptive error message",          // string, user-friendly error description
  "required": 180,                                 // integer, places needed (this code only)
  "balance": 20                                    // integer, places held (this code only)
}
=======================================================================================================================================
Return Codes:
"SUCCESS"
"VALIDATION_ERROR"
"COMPETITION_NOT_FOUND"
"UNAUTHORIZED"
"INSUFFICIENT_CREDITS"
"QUOTE_STALE"
"SERVER_ERROR"
=======================================================================================================================================
What a reset costs:

A reset re-charges for the players still in the competition - it is the same event as all of them
joining again, and the previous run's places were spent on the previous run. services/resetCost.js
holds the arithmetic and docs/reset-billing.md holds the reasoning.

All or nothing. The charge happens inside the transaction that does the wipe, so if the debit
cannot be taken in full then nothing is deleted, nothing is reset, and no credit moves.

quoted_cost is what the organiser was shown by get-reset-quote. If the real cost has risen above
it - a player joined in the two seconds in between - the reset refuses with QUOTE_STALE rather
than taking a larger debit than the number on the screen. A cost that has FALLEN is charged as
calculated and allowed through: the organiser is never billed more than they agreed to, and
refusing a cheaper reset would be obstructive. Omitting quoted_cost skips the check.
=======================================================================================================================================
Starting again:

A reset empties the competition back to nothing, so it goes back to waiting on the organiser:
ready_at is cleared and they press Ready again when they want the next set of matches. Without
that, an emptied competition would be open to the very next staged batch with nobody told.

fixture_service itself is deliberately untouched - who supplies the fixtures does not change
because the competition was emptied.
=======================================================================================================================================
*/

const express = require('express');
const { transaction } = require('../database');
const { verifyToken } = require('../middleware/auth');
const { logApiCall } = require('../utils/apiLogger');
const { calculateResetCost } = require('../services/resetCost');
const router = express.Router();

router.post('/', verifyToken, async (req, res) => {
  // Log API call if enabled
  logApiCall('reset-competition');
  
  try {
    // Extract request parameters and authenticated user ID
    const { competition_id, quoted_cost } = req.body;
    const user_id = req.user.id;

    // === INPUT VALIDATION ===
    // Validate required competition_id parameter
    if (!competition_id || !Number.isInteger(competition_id)) {
      return res.json({
        return_code: "VALIDATION_ERROR",
        message: "Competition ID is required and must be a valid integer"
      });
    }


    // === ATOMIC RESET TRANSACTION ===
    // Execute the entire reset operation within a single atomic transaction
    // This ensures data integrity - either everything resets successfully or nothing changes
    const result = await transaction(async (client) => {

      // 1. Get current competition details and verify organiser access with row lock
      const competitionResult = await client.query(`
        SELECT id, name, organiser_id, team_list_id, status, created_at, lives_per_player, fixture_service, invite_code
        FROM competition
        WHERE id = $1
        FOR UPDATE
      `, [competition_id]);

      if (competitionResult.rows.length === 0) {
        throw new Error('COMPETITION_NOT_FOUND: Competition not found');
      }

      const competition = competitionResult.rows[0];

      // 2. Verify user is the organiser of this competition
      if (competition.organiser_id !== user_id) {
        throw new Error('UNAUTHORIZED: Only the competition organiser can reset this competition');
      }

      // 2.5. Take payment for the new run BEFORE anything is deleted.
      //
      // Ordering is the whole safety property here: every DELETE below is in this transaction, so
      // a throw at this point leaves the competition exactly as it was. There is no partial reset
      // and no partial charge.
      const { cost, balance } = await calculateResetCost(client, competition_id, user_id);

      let creditsRemaining = balance;

      if (cost > 0) {
        /*
        The quote the organiser agreed to is a ceiling, not a contract. If somebody joined between
        the modal opening and the button being pressed, the real cost is higher than the number on
        their screen - and taking that larger debit silently is the one thing this must not do.
        A cost that has fallen is simply charged, which is why this is a one-sided check.
        */
        if (Number.isInteger(quoted_cost) && cost > quoted_cost) {
          throw {
            return_code: 'QUOTE_STALE',
            message: 'The number of players changed while you were confirming. Check the new figure and try again.',
            required: cost,
            balance
          };
        }

        /*
        Conditional UPDATE rather than a read-then-write: the balance is checked and taken in one
        statement, so two resets fired at once cannot both pass a check against the same balance
        and overdraw it. No row back means it could not be afforded.
        */
        const debitResult = await client.query(`
          UPDATE app_user
          SET paid_credit = paid_credit - $2
          WHERE id = $1 AND paid_credit >= $2
          RETURNING paid_credit AS new_balance
        `, [user_id, cost]);

        if (debitResult.rows.length === 0) {
          throw {
            return_code: 'INSUFFICIENT_CREDITS',
            message: `Starting again will use ${cost} ${cost === 1 ? 'place' : 'places'}. You have ${balance}.`,
            required: cost,
            balance
          };
        }

        creditsRemaining = parseInt(debitResult.rows[0].new_balance, 10);

        // 'deduction' rather than a reset-specific type, so the existing billing history keeps
        // working without being taught a new word. The description is what tells them why.
        await client.query(`
          INSERT INTO credit_transactions (user_id, transaction_type, amount, competition_id, description, created_at)
          VALUES ($1, 'deduction', $2, $3, $4, CURRENT_TIMESTAMP)
        `, [
          user_id,
          -cost,
          competition_id,
          `${cost} ${cost === 1 ? 'place' : 'places'} used starting "${competition.name}" again`
        ]);
      }

      // 3. The invite code is deliberately NOT regenerated.
      //
      // A reset clears a competition; it does not end it. The row survives, so under §3.1 of
      // docs/player-onboarding.md the code belongs to it for as long as it exists. Issuing a new
      // one silently killed every poster, beer mat and WhatsApp link already out there - which is
      // the exact problem a permanent code is meant to prevent, arriving through the back door on
      // the one action an organiser takes between seasons.
      //
      // This also removes a second copy of the code generator that predated the unique index on
      // UPPER(invite_code) and never gained the 23505 retry that create-competition has.

      // 4. Count players before deletion for reporting purposes
      const playersCountResult = await client.query(`
        SELECT COUNT(DISTINCT user_id) as player_count
        FROM competition_user 
        WHERE competition_id = $1
      `, [competition_id]);

      const playersAffected = parseInt(playersCountResult.rows[0].player_count) || 0;

      // 5. Delete all competition game data in proper order (respecting foreign key constraints)
      
      // Delete picks (references round_id and user_id)
      const deletedPicksResult = await client.query(`
        DELETE FROM pick 
        WHERE round_id IN (
          SELECT id FROM round WHERE competition_id = $1
        )
        RETURNING id
      `, [competition_id]);

      // Delete player progress records (references competition_id and round_id)
      const deletedProgressResult = await client.query(`
        DELETE FROM player_progress 
        WHERE competition_id = $1
        RETURNING id
      `, [competition_id]);

      // Delete fixtures (references round_id)
      const deletedFixturesResult = await client.query(`
        DELETE FROM fixture 
        WHERE round_id IN (
          SELECT id FROM round WHERE competition_id = $1
        )
        RETURNING id
      `, [competition_id]);

      // Delete rounds (references competition_id)
      const deletedRoundsResult = await client.query(`
        DELETE FROM round 
        WHERE competition_id = $1
        RETURNING id
      `, [competition_id]);


      // 6. Back to SETUP. invite_code is absent from the SET list on purpose - see step 3.
      //    ready_at goes back to null so the fixture service waits to be told again - see the header.
      const updatedCompetitionResult = await client.query(`
        UPDATE competition
        SET status = 'SETUP',
            created_at = CURRENT_TIMESTAMP,
            ready_at = NULL
        WHERE id = $1
        RETURNING id, name, status, invite_code, created_at
      `, [competition_id]);

      const updatedCompetition = updatedCompetitionResult.rows[0];

      // 7. Reset all player states for the fresh competition (payment status, lives, join date)
      //
      // teams_reset_round goes back to 0 with them. It is a ROUND NUMBER - the boundary after
      // which a player's picks count against what they may pick again (services/allowedTeams.js)
      // - and the new run starts at round 1. Left at, say, 5 from the previous run, every pick in
      // rounds 1-5 of the new competition would sit below the boundary and count against nothing,
      // so a player could pick the same team five weeks running. Zero is the correct starting
      // state and it is what the column defaults to for a new member.
      const resetPlayerResult = await client.query(`
        UPDATE competition_user
        SET paid = false,
            paid_date = NULL,
            status = 'active',
            lives_remaining = $2,
            teams_reset_round = 0,
            joined_at = CURRENT_TIMESTAMP
        WHERE competition_id = $1
        RETURNING user_id
      `, [competition_id, competition.lives_per_player]);


      // 9. Create comprehensive audit log entry
      const resetDetails = [
        `Reset competition "${competition.name}"`,
        `Deleted ${deletedRoundsResult.rows.length} rounds`,
        `Deleted ${deletedFixturesResult.rows.length} fixtures`, 
        `Deleted ${deletedPicksResult.rows.length} picks`,
        `Deleted ${deletedProgressResult.rows.length} player progress records`,
        `Reset player states (payment status, lives, join date) for ${resetPlayerResult.rows.length} players`,
        `Kept invite code ${competition.invite_code}`,
        `Affected ${playersAffected} players`,
        cost > 0
          ? `Used ${cost} ${cost === 1 ? 'place' : 'places'}, leaving ${creditsRemaining}`
          : 'Used no places (within free allowance)',
        `Repopulated allowed teams for all players`,
        ...(competition.fixture_service === true ? ['Start put back on hold until the organiser presses Ready'] : [])
      ].join(', ');

      await client.query(`
        INSERT INTO audit_log (competition_id, user_id, action, details, created_at)
        VALUES ($1, $2, 'Competition Reset', $3, CURRENT_TIMESTAMP)
      `, [
        competition_id,
        user_id,
        resetDetails
      ]);

      // Return reset operation results for response
      return {
        competition: updatedCompetition,
        playersAffected: playersAffected,
        creditsUsed: cost,
        creditsRemaining: creditsRemaining,
        deletionCounts: {
          rounds: deletedRoundsResult.rows.length,
          fixtures: deletedFixturesResult.rows.length,
          picks: deletedPicksResult.rows.length,
          progress: deletedProgressResult.rows.length
        }
      };
    });

    // === SUCCESS RESPONSE ===
    // Transaction completed successfully - return reset confirmation
    res.json({
      return_code: "SUCCESS",
      message: "Competition reset successfully",
      credits_used: result.creditsUsed,                             // Places this reset spent
      credits_remaining: result.creditsRemaining,                   // Balance afterwards
      competition: {
        id: result.competition.id,                                    // Competition ID for reference
        name: result.competition.name,                               // Competition name
        status: result.competition.status,                           // Reset status (LOCKED)
        invite_code: result.competition.invite_code,                // Unchanged - the competition keeps it
        reset_at: result.competition.created_at,                    // When the reset occurred
        players_affected: result.playersAffected                   // Number of players affected
      }
    });

  } catch (error) {
    // === ERROR HANDLING ===
    // Log detailed error for debugging but return appropriate user-facing messages
    console.error('Reset competition error:', error);

    // The billing failures throw a structured object rather than an Error, because they carry
    // numbers the dialog has to show. Handled first - the string matching below would fall
    // through to SERVER_ERROR and lose both the code and the figures.
    if (error && error.return_code) {
      return res.json({
        return_code: error.return_code,
        message: error.message,
        ...(error.required !== undefined && { required: error.required }),
        ...(error.balance !== undefined && { balance: error.balance })
      });
    }

    // Handle specific business logic errors with appropriate return codes
    if (error.message.startsWith('VALIDATION_ERROR:')) {
      return res.json({
        return_code: "VALIDATION_ERROR",
        message: error.message.split(': ')[1]
      });
    }

    if (error.message.startsWith('COMPETITION_NOT_FOUND:')) {
      return res.json({
        return_code: "COMPETITION_NOT_FOUND",
        message: error.message.split(': ')[1]
      });
    }

    if (error.message.startsWith('UNAUTHORIZED:')) {
      return res.json({
        return_code: "UNAUTHORIZED",
        message: error.message.split(': ')[1]
      });
    }

    if (error.message.startsWith('SERVER_ERROR:')) {
      return res.json({
        return_code: "SERVER_ERROR",
        message: error.message.split(': ')[1]
      });
    }

    // Database or unexpected errors - return generic message for security
    res.json({
      return_code: "SERVER_ERROR",
      message: "Internal server error"
    });
  }
});

module.exports = router;