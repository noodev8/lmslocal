/*
=======================================================================================================================================
API Route: /competition/create
=======================================================================================================================================
Method: POST
Purpose: Create a new competition within an organisation
=======================================================================================================================================
Request Payload:
{
  "organisation_id": 123,               // number, required - organisation ID
  "team_list_id": 1,                    // number, required - team list ID (EPL, custom, etc.)
  "name": "Red Lion LMS 2025",          // string, required - competition name
  "description": "Weekly LMS game",     // string, optional - competition description
  "lives_per_player": 1,                // number, optional - default 1
  "no_team_twice": true,                // boolean, optional - default true
  "lock_hours_before_kickoff": 1        // number, optional - default 1
}

Success Response:
{
  "return_code": "SUCCESS",
  "competition_id": 456,                // number, unique competition ID
  "name": "Red Lion LMS 2025",          // string, competition name
  "organisation_id": 123,               // number, organisation ID
  "team_list_id": 1,                    // number, team list ID
  "status": "setup",                    // string, competition status
  "lives_per_player": 1,                // number, lives per player
  "no_team_twice": true,                // boolean, no team twice rule
  "lock_hours_before_kickoff": 1        // number, lock timing
}
=======================================================================================================================================
Return Codes:
"SUCCESS"
"VALIDATION_ERROR"
"ORGANISATION_NOT_FOUND"
"TEAM_LIST_NOT_FOUND"
"DATABASE_ERROR"
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
const router = express.Router();

// Create competition
router.post('/create', async (req, res) => {
    try {
        console.log('🏆 Creating new competition');
        
        const { 
            organisation_id, 
            team_list_id, 
            name, 
            description = null,
            lives_per_player = 1,
            no_team_twice = true,
            lock_hours_before_kickoff = 1
        } = req.body;

        // Validation
        if (!organisation_id || !team_list_id || !name) {
            console.log('❌ Validation failed: missing required fields');
            return res.status(400).json({
                return_code: 'VALIDATION_ERROR',
                message: 'Missing required fields: organisation_id, team_list_id, name'
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
                console.log('❌ Organisation not found');
                return res.status(404).json({
                    return_code: 'ORGANISATION_NOT_FOUND',
                    message: 'Organisation not found or inactive'
                });
            }

            // Check if team list exists
            const teamListCheck = await client.query(
                'SELECT id FROM team_list WHERE id = $1 AND is_active = true',
                [team_list_id]
            );

            if (teamListCheck.rows.length === 0) {
                await client.query('ROLLBACK');
                console.log('❌ Team list not found');
                return res.status(404).json({
                    return_code: 'TEAM_LIST_NOT_FOUND',
                    message: 'Team list not found or inactive'
                });
            }

            // Create competition
            const result = await client.query(`
                INSERT INTO competition (
                    organisation_id, team_list_id, name, description, status,
                    lives_per_player, no_team_twice, lock_hours_before_kickoff
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                RETURNING id, name, organisation_id, team_list_id, status,
                          lives_per_player, no_team_twice, lock_hours_before_kickoff
            `, [
                organisation_id, team_list_id, name, description, 'setup',
                lives_per_player, no_team_twice, lock_hours_before_kickoff
            ]);

            const competition = result.rows[0];

            await client.query('COMMIT');
            console.log(`✅ Competition created successfully with ID: ${competition.id}`);

            res.json({
                return_code: 'SUCCESS',
                competition_id: competition.id,
                name: competition.name,
                organisation_id: competition.organisation_id,
                team_list_id: competition.team_list_id,
                status: competition.status,
                lives_per_player: competition.lives_per_player,
                no_team_twice: competition.no_team_twice,
                lock_hours_before_kickoff: competition.lock_hours_before_kickoff
            });

        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }

    } catch (error) {
        console.error('❌ Competition creation failed:', error.message);
        res.status(500).json({
            return_code: 'DATABASE_ERROR',
            message: 'Failed to create competition',
            error: error.message
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