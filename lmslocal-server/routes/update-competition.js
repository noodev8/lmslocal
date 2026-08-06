/*
=======================================================================================================================================
API Route: update-competition
=======================================================================================================================================
Method: POST
Purpose: Updates competition details with validation based on competition status and atomically updates player lives
=======================================================================================================================================
Request Payload:
{
  "competition_id": 123,                    // integer, required - ID of competition to update
  "name": "Updated Competition Name",       // string, optional - New competition name (can be updated anytime)
  "description": "New description",         // string, optional - New competition description (can be updated anytime)
  "logo_url": "https://res.cloudinary.com/...", // string, optional - Logo image URL (max 500 chars, can be updated anytime)
  "venue_name": "The Red Barn",             // string, optional - Venue/organization name (max 100 chars, can be updated anytime)
  "entry_fee": 10.00,                      // decimal, optional - Entry fee in GBP (can be updated anytime)
  "prize_structure": "Winner takes all",    // string, optional - Prize distribution (max 500 chars, can be updated anytime)
  "lives_per_player": 3,                   // integer, optional - New lives per player (only if not started)
  "no_team_twice": false,                  // boolean, optional - Allow team reuse setting (only if not started)
  "fixture_service": true                  // boolean, optional - true = we push fixtures/results, false = organiser enters them
}

Success Response (ALWAYS HTTP 200):
{
  "return_code": "SUCCESS",
  "message": "Competition updated successfully",    // string, success confirmation message
  "competition": {                                  // object, updated competition details
    "id": 123,                                     // integer, competition ID
    "name": "Updated Competition Name",            // string, updated competition name
    "description": "New description",              // string, updated competition description
    "lives_per_player": 3,                        // integer, current lives per player setting
    "no_team_twice": false,                       // boolean, current team reuse setting
    "has_started": false,                         // boolean, indicates if competition has started
    "updated_at": "2025-09-06T10:30:00.000Z"     // string, ISO datetime when competition was last updated
  }
}

Error Response (ALWAYS HTTP 200):
{
  "return_code": "ERROR_TYPE",
  "message": "Descriptive error message"           // string, user-friendly error description
}
=======================================================================================================================================
Return Codes:
"SUCCESS"
"VALIDATION_ERROR"
"COMPETITION_NOT_FOUND"
"UNAUTHORIZED"
"COMPETITION_STARTED"
"FIXTURE_SERVICE_UNAVAILABLE"
"SERVER_ERROR"
=======================================================================================================================================
Fixture service:

- fixture_service is a plain setting here, saved with everything else on Save Changes. It is
  only a flag saying who supplies fixtures and results from the next push onwards; it does not
  create, delete or reset anything, and rounds already in the competition are left exactly as
  they are.

- The one thing still checked is team_list.fixture_service_available. We match staged fixtures
  to competitions on team_list_id, so opting in on a list we do not stage would leave the
  organiser waiting for rounds that never arrive. The settings page hides the choice entirely on
  those lists, so this refusal should never be seen in normal use.

- Pricing: during the launch promotion the service is free, so enabling records 0.00 in
  fixture_service_price_paid and stamps granted_at, and only the first grant does - a later
  toggle off and on again keeps the original stamp. Disabling deliberately leaves both alone;
  holding 0.00 is what identifies a grandfathered competition when charging starts.
=======================================================================================================================================
*/

const express = require('express');
const { transaction } = require('../database');
const { verifyToken } = require('../middleware/auth');
const { logApiCall } = require('../utils/apiLogger');
const router = express.Router();

// Launch promotion. The service lists at £10 but is being given away while we build up
// organisers, so this is what a first opt-in records. Raise it when charging starts -
// competitions already holding 0.00 are the grandfathered ones.
const PROMO_PRICE = 0.00;

