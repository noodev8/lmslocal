/*
=======================================================================================================================================
API Route: buy-player-back-in
=======================================================================================================================================
Method: POST
Purpose: Bring an eliminated player back into a competition, consuming one place. Priced exactly
         as a join: free inside the organiser's free allowance, one credit beyond it.
=======================================================================================================================================
Request Payload:
{
  "competition_id": 123,               // integer, required - ID of the competition
  "player_id": 456,                    // integer, required - ID of the player (user_id)
  "reason": "Bought back in"           // string, optional - reason for the change (audit log)
}

Success Response (ALWAYS HTTP 200):
{
  "return_code": "SUCCESS",
  "message": "Player bought back in",
  "player_name": "John Smith",         // string, player display name
  "lives_remaining": 0,                // integer, lives the player returns on - always 0, see below
  "re_buys": 2,                        // integer, times this player has now bought back in
  "credit_charged": true,              // boolean, whether a credit was taken
  "new_balance": 46,                   // integer, organiser's paid_credit after the charge
  "places_used": 24                    // integer, organiser's chargeable places after the re-buy
}

Error Response (ALWAYS HTTP 200):
{
  "return_code": "ERROR_TYPE",
  "message": "Descriptive error message"
}
=======================================================================================================================================
Return Codes:
"SUCCESS"
"MISSING_FIELDS"
"COMPETITION_NOT_FOUND"
"PLAYER_NOT_FOUND"
"PLAYER_NOT_ELIMINATED"   - player is already active, so there is nothing to buy back into
"UNAUTHORIZED"            - not the organiser and not delegated player management
"INSUFFICIENT_CREDITS"    - the place is chargeable and the organiser cannot cover it
"SERVER_ERROR"
=======================================================================================================================================
Business Logic:

A re-buy consumes a PLACE, not a special kind of credit. Full reasoning in docs/re-buys.md - §3
for why it is priced as a place, §2 for the gap it closes. In short: the free allowance is not a
balance, it is a live count of chargeable memberships, so there is nothing to decrement. Bringing
a player back creates no membership row, which is why it used to be free however many times it
was done - and a whole field revived that way is a reset nobody paid for.

competition_user.re_buys is what gives the live count something to see. services/botPool.js adds
it, so every existing query prices this correctly without knowing it exists.

The charge lands on the COMPETITION'S ORGANISER, never on the caller. A delegated admin with
manage_players can bring someone back, and it is the organiser's balance that pays - they own
the competition and the places it holds.

Bots are free here as everywhere (docs/reset-billing.md §4).

Deliberately NOT gated on competition.status. COMPLETE is sticky and trivially avoided by never
finishing a competition, so gating on it buys nothing and blocks an organiser fixing the last
round - docs/re-buys.md §2.
=======================================================================================================================================
*/

const express = require('express');
const { transaction } = require('../database');
const { logApiCall } = require('../utils/apiLogger');
const { verifyToken } = require('../middleware/auth');
const { canManagePlayers } = require('../utils/permissions');
const { countOrganiserChargeableMembers, isBotEmail } = require('../services/botPool');
const router = express.Router();

