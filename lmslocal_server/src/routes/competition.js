/*
=======================================================================================================================================
API Route: /api/competition/team-lists
=======================================================================================================================================
Method: POST
Purpose: Get available team lists for competition creation
=======================================================================================================================================
Request Payload:
{
  "organisation_id": 123                 // number, required - organisation ID to check custom team lists
}

Success Response:
{
  "return_code": "SUCCESS",
  "team_lists": [                                  // array, available team lists
    {
      "id": 1,                                     // integer, team list ID
      "name": "Premier League 2025-26",           // string, team list name
      "type": "epl",                               // string, team list type
      "season": "2025-26",                         // string, season identifier
      "team_count": 20                             // integer, number of teams in list
    }
  ]
}
=======================================================================================================================================
Return Codes:
"SUCCESS"
"VALIDATION_ERROR"
"SERVER_ERROR"
=======================================================================================================================================

=======================================================================================================================================
API Route: /api/competition/create
=======================================================================================================================================
Method: POST
Purpose: Create a new Last Man Standing competition within an organisation
=======================================================================================================================================
Request Payload:
{
  "organisation_id": 123,                       // number, required - organisation ID
  "name": "Premier League 2025",                // string, required - competition name
  "description": "Weekly EPL predictions",      // string, optional - competition description
  "logo_url": "https://example.com/logo.jpg",  // string, optional - competition logo URL
  "team_list_id": 1,                           // integer, required - ID of team list to use
  "lives_per_player": 1,                       // integer, optional (default: 1) - lives each player starts with
  "no_team_twice": true,                       // boolean, optional (default: true) - prevent picking same team twice
  "lock_hours_before_kickoff": 1,              // integer, optional (default: 1) - hours before kickoff to lock picks
  "timezone": "Europe/London",                 // string, optional (default: Europe/London) - competition timezone
  "join_as_player": false                      // boolean, optional (default: false) - also add creator as player
}

Success Response:
{
  "return_code": "SUCCESS",
  "competition_id": 123,                       // integer, ID of created competition
  "invite_code": "ABC123",                     // string, unique code for players to join
  "message": "Competition created successfully" // string, success message
}
=======================================================================================================================================
Return Codes:
"SUCCESS"
"VALIDATION_ERROR"
"ORGANISATION_NOT_FOUND"
"TEAM_LIST_NOT_FOUND"
"UNAUTHORISED"
"SERVER_ERROR"
=======================================================================================================================================

=======================================================================================================================================
API Route: /competition/get
=======================================================================================================================================
Method: POST
Purpose: Get competition details by ID
=======================================================================================================================================
Request Payload:
{
  "competition_id": 456                 // number, required - competition ID
}

Success Response:
{
  "return_code": "SUCCESS",
  "competition_id": 456,                // number, unique competition ID
  "name": "Red Lion LMS 2025",          // string, competition name
  "description": "Weekly LMS game",     // string, competition description
  "organisation_id": 123,               // number, organisation ID
  "organisation_name": "The Red Lion",  // string, organisation name
  "team_list_id": 1,                    // number, team list ID
  "team_list_name": "EPL 2025-26",      // string, team list name
  "status": "setup",                    // string, competition status
  "lives_per_player": 1,                // number, lives per player
  "no_team_twice": true,                // boolean, no team twice rule
  "lock_hours_before_kickoff": 1,       // number, lock timing
  "created_at": "2024-01-01T12:00:00Z", // string, creation timestamp
  "player_count": 0                     // number, current player count
}
=======================================================================================================================================
Return Codes:
"SUCCESS"
"VALIDATION_ERROR"
"COMPETITION_NOT_FOUND"
"DATABASE_ERROR"
"SERVER_ERROR"
=======================================================================================================================================
*/

const express = require('express');
const { pool } = require('../config/database');
const { requireAuth } = require('../middleware/auth');
const router = express.Router();

// Apply authentication to all competition routes
router.use(requireAuth);

// Generate random invite code
function generateInviteCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 6; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

