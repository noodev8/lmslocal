/*
=======================================================================================================================================
API Route: bot-join
=======================================================================================================================================
Method: POST
Purpose: Add bot players to a competition for testing purposes using invite code with realistic names and bulk creation
=======================================================================================================================================
Request Payload:
{
  "invite_code": "ABC123",             // string, required - competition invite code
  "count": 50,                         // integer, required - number of bots to create (1-200)
  "bot_manage": "BOT_MAGIC_2025"       // string, required - bot management identifier
}

Success Response (ALWAYS HTTP 200):
{
  "return_code": "SUCCESS",
  "message": "50 bots added successfully",  // string, confirmation message
  "bots_created": 50                        // integer, count of bots successfully created
}

Error Response (ALWAYS HTTP 200):
{
  "return_code": "ERROR_TYPE",
  "message": "Descriptive error message"   // string, user-friendly error description
}
=======================================================================================================================================
Return Codes:
"SUCCESS"
"VALIDATION_ERROR"      - Missing or invalid parameters
"UNAUTHORIZED"          - Invalid auth_code
"COMPETITION_NOT_FOUND" - Competition does not exist with provided code
"COMPETITION_STARTED"   - Cannot join after round 1 has started
"SERVER_ERROR"          - Database error or unexpected server failure
=======================================================================================================================================
*/

const express = require('express');
const { query, transaction } = require('../database');
const router = express.Router();

// Bot management identifier for testing endpoints
const BOT_MANAGE = "BOT_MAGIC_2025";

// First names for combinatorial generation (60 names)
const FIRST_NAMES = [
  "James", "Emma", "Oliver", "Ava", "William", "Sophia", "Elijah", "Isabella",
  "Lucas", "Mia", "Mason", "Charlotte", "Ethan", "Amelia", "Alexander",
  "Harper", "Michael", "Evelyn", "Daniel", "Abigail", "Matthew", "Emily",
  "Henry", "Elizabeth", "Jackson", "Sofia", "Sebastian", "Avery", "David",
  "Ella", "Joseph", "Scarlett", "Samuel", "Grace", "Carter", "Chloe",
  "Owen", "Victoria", "Wyatt", "Aria", "John", "Madison", "Jack", "Luna",
  "Luke", "Layla", "Jayden", "Zoe", "Dylan", "Penelope", "Gabriel", "Riley",
  "Anthony", "Nora", "Isaac", "Lily", "Levi", "Eleanor", "Andrew", "Hannah"
];

// Last names for combinatorial generation (60 names)
const LAST_NAMES = [
  "Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis",
  "Rodriguez", "Martinez", "Hernandez", "Lopez", "Gonzalez", "Wilson", "Anderson",
  "Thomas", "Taylor", "Moore", "Jackson", "Martin", "Lee", "Perez", "Thompson",
  "White", "Harris", "Sanchez", "Clark", "Ramirez", "Lewis", "Robinson",
  "Walker", "Young", "Allen", "King", "Wright", "Scott", "Torres", "Nguyen",
  "Hill", "Flores", "Green", "Adams", "Nelson", "Baker", "Hall", "Rivera",
  "Campbell", "Mitchell", "Carter", "Roberts", "Gomez", "Phillips", "Evans",
  "Turner", "Diaz", "Parker", "Cruz", "Edwards", "Collins", "Stewart"
];

// Single names for variety (40 names)
const SINGLE_NAMES = [
  "Alex", "Jordan", "Taylor", "Morgan", "Casey", "Riley", "Avery", "Quinn",
  "Cameron", "Skylar", "Dakota", "Rowan", "Sage", "River", "Phoenix", "Kai",
  "Drew", "Blake", "Reese", "Finley", "Charlie", "Parker", "Peyton", "Hayden",
  "Emerson", "Sawyer", "Jamie", "Elliot", "Remy", "Jules", "Sam", "Max",
  "Lou", "Frankie", "Chris", "Jesse", "Pat", "Robin", "Val", "Ari"
];