router.post('/', verifyToken, async (req, res) => {
  try {
    logApiCall('buy-player-back-in');

    const { competition_id, player_id, reason } = req.body;
    const admin_id = req.user.id;
    const admin_email = req.user.email;

    // STEP 1: Validate input with strict type checking
    if (!competition_id || !Number.isInteger(competition_id)) {
      return res.json({
        return_code: "MISSING_FIELDS",
        message: "Competition ID is required and must be an integer"
      });
    }

    if (!player_id || !Number.isInteger(player_id)) {
      return res.json({
        return_code: "MISSING_FIELDS",
        message: "Player ID is required and must be an integer"
      });
    }

    // STEP 2: One transaction for the price check, the debit and the restore.
    // All or nothing, per docs/reset-billing.md §3 - there is no partial re-buy. If the credit
    // cannot be taken, the player stays out and no credit moves.
    const transactionResult = await transaction(async (client) => {

      // Competition and player in one round trip - the same shape as update-player-status,
      // so a missing competition and a missing player stay distinguishable.
      const validationQuery = `
        WITH competition_data AS (
          SELECT
            c.id            AS competition_id,
            c.name          AS competition_name,
            c.organiser_id
          FROM competition c
          WHERE c.id = $1
        ),
        player_data AS (
          SELECT
            cu.user_id,
            u.display_name  AS player_name,
            u.email         AS player_email,
            cu.status       AS current_status,
            cu.re_buys      AS current_re_buys
          FROM competition_user cu
          INNER JOIN app_user u ON u.id = cu.user_id
          WHERE cu.competition_id = $1 AND cu.user_id = $2
        )
        SELECT
          cd.competition_id,
          cd.competition_name,
          cd.organiser_id,
          pd.user_id AS player_user_id,
          pd.player_name,
          pd.player_email,
          pd.current_status,
          pd.current_re_buys
        FROM competition_data cd
        LEFT JOIN player_data pd ON true
      `;

      const validationResult = await client.query(validationQuery, [competition_id, player_id]);

      if (validationResult.rows.length === 0) {
        throw {
          return_code: "COMPETITION_NOT_FOUND",
          message: "Competition not found or does not exist"
        };
      }

      const data = validationResult.rows[0];

      const permission = await canManagePlayers(admin_id, competition_id);
      if (!permission.authorized) {
        throw {
          return_code: "UNAUTHORIZED",
          message: "You do not have permission to manage players in this competition"
        };
      }

      if (!data.player_user_id) {
        throw {
          return_code: "PLAYER_NOT_FOUND",
          message: "Player not found in this competition"
        };
      }

      /*
      Only an eliminated player can be bought back in. Without this an organiser could spend a
      place on somebody who is already playing - a charge with nothing to show for it, and the
      kind of thing that arrives as a support ticket rather than a bug report.

      Compared case-insensitively: status holds lower case today, but competition.status has
      already taught us that casing in this database is not consistent across its history
      (db/README.md), and a comparison that silently fails here would charge for a no-op.
      */
      if (String(data.current_status || '').toLowerCase() !== 'out') {
        throw {
          return_code: "PLAYER_NOT_ELIMINATED",
          message: `${data.player_name} is still in the competition`
        };
      }

      /*
      STEP 3: Price it.

      Counted BEFORE the re-buy and compared with < , exactly as deduct-credit.js does for a
      join: the place being taken is free when the places already used are inside the allowance.
      Counting after would charge one place too early at the boundary.

      The count is the organiser's across ALL their competitions - the allowance is per account,
      not per competition.
      */
      const FREE_PLAYER_LIMIT = parseInt(process.env.FREE_PLAYER_LIMIT) || 20;
      const organiserId = data.organiser_id;

      const placesUsedBefore = await countOrganiserChargeableMembers(client, organiserId);

      // A bot costs nothing and consumes no place anywhere in the system - reset-billing.md §4.
      // Its re_buys still increments; the counting queries simply never look at it.
      const playerIsBot = isBotEmail(data.player_email);
      const chargeable = !playerIsBot && placesUsedBefore >= FREE_PLAYER_LIMIT;

      let creditCharged = false;
      let newBalance = null;

      if (chargeable) {
        /*
        The WHERE is the affordability check. Doing it as part of the UPDATE rather than as a
        SELECT first means the balance cannot move between reading it and spending it.
        */
        const deductResult = await client.query(`
          UPDATE app_user
          SET paid_credit = paid_credit - 1
          WHERE id = $1 AND paid_credit >= 1
          RETURNING paid_credit AS new_balance
        `, [organiserId]);

        if (deductResult.rows.length === 0) {
          const balanceResult = await client.query(
            'SELECT paid_credit FROM app_user WHERE id = $1',
            [organiserId]
          );

          throw {
            return_code: "INSUFFICIENT_CREDITS",
            message: "This competition has no places left. Buy more credits to bring players back.",
            places_used: placesUsedBefore,
            credits_available: parseInt(balanceResult.rows[0]?.paid_credit, 10) || 0
          };
        }

        creditCharged = true;
        newBalance = deductResult.rows[0].new_balance;

        await client.query(`
          INSERT INTO credit_transactions (
            user_id, transaction_type, amount, competition_id, description, created_at
          )
          VALUES ($1, 'deduction', -1, $2, $3, CURRENT_TIMESTAMP)
        `, [
          organiserId,
          competition_id,
          `Credit deducted for player ${player_id} buying back into competition ${competition_id}. Places used: ${placesUsedBefore + 1}`
        ]);
      } else {
        const balanceResult = await client.query(
          'SELECT paid_credit FROM app_user WHERE id = $1',
          [organiserId]
        );
        newBalance = parseInt(balanceResult.rows[0]?.paid_credit, 10) || 0;
      }

      /*
      STEP 4: Put them back - on ZERO lives, not one, and not lives_per_player.

      Zero lives is NOT eliminated. The results processors only set status='out' when lives would
      go below zero (push-results-to-competition.js:304), so zero means "in, one loss from out" -
      exactly the position of every player who has already spent their lives. A re-bought player
      has spent theirs.

      Anything above zero hands them a cushion the survivors do not have. In a competition with
      lives_per_player = 0, where one loss has always ended it, a single life makes the player who
      was knocked out and paid to return strictly better off than the two who never lost at all.
      That is the wrong way round, and it is what the organiser gets asked about.

      The re-buy buys the resurrection. It does not buy lives. docs/re-buys.md §5.
      */
      const updateResult = await client.query(`
        UPDATE competition_user
        SET status = 'active',
            lives_remaining = 0,
            re_buys = re_buys + 1
        WHERE competition_id = $1 AND user_id = $2
        RETURNING lives_remaining, re_buys
      `, [competition_id, player_id]);

      const updated = updateResult.rows[0];

      const auditDetails = {
        action: 'PLAYER_RE_BUY',
        player: data.player_name,
        competition: data.competition_name,
        previous_status: data.current_status,
        new_status: 'active',
        lives_remaining: updated.lives_remaining,
        re_buys: updated.re_buys,
        credit_charged: creditCharged,
        places_used_before: placesUsedBefore,
        free_player_limit: FREE_PLAYER_LIMIT,
        // The balance is the organiser's, who may not be the admin acting - worth recording both
        // so a billing question can be answered from the log alone.
        organiser_id: organiserId,
        reason: reason || 'No reason provided',
        admin_id: admin_id,
        admin_email: admin_email
      };

      await client.query(`
        INSERT INTO audit_log (competition_id, user_id, action, details, created_at)
        VALUES ($1, $2, $3, $4, NOW())
      `, [
        competition_id,
        admin_id,
        `${data.player_name} bought back in${creditCharged ? ' (1 credit)' : ''}`,
        JSON.stringify(auditDetails)
      ]);

      return {
        return_code: "SUCCESS",
        message: "Player bought back in",
        player_name: data.player_name,
        lives_remaining: updated.lives_remaining,
        re_buys: updated.re_buys,
        credit_charged: creditCharged,
        new_balance: newBalance,
        places_used: placesUsedBefore + (playerIsBot ? 0 : 1)
      };
    });

    return res.json(transactionResult);

  } catch (error) {
    // Business logic errors thrown from inside the transaction
    if (error.return_code) {
      return res.json({
        return_code: error.return_code,
        message: error.message,
        places_used: error.places_used,
        credits_available: error.credits_available
      });
    }

    console.error('Buy player back in error:', {
      error: error.message,
      stack: error.stack?.substring(0, 500),
      competition_id: req.body?.competition_id,
      player_id: req.body?.player_id,
      admin_id: req.user?.id,
      timestamp: new Date().toISOString()
    });

    return res.json({
      return_code: "SERVER_ERROR",
      message: "Failed to buy player back in"
    });
  }
});

module.exports = router;
