/*
=======================================================================================================================================
API Route: create-competition
=======================================================================================================================================
Method: POST
Purpose: Creates a new competition for authenticated user with a unique invite code
=======================================================================================================================================
Request Payload:
{
  "name": "Premier League LMS 2025",             // string, required - Competition name
  "description": "Our annual football competition", // string, optional - Competition description
  "logo_url": "https://res.cloudinary.com/...",  // string, optional - Logo image URL (max 500 chars)
  "venue_name": "The Red Barn",                 // string, optional - Venue/organization name (max 100 chars)
  "address_line_1": "123 High Street",          // string, optional - First line of address (max 100 chars)
  "address_line_2": "City Centre",              // string, optional - Second line of address (max 100 chars)
  "city": "Manchester",                         // string, optional - City/town name (max 50 chars)
  "postcode": "M1 2AB",                         // string, optional - UK postcode (max 20 chars)
  "phone": "01234 567890",                      // string, optional - Contact phone number (max 20 chars)
  "email": "contact@venue.com",                 // string, optional - Contact email address (max 255 chars)
  "entry_fee": 10.00,                          // decimal, optional - Suggested entry fee in GBP
  "prize_structure": "Winner takes all",        // string, optional - Prize distribution description (max 500 chars)
  "team_list_id": 1,                           // integer, required - ID of team list to use
  "lives_per_player": 0,                       // integer, optional - 0 (knockout) or 1 (default: 0)
  "no_team_twice": true,                       // boolean, optional - Prevent team reuse (default: true)
  "organiser_joins_as_player": true,           // boolean, optional - Add organiser as player (default: false)
  "fixture_service": true,                     // boolean, optional - Subscribe to the automated fixture service (default: false)
  "start_block_id": 7                          // integer, optional - which calendar block round 1
                                               //   comes from, chosen from /get-competition-start-options.
                                               //   Fixture-service competitions only; omitting it
                                               //   falls back to the older Ready-button flow.
}

Success Response (ALWAYS HTTP 200):
{
  "return_code": "SUCCESS",
  "message": "Competition created successfully",  // string, success message
  "competition": {
    "id": 123,                                  // integer, unique competition ID
    "name": "Premier League LMS 2025",         // string, competition name
    "description": "Our annual football competition", // string, competition description
    "status": "SETUP",                         // string, competition status
    "team_list_id": 1,                         // integer, associated team list ID
    "lives_per_player": 1,                     // integer, lives per player
    "no_team_twice": true,                     // boolean, team reuse prevention
    "fixture_service": true,                   // boolean, subscribed to the automated fixture service
    "invite_code": "45678",                    // string, 5-digit invite code. Competitions
                                               // created before this change keep their 4 digits.
    "created_at": "2025-01-01T12:00:00.000Z",  // string, ISO datetime when created
    "organiser_id": 456,                       // integer, organiser user ID
    "start_block_label": "Sat 29 Aug"          // string or null - non-null means round 1 already
                                               //   exists, with fixtures, locking on this date
  }
}

Error Response (ALWAYS HTTP 200):
{
  "return_code": "ERROR_TYPE",
  "message": "Descriptive error message"          // string, user-friendly error description
}
=======================================================================================================================================
Return Codes:
"SUCCESS"
"VALIDATION_ERROR"
"FIXTURE_SERVICE_UNAVAILABLE" - Fixture service requested for a team list we do not stage fixtures for
"START_BLOCK_UNAVAILABLE"    - The chosen start date was promoted, edited or deleted since the form loaded
"START_BLOCK_TOO_SOON"       - The chosen start date is now inside the lead time
"UNAUTHORIZED"
"SERVER_ERROR"
=======================================================================================================================================
*/

const express = require('express');
const { transaction } = require('../database');
const { verifyToken } = require('../middleware/auth');
const { createRoundFromBlock } = require('../services/fixtureBlock');
const router = express.Router();