router.post('/', async (req, res) => {
  try {
    const { invite_code, count, bot_manage } = req.body;

    // STEP 1: Validate bot management identifier
    if (!bot_manage || bot_manage !== BOT_MANAGE) {
      return res.json({
        return_code: "UNAUTHORIZED",
        message: "Invalid bot management identifier"
      });
    }

    // STEP 2: Validate required input parameters
    if (!invite_code || typeof invite_code !== 'string' || invite_code.trim().length === 0) {
      return res.json({
        return_code: "VALIDATION_ERROR",
        message: "Invite code is required and must be a non-empty string"
      });
    }

    if (!count || !Number.isInteger(count) || count < 1 || count > 200) {
      return res.json({
        return_code: "VALIDATION_ERROR",
        message: "Count must be an integer between 1 and 200"
      });
    }

    const code = invite_code.trim().toUpperCase();

    // STEP 3: Get competition info and validate joining eligibility
    const competitionQuery = `
      WITH competition_data AS (
        SELECT
          c.id as competition_id,
          c.name as competition_name,
          c.lives_per_player,
          c.organiser_id,
          c.team_list_id,
          MAX(r.round_number) as current_round_number,
          MAX(r.lock_time) as latest_lock_time,
          NOW() as current_time
        FROM competition c
        LEFT JOIN round r ON c.id = r.competition_id
        WHERE UPPER(c.invite_code) = $1 OR UPPER(c.slug) = $1
        GROUP BY c.id, c.name, c.lives_per_player, c.organiser_id, c.team_list_id
      )
      SELECT * FROM competition_data
    `;

    const competitionResult = await query(competitionQuery, [code]);

    if (competitionResult.rows.length === 0) {
      return res.json({
        return_code: "COMPETITION_NOT_FOUND",
        message: "No competition found with that code or slug"
      });
    }

    const competition = competitionResult.rows[0];

    // Check if joining is still allowed (same logic as regular join)
    const currentRound = competition.current_round_number;
    if (currentRound && currentRound > 1) {
      return res.json({
        return_code: "COMPETITION_STARTED",
        message: "Cannot join - competition has progressed beyond round 1"
      });
    }

    if (competition.latest_lock_time) {
      const lockTime = new Date(competition.latest_lock_time);
      const currentTime = new Date();

      if (currentTime >= lockTime) {
        return res.json({
          return_code: "COMPETITION_STARTED",
          message: "Cannot join - Round 1 has locked and competition has started"
        });
      }
    }

    // STEP 4: Create bots in bulk transaction
    let botsCreated = 0;

    await transaction(async (client) => {
      // Get existing bot names in this competition to avoid duplicates
      const existingNamesResult = await client.query(`
        SELECT u.display_name
        FROM app_user u
        INNER JOIN competition_user cu ON u.id = cu.user_id
        WHERE cu.competition_id = $1 AND u.email LIKE 'bot_%@lms-guest.com'
      `, [competition.competition_id]);

      const existingNames = new Set(existingNamesResult.rows.map(row => row.display_name));

      // Generate name pool: combinations of first + last names, plus single names
      const namePool = [];

      // Add full name combinations (60 × 60 = 3,600 combinations)
      for (const firstName of FIRST_NAMES) {
        for (const lastName of LAST_NAMES) {
          const fullName = `${firstName} ${lastName}`;
          if (!existingNames.has(fullName)) {
            namePool.push(fullName);
          }
        }
      }

      // Add single names (40 names)
      for (const singleName of SINGLE_NAMES) {
        if (!existingNames.has(singleName)) {
          namePool.push(singleName);
        }
      }

      // Shuffle the name pool for randomness
      const shuffledNames = namePool.sort(() => Math.random() - 0.5);

      // Check if we have enough unique names
      if (shuffledNames.length < count) {
        throw {
          return_code: "VALIDATION_ERROR",
          message: `Not enough unique names available. Requested ${count}, but only ${shuffledNames.length} unique names remain.`
        };
      }

      // Select the required number of names
      const selectedNames = shuffledNames.slice(0, count);

      for (let i = 0; i < selectedNames.length; i++) {
        const botName = selectedNames[i];

        // Create user account with bot email pattern
        // Email will be bot_{user_id}@lms-guest.com after user is created
        // Use same standard password hash as offline players
        const standardPasswordHash = '$2b$12$PwWL.rUjgbzUAhPEAAGlUOwVdr9oqHpFyBITEr9NCLR7BKOZSoWn2';

        // Use temporary email, then update after getting user_id
        const tempEmail = `temp_bot_${Date.now()}_${i}@lms-guest.com`;

        const userResult = await client.query(`
          INSERT INTO app_user (email, password_hash, display_name, email_verified, created_by_user_id)
          VALUES ($1, $2, $3, true, 1)
          RETURNING id
        `, [tempEmail, standardPasswordHash, botName]);

        const userId = userResult.rows[0].id;

        // Update email to bot_{user_id}@lms-guest.com format
        await client.query(`
          UPDATE app_user
          SET email = $1
          WHERE id = $2
        `, [`bot_${userId}@lms-guest.com`, userId]);

        // Join competition
        await client.query(`
          INSERT INTO competition_user (competition_id, user_id, status, lives_remaining, joined_at, player_display_name)
          VALUES ($1, $2, 'active', $3, NOW(), $4)
        `, [competition.competition_id, userId, competition.lives_per_player, botName]);

        // Populate allowed teams
        await client.query(`
          INSERT INTO allowed_teams (competition_id, user_id, team_id)
          SELECT $1, $2, t.id
          FROM team t
          WHERE t.team_list_id = $3 AND t.is_active = true
          ON CONFLICT (competition_id, user_id, team_id) DO NOTHING
        `, [competition.competition_id, userId, competition.team_list_id]);

        botsCreated++;
      }
    });

    // STEP 5: Return success response
    return res.json({
      return_code: "SUCCESS",
      message: `${botsCreated} bot${botsCreated !== 1 ? 's' : ''} added successfully`,
      bots_created: botsCreated
    });

  } catch (error) {
    // Handle custom business logic errors
    if (error.return_code) {
      return res.json({
        return_code: error.return_code,
        message: error.message
      });
    }

    // Log detailed error information
    console.error('Bot join error:', {
      error: error.message,
      stack: error.stack?.substring(0, 500),
      invite_code: req.body?.invite_code,
      count: req.body?.count,
      timestamp: new Date().toISOString()
    });

    return res.json({
      return_code: "SERVER_ERROR",
      message: "Failed to add bots to competition"
    });
  }
});

module.exports = router;
