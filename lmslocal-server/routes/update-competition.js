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
    const { competition_id, name, description, lives_per_player, no_team_twice } = req.body;
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
    if (name === undefined && description === undefined && lives_per_player === undefined && no_team_twice === undefined) {
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

    // Validate lives_per_player if provided (only if not started)
    if (lives_per_player !== undefined) {
      if (!Number.isInteger(lives_per_player) || lives_per_player < 1 || lives_per_player > 10) {
        return res.json({
          return_code: "VALIDATION_ERROR",
          message: "Lives per player must be an integer between 1 and 10"
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
        SELECT id, name, description, lives_per_player, no_team_twice, 
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
        lives_per_player: lives_per_player !== undefined ? lives_per_player : currentCompetition.lives_per_player,
        no_team_twice: no_team_twice !== undefined ? no_team_twice : currentCompetition.no_team_twice
      };

      // 6. Update the competition record with new values
      const updatedCompetitionResult = await client.query(`
        UPDATE competition 
        SET name = $1, description = $2, lives_per_player = $3, no_team_twice = $4
        WHERE id = $5
        RETURNING id, name, description, lives_per_player, no_team_twice, 
                  invite_code, created_at, organiser_id
      `, [
        updateData.name,
        updateData.description,
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