// Get available team lists
router.post('/team-lists', async (req, res) => {
    try {
        console.log('📋 Getting team lists for competition creation');
        
        const { organisation_id } = req.body;
        
        // Validation
        if (!organisation_id) {
            return res.json({
                return_code: 'VALIDATION_ERROR',
                message: 'Missing required field: organisation_id'
            });
        }

        const client = await pool.connect();
        
        try {
            // Get system team lists (EPL) and organisation-specific custom lists
            const query = `
                SELECT 
                    tl.id,
                    tl.name,
                    tl.type,
                    tl.season,
                    COUNT(t.id) as team_count
                FROM team_list tl
                LEFT JOIN team t ON t.team_list_id = tl.id AND t.is_active = true
                WHERE tl.is_active = true 
                  AND (tl.organisation_id IS NULL OR tl.organisation_id = $1)
                GROUP BY tl.id, tl.name, tl.type, tl.season
                ORDER BY 
                  CASE WHEN tl.type = 'epl' THEN 0 ELSE 1 END,
                  tl.name
            `;
            
            const result = await client.query(query, [organisation_id]);
            
            console.log(`✅ Found ${result.rows.length} team lists`);
            
            res.json({
                return_code: 'SUCCESS',
                team_lists: result.rows
            });

        } finally {
            client.release();
        }

    } catch (error) {
        console.error('❌ Error getting team lists:', error);
        res.json({
            return_code: 'SERVER_ERROR',
            message: 'Failed to retrieve team lists'
        });
    }
});

// Create competition
router.post('/create', async (req, res) => {
    try {
        console.log('🏆 Creating new competition');
        
        const { 
            organisation_id, 
            name, 
            description,
            logo_url,
            team_list_id, 
            lives_per_player = 1,
            no_team_twice = true,
            lock_hours_before_kickoff = 1,
            timezone = 'Europe/London',
            join_as_player = false
        } = req.body;

        // Input validation
        if (!organisation_id || !name || name.trim().length === 0) {
            return res.json({
                return_code: 'VALIDATION_ERROR',
                message: 'Organisation ID and competition name are required'
            });
        }

        if (!team_list_id || isNaN(parseInt(team_list_id))) {
            return res.json({
                return_code: 'VALIDATION_ERROR',
                message: 'Valid team list ID is required'
            });
        }

        if (lives_per_player < 1 || lives_per_player > 5) {
            return res.json({
                return_code: 'VALIDATION_ERROR',
                message: 'Lives per player must be between 1 and 5'
            });
        }

        if (lock_hours_before_kickoff < 0 || lock_hours_before_kickoff > 72) {
            return res.json({
                return_code: 'VALIDATION_ERROR',
                message: 'Lock hours must be between 0 and 72'
            });
        }

        const client = await pool.connect();
        
        try {
            await client.query('BEGIN');

            // Check if organisation exists
            const orgCheck = await client.query(
                'SELECT id FROM organisation WHERE id = $1 AND is_active = true',
                [organisation_id]
            );

            if (orgCheck.rows.length === 0) {
                await client.query('ROLLBACK');
                return res.json({
                    return_code: 'ORGANISATION_NOT_FOUND',
                    message: 'Organisation not found or inactive'
                });
            }

            // Verify team list exists and is accessible
            const teamListCheck = await client.query(`
                SELECT id, name, type 
                FROM team_list 
                WHERE id = $1 
                  AND is_active = true 
                  AND (organisation_id IS NULL OR organisation_id = $2)
            `, [team_list_id, organisation_id]);

            if (teamListCheck.rows.length === 0) {
                await client.query('ROLLBACK');
                return res.json({
                    return_code: 'TEAM_LIST_NOT_FOUND',
                    message: 'Team list not found or not accessible'
                });
            }

            // Generate unique invite code
            let inviteCode;
            let codeExists = true;
            let attempts = 0;
            
            while (codeExists && attempts < 10) {
                inviteCode = generateInviteCode();
                const codeCheck = await client.query(
                    'SELECT id FROM invitation WHERE invite_code = $1',
                    [inviteCode]
                );
                codeExists = codeCheck.rows.length > 0;
                attempts++;
            }

            if (codeExists) {
                await client.query('ROLLBACK');
                return res.json({
                    return_code: 'SERVER_ERROR',
                    message: 'Failed to generate unique invite code'
                });
            }

            // Create competition
            const competitionQuery = `
                INSERT INTO competition (
                    organisation_id,
                    team_list_id,
                    name,
                    description,
                    logo_url,
                    status,
                    timezone,
                    lives_per_player,
                    no_team_twice,
                    lock_hours_before_kickoff
                ) VALUES ($1, $2, $3, $4, $5, 'setup', $6, $7, $8, $9)
                RETURNING id
            `;

            const competitionResult = await client.query(competitionQuery, [
                organisation_id,
                team_list_id,
                name.trim(),
                description ? description.trim() : null,
                logo_url || null,
                timezone,
                lives_per_player,
                no_team_twice,
                lock_hours_before_kickoff
            ]);

            const competitionId = competitionResult.rows[0].id;

            // Create invitation with the generated code
            await client.query(`
                INSERT INTO invitation (
                    competition_id,
                    created_by_user_id,
                    invite_code,
                    max_uses,
                    expires_at
                ) VALUES ($1, $2, $3, 0, NULL)
            `, [competitionId, req.user.id, inviteCode]);

            // Add creator as organizer (and optionally as player)
            const userRole = join_as_player ? 'organizer,player' : 'organizer';
            await client.query(`
                INSERT INTO competition_user (
                    competition_id,
                    user_id,
                    role,
                    status,
                    lives_remaining
                ) VALUES ($1, $2, $3, 'active', $4)
            `, [competitionId, req.user.id, userRole, lives_per_player]);

            if (join_as_player) {
                console.log(`✅ Creator added as organizer and player`);
            } else {
                console.log(`✅ Creator added as organizer only`);
            }

            await client.query('COMMIT');

            console.log(`✅ Competition created: ID=${competitionId}, Code=${inviteCode}`);

            res.json({
                return_code: 'SUCCESS',
                competition_id: competitionId,
                invite_code: inviteCode,
                message: 'Competition created successfully'
            });

        } catch (dbError) {
            await client.query('ROLLBACK');
            throw dbError;
        } finally {
            client.release();
        }

    } catch (error) {
        console.error('❌ Error creating competition:', error);
        res.json({
            return_code: 'SERVER_ERROR',
            message: 'Failed to create competition'
        });
    }
});

