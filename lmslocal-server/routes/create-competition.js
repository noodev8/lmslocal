/*
=======================================================================================================================================
API Route: create-competition
=======================================================================================================================================
Method: POST
Purpose: Creates a new competition for authenticated user with unique invite code and slug
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
  "team_list_id": 1,                           // integer, required - ID of team list to use
  "lives_per_player": 1,                       // integer, optional - Number of lives per player (default: 1)
  "no_team_twice": true,                       // boolean, optional - Prevent team reuse (default: true)
  "organiser_joins_as_player": true            // boolean, optional - Add organiser as player (default: false)
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
    "invite_code": "4567",                     // string, 4-digit invite code
    "created_at": "2025-01-01T12:00:00.000Z",  // string, ISO datetime when created
    "organiser_id": 456                        // integer, organiser user ID
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
"UNAUTHORIZED"
"SERVER_ERROR"
=======================================================================================================================================
*/

const express = require('express');
const { transaction } = require('../database');
const { verifyToken } = require('../middleware/auth');
const router = express.Router();

router.post('/', verifyToken, async (req, res) => {
  try {
    const { name, description, logo_url, venue_name, address_line_1, address_line_2, city, postcode, phone, email, team_list_id, lives_per_player, no_team_twice, organiser_joins_as_player } = req.body;
    const organiser_id = req.user.id;

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

    // Execute all operations in a single atomic transaction
    const result = await transaction(async (client) => {

      // 1. Validate team_list exists and is accessible (with row lock)
      const teamListResult = await client.query(`
        SELECT id, name 
        FROM team_list 
        WHERE id = $1 AND is_active = true 
        FOR UPDATE
      `, [team_list_id]);

      if (teamListResult.rows.length === 0) {
        throw new Error('VALIDATION_ERROR: Invalid team list selected');
      }

      // 2. Generate unique invite code atomically (prevents race conditions)
      let inviteCode = '';
      let attempts = 0;
      const maxAttempts = 100;

      while (attempts < maxAttempts) {
        // Generate 4-digit random number
        inviteCode = Math.floor(1000 + Math.random() * 9000).toString();

        // Check if this code already exists within the same transaction
        const existingCodeResult = await client.query(
          'SELECT id FROM competition WHERE invite_code = $1',
          [inviteCode]
        );

        if (existingCodeResult.rows.length === 0) {
          break; // Found unique code
        }
        
        attempts++;
      }

      if (attempts >= maxAttempts) {
        throw new Error('SERVER_ERROR: Unable to generate unique invite code after multiple attempts');
      }

      // 3. Create the competition with generated invite code
      const competitionResult = await client.query(`
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
          team_list_id,
          status,
          lives_per_player,
          no_team_twice,
          organiser_id,
          invite_code,
          created_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'SETUP', $12, $13, $14, $15, CURRENT_TIMESTAMP)
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
        team_list_id,
        lives_per_player || 1,
        no_team_twice !== false, // Default to true
        organiser_id,
        inviteCode
      ]);

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
            joined_at
          )
          VALUES ($1, $2, 'active', $3, CURRENT_TIMESTAMP)
        `, [
          competition.id,
          organiser_id,
          competition.lives_per_player
        ]);

        // Populate allowed teams for the organiser (atomic team population)
        await client.query(`
          INSERT INTO allowed_teams (competition_id, user_id, team_id, created_at)
          SELECT $1, $2, t.id, NOW()
          FROM team t
          WHERE t.team_list_id = $3 AND t.is_active = true
        `, [competition.id, organiser_id, team_list_id]);
      }

      // 5. Update user_type to reflect organiser status (check if first competition)
      const existingCompetitionsResult = await client.query(
        'SELECT COUNT(*) as count FROM competition WHERE organiser_id = $1',
        [organiser_id]
      );
      
      const isFirstCompetition = parseInt(existingCompetitionsResult.rows[0].count) === 1; // This competition is the first
      
      if (isFirstCompetition) {
        // Check if user is already a player in other competitions
        const playerCompetitionsResult = await client.query(
          'SELECT COUNT(*) as count FROM competition_user WHERE user_id = $1',
          [organiser_id]
        );
        
        const isAlsoPlayer = parseInt(playerCompetitionsResult.rows[0].count) > 0;
        const newUserType = isAlsoPlayer ? 'both' : 'admin';
        
        // Update user_type in app_user table
        await client.query(`
          UPDATE app_user 
          SET user_type = $1, updated_at = CURRENT_TIMESTAMP 
          WHERE id = $2
        `, [newUserType, organiser_id]);
        
      }

      // 6. Create audit log entry (same transaction ensures consistency)
      const participationStatus = organiser_joins_as_player ? 'as organiser and player' : 'as organiser only';
      await client.query(`
        INSERT INTO audit_log (competition_id, user_id, action, details)
        VALUES ($1, $2, 'Competition Created', $3)
      `, [
        competition.id,
        organiser_id,
        `Created competition "${competition.name}" with ${competition.lives_per_player} lives per player, joined ${participationStatus}`
      ]);

      // Return competition data for response
      return {
        competition,
        team_list_name: teamListResult.rows[0].name
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
        invite_code: result.competition.invite_code,
        created_at: result.competition.created_at,
        organiser_id: result.competition.organiser_id
      }
    });

  } catch (error) {
    console.error('Create competition error:', error);
    
    // Handle specific business logic errors with appropriate return codes
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