router.post('/', verifyToken, async (req, res) => {
  // Log API call if enabled
  logApiCall('update-competition');
  
  try {
    // Extract request parameters and authenticated user ID
    const { competition_id, name, description, logo_url, venue_name, address_line_1, address_line_2, city, postcode, phone, email, entry_fee, prize_structure, lives_per_player, no_team_twice, fixture_service } = req.body;
    const user_id = req.user.id;


    // === INPUT VALIDATION ===
    // Validate required competition_id parameter
    if (!competition_id || !Number.isInteger(competition_id)) {
      return res.json({
        return_code: "VALIDATION_ERROR",
        message: "Competition ID is required and must be a valid integer"
      });
    }

    // Validate at least one field is being updated
    if (name === undefined && description === undefined && logo_url === undefined && venue_name === undefined && address_line_1 === undefined && address_line_2 === undefined && city === undefined && postcode === undefined && phone === undefined && email === undefined && entry_fee === undefined && prize_structure === undefined && lives_per_player === undefined && no_team_twice === undefined && fixture_service === undefined) {
      return res.json({
        return_code: "VALIDATION_ERROR",
        message: "At least one field must be provided for update"
      });
    }

    // Validate name if provided (can be updated anytime)
    if (name !== undefined) {
      if (!name || !name.trim()) {
        return res.json({
          return_code: "VALIDATION_ERROR",
          message: "Competition name cannot be empty"
        });
      }
      
      if (name.trim().length < 3) {
        return res.json({
          return_code: "VALIDATION_ERROR",
          message: "Competition name must be at least 3 characters long"
        });
      }
      
      if (name.trim().length > 200) {
        return res.json({
          return_code: "VALIDATION_ERROR",
          message: "Competition name must not exceed 200 characters"
        });
      }
    }

    // Validate description if provided (can be updated anytime)
    if (description !== undefined && description !== null && description.length > 1000) {
      return res.json({
        return_code: "VALIDATION_ERROR",
        message: "Competition description must not exceed 1000 characters"
      });
    }

    // Validate venue_name if provided (can be updated anytime)
    if (venue_name !== undefined && venue_name !== null && venue_name.length > 100) {
      return res.json({
        return_code: "VALIDATION_ERROR",
        message: "Venue name must be 100 characters or less"
      });
    }

    // Validate address fields if provided (can be updated anytime)
    if (address_line_1 !== undefined && address_line_1 !== null && address_line_1.length > 100) {
      return res.json({
        return_code: "VALIDATION_ERROR",
        message: "Address line 1 must be 100 characters or less"
      });
    }

    if (address_line_2 !== undefined && address_line_2 !== null && address_line_2.length > 100) {
      return res.json({
        return_code: "VALIDATION_ERROR",
        message: "Address line 2 must be 100 characters or less"
      });
    }

    if (city !== undefined && city !== null && city.length > 50) {
      return res.json({
        return_code: "VALIDATION_ERROR",
        message: "City must be 50 characters or less"
      });
    }

    if (postcode !== undefined && postcode !== null && postcode.length > 20) {
      return res.json({
        return_code: "VALIDATION_ERROR",
        message: "Postcode must be 20 characters or less"
      });
    }

    if (phone !== undefined && phone !== null && phone.length > 20) {
      return res.json({
        return_code: "VALIDATION_ERROR",
        message: "Phone number must be 20 characters or less"
      });
    }

    if (email !== undefined && email !== null && email.length > 255) {
      return res.json({
        return_code: "VALIDATION_ERROR",
        message: "Email address must be 255 characters or less"
      });
    }

    // Validate logo_url if provided (can be updated anytime)
    if (logo_url !== undefined && logo_url !== null && logo_url.length > 500) {
      return res.json({
        return_code: "VALIDATION_ERROR",
        message: "Logo URL must be 500 characters or less"
      });
    }

    // Validate entry_fee if provided (can be updated anytime)
    if (entry_fee !== undefined && entry_fee !== null) {
      const fee = Number(entry_fee);
      if (isNaN(fee) || fee < 0) {
        return res.json({
          return_code: "VALIDATION_ERROR",
          message: "Entry fee must be a positive number"
        });
      }
    }

    // Validate prize_structure if provided (can be updated anytime)
    if (prize_structure !== undefined && prize_structure !== null && prize_structure.length > 500) {
      return res.json({
        return_code: "VALIDATION_ERROR",
        message: "Prize structure must be 500 characters or less"
      });
    }

    // Validate lives_per_player if provided (only if not started)
    if (lives_per_player !== undefined) {
      if (!Number.isInteger(lives_per_player) || lives_per_player < 0 || lives_per_player > 2) {
        return res.json({
          return_code: "VALIDATION_ERROR",
          message: "Lives per player must be an integer between 0 and 2"
        });
      }
    }

    // Validate no_team_twice if provided (only if not started)
    if (no_team_twice !== undefined && typeof no_team_twice !== 'boolean') {
      return res.json({
        return_code: "VALIDATION_ERROR",
        message: "No team twice setting must be a boolean value"
      });
    }

    // Validate fixture_service if provided (can be changed anytime)
    if (fixture_service !== undefined && typeof fixture_service !== 'boolean') {
      return res.json({
        return_code: "VALIDATION_ERROR",
        message: "Fixture service setting must be a boolean value"
      });
    }

    // === ATOMIC UPDATE TRANSACTION ===
    // Execute all validations and updates within a single atomic transaction
    const result = await transaction(async (client) => {

      // 1. Get current competition details with row lock to prevent concurrent modifications
      const competitionResult = await client.query(`
        SELECT id, name, description, logo_url, venue_name, address_line_1, address_line_2, city, postcode, phone, email, entry_fee, prize_structure, lives_per_player, no_team_twice,
               fixture_service, fixture_service_granted_at, team_list_id,
               organiser_id, invite_code, created_at
        FROM competition
        WHERE id = $1
        FOR UPDATE
      `, [competition_id]);

      if (competitionResult.rows.length === 0) {
        throw new Error('COMPETITION_NOT_FOUND: Competition not found');
      }

      const currentCompetition = competitionResult.rows[0];

      // 2. Verify user is the organiser of this competition
      if (currentCompetition.organiser_id !== user_id) {
        throw new Error('UNAUTHORIZED: Only the competition organiser can update this competition');
      }

      // 3. Check if competition has started (invite_code is NULL means started)
      const hasStarted = currentCompetition.invite_code === null;
      
      // 4. Validate restricted fields can only be changed if competition hasn't started
      if (hasStarted && (lives_per_player !== undefined || no_team_twice !== undefined)) {
        throw new Error('COMPETITION_STARTED: Lives per player and team reuse settings cannot be changed after competition has started');
      }

      // 5. Turning the fixture service on only makes sense on a team list we stage fixtures for -
      //    the push matches on team_list_id, so anywhere else the competition would sit waiting
      //    for rounds that never come. Turning it off is always allowed.
      if (fixture_service === true && currentCompetition.fixture_service !== true) {
        const listResult = await client.query(
          'SELECT fixture_service_available FROM team_list WHERE id = $1',
          [currentCompetition.team_list_id]
        );

        if (listResult.rows[0]?.fixture_service_available !== true) {
          throw new Error('FIXTURE_SERVICE_UNAVAILABLE: The fixture service does not cover this competition\'s team list yet');
        }
      }

      // 6. Prepare update fields with current values as defaults
      const updateData = {
        name: name !== undefined ? name.trim() : currentCompetition.name,
        description: description !== undefined ? (description || null) : currentCompetition.description,
        logo_url: logo_url !== undefined ? (logo_url ? logo_url.trim() : null) : currentCompetition.logo_url,
        venue_name: venue_name !== undefined ? (venue_name ? venue_name.trim() : null) : currentCompetition.venue_name,
        address_line_1: address_line_1 !== undefined ? (address_line_1 ? address_line_1.trim() : null) : currentCompetition.address_line_1,
        address_line_2: address_line_2 !== undefined ? (address_line_2 ? address_line_2.trim() : null) : currentCompetition.address_line_2,
        city: city !== undefined ? (city ? city.trim() : null) : currentCompetition.city,
        postcode: postcode !== undefined ? (postcode ? postcode.trim() : null) : currentCompetition.postcode,
        phone: phone !== undefined ? (phone ? phone.trim() : null) : currentCompetition.phone,
        email: email !== undefined ? (email ? email.trim() : null) : currentCompetition.email,
        entry_fee: entry_fee !== undefined ? (entry_fee !== null ? Number(entry_fee) : null) : currentCompetition.entry_fee,
        prize_structure: prize_structure !== undefined ? (prize_structure ? prize_structure.trim() : null) : currentCompetition.prize_structure,
        lives_per_player: lives_per_player !== undefined ? lives_per_player : currentCompetition.lives_per_player,
        no_team_twice: no_team_twice !== undefined ? no_team_twice : currentCompetition.no_team_twice,
        fixture_service: fixture_service !== undefined ? fixture_service : currentCompetition.fixture_service
      };

      // 7. Update the competition record with new values.
      //    The promo price and grant stamp are written only on the first time the service is
      //    turned on - COALESCE keeps the original stamp through any later off/on toggling, and
      //    turning it off leaves both columns alone (see the header).
      const grantingFixtureService = fixture_service === true && currentCompetition.fixture_service !== true;

      const updatedCompetitionResult = await client.query(`
        UPDATE competition
        SET name = $1, description = $2, logo_url = $3, venue_name = $4, address_line_1 = $5, address_line_2 = $6, city = $7, postcode = $8, phone = $9, email = $10, entry_fee = $11, prize_structure = $12, lives_per_player = $13, no_team_twice = $14, fixture_service = $15,
            fixture_service_price_paid = CASE WHEN $16 THEN COALESCE(fixture_service_price_paid, $17) ELSE fixture_service_price_paid END,
            fixture_service_granted_at = CASE WHEN $16 THEN COALESCE(fixture_service_granted_at, CURRENT_TIMESTAMP) ELSE fixture_service_granted_at END
        WHERE id = $18
        RETURNING id, name, description, logo_url, venue_name, address_line_1, address_line_2, city, postcode, phone, email, entry_fee, prize_structure, lives_per_player, no_team_twice, fixture_service,
                  invite_code, created_at, organiser_id
      `, [
        updateData.name,
        updateData.description,
        updateData.logo_url,
        updateData.venue_name,
        updateData.address_line_1,
        updateData.address_line_2,
        updateData.city,
        updateData.postcode,
        updateData.phone,
        updateData.email,
        updateData.entry_fee,
        updateData.prize_structure,
        updateData.lives_per_player,
        updateData.no_team_twice,
        updateData.fixture_service,
        grantingFixtureService,
        PROMO_PRICE,
        competition_id
      ]);

      const updatedCompetition = updatedCompetitionResult.rows[0];

      // 8. If lives_per_player changed and competition hasn't started, update all existing players
      if (lives_per_player !== undefined && 
          lives_per_player !== currentCompetition.lives_per_player && 
          !hasStarted) {
        
        await client.query(`
          UPDATE competition_user 
          SET lives_remaining = $1
          WHERE competition_id = $2
        `, [lives_per_player, competition_id]);
      }

      // 9. Create audit log entry for the update action
      const auditDetails = [];
      if (name !== undefined && name.trim() !== currentCompetition.name) {
        auditDetails.push(`name changed from "${currentCompetition.name}" to "${name.trim()}"`);
      }
      if (description !== undefined && description !== currentCompetition.description) {
        auditDetails.push(`description updated`);
      }
      if (venue_name !== undefined && venue_name !== currentCompetition.venue_name) {
        auditDetails.push(`venue name updated`);
      }
      if (logo_url !== undefined && logo_url !== currentCompetition.logo_url) {
        auditDetails.push(`logo updated`);
      }
      if (entry_fee !== undefined && Number(entry_fee) !== currentCompetition.entry_fee) {
        auditDetails.push(`entry fee updated to £${entry_fee || 0}`);
      }
      if (prize_structure !== undefined && prize_structure !== currentCompetition.prize_structure) {
        auditDetails.push(`prize structure updated`);
      }
      if (lives_per_player !== undefined && lives_per_player !== currentCompetition.lives_per_player) {
        auditDetails.push(`lives per player changed from ${currentCompetition.lives_per_player} to ${lives_per_player}`);
      }
      if (no_team_twice !== undefined && no_team_twice !== currentCompetition.no_team_twice) {
        auditDetails.push(`team reuse setting changed to ${no_team_twice ? 'not allowed' : 'allowed'}`);
      }
      if (fixture_service !== undefined && fixture_service !== currentCompetition.fixture_service) {
        auditDetails.push(`fixture service ${fixture_service ? 'enabled' : 'disabled'}`);
      }

      if (auditDetails.length > 0) {
        await client.query(`
          INSERT INTO audit_log (competition_id, user_id, action, details)
          VALUES ($1, $2, 'Competition Updated', $3)
        `, [
          competition_id,
          user_id,
          auditDetails.join(', ')
        ]);
      }

      // Return updated competition data for response
      return {
        competition: updatedCompetition,
        hasStarted: hasStarted
      };
    });

    // === SUCCESS RESPONSE ===
    // Transaction completed successfully - return updated competition details
    res.json({
      return_code: "SUCCESS",
      message: "Competition updated successfully",
      competition: {
        id: result.competition.id,                                    // Competition ID for reference
        name: result.competition.name,                               // Updated competition name
        description: result.competition.description,                 // Updated competition description
        lives_per_player: result.competition.lives_per_player,      // Current lives per player setting
        no_team_twice: result.competition.no_team_twice,           // Current team reuse prevention setting
        fixture_service: result.competition.fixture_service,       // Current fixture service setting
        has_started: result.hasStarted,                            // Boolean indicating if competition has started
        updated_at: new Date().toISOString()                      // Current timestamp in ISO format
      }
    });

  } catch (error) {
    // === ERROR HANDLING ===
    // Log detailed error for debugging but return appropriate user-facing messages
    console.error('Update competition error:', error);
    
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

    if (error.message.startsWith('FIXTURE_SERVICE_UNAVAILABLE:')) {
      return res.json({
        return_code: "FIXTURE_SERVICE_UNAVAILABLE",
        message: error.message.split(': ')[1]
      });
    }

    if (error.message.startsWith('COMPETITION_STARTED:')) {
      return res.json({
        return_code: "COMPETITION_STARTED",
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