// Get competition
router.post('/get', async (req, res) => {
    try {
        console.log('🔍 Getting competition details');
        
        const { competition_id } = req.body;

        // Validation
        if (!competition_id) {
            console.log('❌ Validation failed: missing competition_id');
            return res.status(400).json({
                return_code: 'VALIDATION_ERROR',
                message: 'Missing required field: competition_id'
            });
        }

        const client = await pool.connect();
        
        try {
            const query = `
                SELECT c.id, c.name, c.description, c.organisation_id, c.team_list_id, 
                       c.status, c.lives_per_player, c.no_team_twice, c.lock_hours_before_kickoff,
                       c.created_at, c.timezone,
                       o.name as organisation_name,
                       tl.name as team_list_name,
                       COUNT(cu.user_id) as player_count
                FROM competition c
                JOIN organisation o ON c.organisation_id = o.id
                JOIN team_list tl ON c.team_list_id = tl.id
                LEFT JOIN competition_user cu ON c.id = cu.competition_id
                WHERE c.id = $1
                GROUP BY c.id, c.name, c.description, c.organisation_id, c.team_list_id,
                         c.status, c.lives_per_player, c.no_team_twice, c.lock_hours_before_kickoff,
                         c.created_at, c.timezone, o.name, tl.name
            `;
            
            const result = await client.query(query, [competition_id]);

            if (result.rows.length === 0) {
                console.log('❌ Competition not found');
                return res.status(404).json({
                    return_code: 'COMPETITION_NOT_FOUND',
                    message: 'Competition not found'
                });
            }

            const comp = result.rows[0];
            console.log(`✅ Competition found: ${comp.name}`);

            res.json({
                return_code: 'SUCCESS',
                competition_id: comp.id,
                name: comp.name,
                description: comp.description,
                organisation_id: comp.organisation_id,
                organisation_name: comp.organisation_name,
                team_list_id: comp.team_list_id,
                team_list_name: comp.team_list_name,
                status: comp.status,
                lives_per_player: comp.lives_per_player,
                no_team_twice: comp.no_team_twice,
                lock_hours_before_kickoff: comp.lock_hours_before_kickoff,
                timezone: comp.timezone,
                created_at: comp.created_at,
                player_count: parseInt(comp.player_count)
            });

        } finally {
            client.release();
        }

    } catch (error) {
        console.error('❌ Get competition failed:', error.message);
        res.status(500).json({
            return_code: 'DATABASE_ERROR',
            message: 'Failed to get competition',
            error: error.message
        });
    }
});

module.exports = router;