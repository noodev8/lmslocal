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
  "lives_per_player": 3,                   // integer, optional - New lives per player (only if not started)
  "no_team_twice": false                   // boolean, optional - Allow team reuse setting (only if not started)
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
"SERVER_ERROR"
=======================================================================================================================================
*/

const express = require('express');
const { query, transaction } = require('../database');
const { verifyToken } = require('../middleware/auth');
const { logApiCall } = require('../utils/apiLogger');
const router = express.Router();

router.post('/', verifyToken, async (req, res) => {
  // Log API call if enabled
  logApiCall('update-competition');
  
  try {
    // Extract request parameters and authenticated user ID
    const { competition_id, name, description, logo_url, venue_name, address_line_1, address_line_2, city, postcode, phone, email, lives_per_player, no_team_twice } = req.body;
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
    if (name === undefined && description === undefined && logo_url === undefined && venue_name === undefined && address_line_1 === undefined && address_line_2 === undefined && city === undefined && postcode === undefined && phone === undefined && email === undefined && lives_per_player === undefined && no_team_twice === undefined) {
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

    // === ATOMIC UPDATE TRANSACTION ===
    // Execute all validations and updates within a single atomic transaction
    const result = await transaction(async (client) => {

      // 1. Get current competition details with row lock to prevent concurrent modifications
      const competitionResult = await client.query(`
        SELECT id, name, description, logo_url, venue_name, address_line_1, address_line_2, city, postcode, phone, email, lives_per_player, no_team_twice,
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

      // 5. Prepare update fields with current values as defaults
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
        lives_per_player: lives_per_player !== undefined ? lives_per_player : currentCompetition.lives_per_player,
        no_team_twice: no_team_twice !== undefined ? no_team_twice : currentCompetition.no_team_twice
      };

      // 6. Update the competition record with new values
      const updatedCompetitionResult = await client.query(`
        UPDATE competition
        SET name = $1, description = $2, logo_url = $3, venue_name = $4, address_line_1 = $5, address_line_2 = $6, city = $7, postcode = $8, phone = $9, email = $10, lives_per_player = $11, no_team_twice = $12
        WHERE id = $13
        RETURNING id, name, description, logo_url, venue_name, address_line_1, address_line_2, city, postcode, phone, email, lives_per_player, no_team_twice,
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
        updateData.lives_per_player,
        updateData.no_team_twice,
        competition_id
      ]);

      const updatedCompetition = updatedCompetitionResult.rows[0];

      // 7. If lives_per_player changed and competition hasn't started, update all existing players
      if (lives_per_player !== undefined && 
          lives_per_player !== currentCompetition.lives_per_player && 
          !hasStarted) {
        
        await client.query(`
          UPDATE competition_user 
          SET lives_remaining = $1
          WHERE competition_id = $2
        `, [lives_per_player, competition_id]);
      }

      // 8. Create audit log entry for the update action
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
      if (lives_per_player !== undefined && lives_per_player !== currentCompetition.lives_per_player) {
        auditDetails.push(`lives per player changed from ${currentCompetition.lives_per_player} to ${lives_per_player}`);
      }
      if (no_team_twice !== undefined && no_team_twice !== currentCompetition.no_team_twice) {
        auditDetails.push(`team reuse setting changed to ${no_team_twice ? 'not allowed' : 'allowed'}`);
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