router.post('/', verifyToken, async (req, res) => {
  try {
    const { name, description, logo_url, venue_name, address_line_1, address_line_2, city, postcode, phone, email, entry_fee, prize_structure, team_list_id, lives_per_player, no_team_twice, organiser_joins_as_player, fixture_service, start_block_id } = req.body;
    const organiser_id = req.user.id;

    // Which calendar block round 1 comes from. Optional: an older client will not send it, and
    // the calendar can legitimately have nothing to offer - both fall back to the Ready button.
    const startBlockId = Number.isInteger(start_block_id) ? start_block_id : null;

    // Basic validation
    if (!name || !name.trim()) {
      return res.json({
        return_code: "VALIDATION_ERROR",
        message: "Competition name is required"
      });
    }

    if (!team_list_id || !Number.isInteger(team_list_id)) {
      return res.json({
        return_code: "VALIDATION_ERROR",
        message: "Team list ID is required and must be a number"
      });
    }

    // The wizard's radio group sends this as a string ("0"/"1"), so coerce before validating.
    // Absent means Knockout - and note ?? rather than ||, because 0 is falsy: the old `|| 1`
    // would have turned every Knockout competition into a one-life one the moment the frontend
    // started sending a real number.
    const livesPerPlayer = lives_per_player === undefined || lives_per_player === null
      ? 0
      : Number(lives_per_player);

    if (!Number.isInteger(livesPerPlayer) || livesPerPlayer < 0 || livesPerPlayer > 1) {
      return res.json({
        return_code: "VALIDATION_ERROR",
        message: "Lives per player must be 0 or 1"
      });
    }

    // Validate venue_name length if provided
    if (venue_name && venue_name.length > 100) {
      return res.json({
        return_code: "VALIDATION_ERROR",
        message: "Venue name must be 100 characters or less"
      });
    }

    // Validate address fields if provided
    if (address_line_1 && address_line_1.length > 100) {
      return res.json({
        return_code: "VALIDATION_ERROR",
        message: "Address line 1 must be 100 characters or less"
      });
    }

    if (address_line_2 && address_line_2.length > 100) {
      return res.json({
        return_code: "VALIDATION_ERROR",
        message: "Address line 2 must be 100 characters or less"
      });
    }

    if (city && city.length > 50) {
      return res.json({
        return_code: "VALIDATION_ERROR",
        message: "City must be 50 characters or less"
      });
    }

    if (postcode && postcode.length > 20) {
      return res.json({
        return_code: "VALIDATION_ERROR",
        message: "Postcode must be 20 characters or less"
      });
    }

    if (phone && phone.length > 20) {
      return res.json({
        return_code: "VALIDATION_ERROR",
        message: "Phone number must be 20 characters or less"
      });
    }

    if (email && email.length > 255) {
      return res.json({
        return_code: "VALIDATION_ERROR",
        message: "Email address must be 255 characters or less"
      });
    }

    // Validate logo_url length if provided
    if (logo_url && logo_url.length > 500) {
      return res.json({
        return_code: "VALIDATION_ERROR",
        message: "Logo URL must be 500 characters or less"
      });
    }

    // Validate entry_fee if provided
    if (entry_fee !== undefined && entry_fee !== null) {
      const fee = Number(entry_fee);
      if (isNaN(fee) || fee < 0) {
        return res.json({
          return_code: "VALIDATION_ERROR",
          message: "Entry fee must be a positive number"
        });
      }
    }

    // Validate prize_structure length if provided
    if (prize_structure && prize_structure.length > 500) {
      return res.json({
        return_code: "VALIDATION_ERROR",
        message: "Prize structure must be 500 characters or less"
      });
    }


    // Execute all operations in a single atomic transaction
    const result = await transaction(async (client) => {

      // 1. Validate team_list exists and is accessible (with row lock)
      const teamListResult = await client.query(`
        SELECT id, name, fixture_service_available
        FROM team_list
        WHERE id = $1 AND is_active = true
        FOR UPDATE
      `, [team_list_id]);

      if (teamListResult.rows.length === 0) {
        throw new Error('VALIDATION_ERROR: Invalid team list selected');
      }

      // 1b. The fixture service pushes staged fixtures to competitions by matching team_list_id
      // (services/fixtureService.js). Subscribing a competition on a list we do not stage would
      // leave it waiting for rounds that never arrive, so refuse rather than accept silently.
      const wantsFixtureService = fixture_service === true;
      if (wantsFixtureService && teamListResult.rows[0].fixture_service_available !== true) {
        throw new Error('FIXTURE_SERVICE_UNAVAILABLE');
      }

      // 2. Claim an invite code and create the competition.
      //
      // The lookup below is a courtesy, not a guarantee: it does not lock, so two concurrent
      // creations can both find the same code free and both proceed. The unique index on
      // UPPER(invite_code) is what actually enforces uniqueness. This loop exists so that when
      // the index fires, the organiser never sees it - a 23505 here means "that code went, take
      // another", not "your competition could not be created".
      //
      // The INSERT is wrapped in a SAVEPOINT because a constraint violation aborts the enclosing
      // transaction: without one, every statement after the first collision would fail with
      // "current transaction is aborted" and the retry would be pointless.
      //
      // Codes the organiser keeps for their own recurring use - never auto-assigned to a customer.
      // Currently unreachable, since every entry is 4 digits and generation is 5 - kept because it
      // is the right place to put a reserved code, whatever its length.
      const RESERVED_INVITE_CODES = ['1992'];
      const maxAttempts = 100;
      let competitionResult = null;
      let attempts = 0;

      while (attempts < maxAttempts && competitionResult === null) {
        attempts++;

        // 5 digits: 90,000 codes against the number of competitions alive at once, since finished
        // ones are deleted and their codes released. Existing 4-digit codes keep working - matching
        // is exact, so the two lengths coexist and no migration was needed.
        const inviteCode = Math.floor(10000 + Math.random() * 90000).toString();

        if (RESERVED_INVITE_CODES.includes(inviteCode)) {
          continue;
        }

        // Cheap pre-check so the common case never reaches the constraint at all.
        // Case-insensitive to match the index, which is what decides.
        const existingCodeResult = await client.query(
          'SELECT id FROM competition WHERE UPPER(invite_code) = UPPER($1)',
          [inviteCode]
        );

        if (existingCodeResult.rows.length > 0) {
          continue;
        }

        await client.query('SAVEPOINT invite_code_attempt');

        try {
          // 3. Create the competition with generated invite code
          competitionResult = await client.query(`
            INSERT INTO competition (
              name,
              description,
              logo_url,
              venue_name,
              address_line_1,
              address_line_2,
              city,
              postcode,
              phone,
              email,
              entry_fee,
              prize_structure,
              team_list_id,
              status,
              lives_per_player,
              no_team_twice,
              organiser_id,
              invite_code,
              fixture_service,
              fixture_service_price_paid,
              fixture_service_granted_at,
              created_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'SETUP', $14, $15, $16, $17, $18, $19, $20, CURRENT_TIMESTAMP)
            RETURNING *
          `, [
            name.trim(),
            description ? description.trim() : null,
            logo_url ? logo_url.trim() : null,
            venue_name ? venue_name.trim() : null,
            address_line_1 ? address_line_1.trim() : null,
            address_line_2 ? address_line_2.trim() : null,
            city ? city.trim() : null,
            postcode ? postcode.trim() : null,
            phone ? phone.trim() : null,
            email ? email.trim() : null,
            entry_fee ? Number(entry_fee) : null,
            prize_structure ? prize_structure.trim() : null,
            team_list_id,
            livesPerPlayer,
            no_team_twice !== false, // Default to true
            organiser_id,
            inviteCode,
            wantsFixtureService,
            // Launch promotion: the service is offered free, so the recorded price is 0.00 rather
            // than the 20-credit list price. This is what tells a grandfathered competition apart from a
            // paying one once charging begins.
            wantsFixtureService ? 0.00 : null,
            wantsFixtureService ? new Date() : null
          ]);

          await client.query('RELEASE SAVEPOINT invite_code_attempt');
        } catch (err) {
          await client.query('ROLLBACK TO SAVEPOINT invite_code_attempt');
          competitionResult = null;

          // Only an invite code collision is retryable. Any other constraint violation is a
          // real fault and must surface rather than being spent as a retry.
          if (err.code !== '23505' || err.constraint !== 'idx_competition_invite_code') {
            throw err;
          }
        }
      }

      if (competitionResult === null) {
        throw new Error('SERVER_ERROR: Unable to generate unique invite code after multiple attempts');
      }

      const competition = competitionResult.rows[0];

      // 4. If organiser wants to join as a player, add them atomically
      if (organiser_joins_as_player === true) {

        // Add organiser to competition_user table
        await client.query(`
          INSERT INTO competition_user (
            competition_id,
            user_id,
            status,
            lives_remaining,
            joined_at,
            player_display_name
          )
          SELECT $1, $2, 'active', $3, CURRENT_TIMESTAMP, u.display_name
          FROM app_user u
          WHERE u.id = $2
        `, [
          competition.id,
          organiser_id,
          competition.lives_per_player
        ]);

      }

      // 5. Create audit log entry (same transaction ensures consistency)
      const participationStatus = organiser_joins_as_player ? 'as organiser and player' : 'as organiser only';
      await client.query(`
        INSERT INTO audit_log (competition_id, user_id, action, details)
        VALUES ($1, $2, 'Competition Created', $3)
      `, [
        competition.id,
        organiser_id,
        `Created competition "${competition.name}" with ${competition.lives_per_player} lives per player, joined ${participationStatus}`
      ]);

      // 7. Give this competition its round 1 NOW, from the calendar block the organiser chose.
      //
      //    This is the point of the whole thing (docs/competition-start.md). A competition with
      //    no round is an empty screen, and the week its organiser spends recruiting is exactly
      //    the week their recruits are looking at it - joining closes when round 1 locks, so that
      //    week is the only window there is. Round 1 exists before the organiser has even seen
      //    their dashboard, and every player who joins can pick immediately.
      //
      //    The fixtures are provisional: keyed by hand weeks ahead, and confirmed when the block
      //    is promoted and pushed, which reconciles this round rather than creating another.
      let startBlockLabel = null;

      if (wantsFixtureService && startBlockId !== null) {
        const start = await createRoundFromBlock(client, competition.id, team_list_id, startBlockId);
        startBlockLabel = start.label;

        await client.query(`
          INSERT INTO audit_log (competition_id, user_id, action, details)
          VALUES ($1, $2, 'Round Created', $3)
        `, [
          competition.id,
          organiser_id,
          `Round 1 created from calendar block "${start.label}" with ${start.fixtureCount} fixtures, locking ${start.lockTime}`
        ]);

      } else if (wantsFixtureService) {
        // No start date chosen - the calendar had nothing to offer, or the caller is an older
        // client. Falls back to the previous behaviour: take the staged batch if one happens to
        // be eligible, otherwise wait for the organiser to press Ready.
        //
        // Named competition, not a sweep: this used to call the all-competitions push, so
        // creating one competition could create rounds in every other subscriber as a side effect.
        const { pushFixturesToCompetition } = require('../services/fixtureService');
        try {
          await pushFixturesToCompetition(client, competition.id);
        } catch (error) {
          // Not eligible yet is the normal case, not a failure.
          if (error.message !== 'NOT_ELIGIBLE') {
            throw error;
          }
        }
      }

      // Return competition data for response
      return {
        competition,
        team_list_name: teamListResult.rows[0].name,
        start_block_label: startBlockLabel
      };
    });

    // Transaction completed successfully - send response
    res.json({
      return_code: "SUCCESS",
      message: "Competition created successfully",
      competition: {
        id: result.competition.id,
        name: result.competition.name,
        description: result.competition.description,
        status: result.competition.status,
        team_list_id: result.competition.team_list_id,
        lives_per_player: result.competition.lives_per_player,
        no_team_twice: result.competition.no_team_twice,
        fixture_service: result.competition.fixture_service,
        invite_code: result.competition.invite_code,
        created_at: result.competition.created_at,
        organiser_id: result.competition.organiser_id,
        // Non-null means round 1 exists already and this is when it locks - what the confirmation
        // screen and the welcome email tell the organiser and every player who joins.
        start_block_label: result.start_block_label
      }
    });

  } catch (error) {
    console.error('Create competition error:', error);
    
    // Handle specific business logic errors with appropriate return codes
    if (error.message === 'FIXTURE_SERVICE_UNAVAILABLE') {
      return res.json({
        return_code: "FIXTURE_SERVICE_UNAVAILABLE",
        message: "The fixture service does not cover this team list yet. Choose another list, or enter your own fixtures."
      });
    }

    // The chosen start date stopped being usable between loading the form and submitting it.
    // Its own return codes rather than VALIDATION_ERROR, because the fix is "pick another date"
    // and the frontend has to reload the options to offer them.
    if (error.message.startsWith('START_BLOCK_UNAVAILABLE:') || error.message.startsWith('START_BLOCK_TOO_SOON:')) {
      const [code, ...rest] = error.message.split(': ');
      return res.json({
        return_code: code,
        message: rest.join(': ')
      });
    }

    if (error.message.startsWith('VALIDATION_ERROR:')) {
      return res.json({
        return_code: "VALIDATION_ERROR",
        message: error.message.split(': ')[1]
      });
    }

    if (error.message.startsWith('SERVER_ERROR:')) {
      return res.json({
        return_code: "SERVER_ERROR", 
        message: error.message.split(': ')[1]
      });
    }

    // Database or unexpected errors
    res.json({
      return_code: "SERVER_ERROR",
      message: "Internal server error"
    });
  }
});

module.exports = router;