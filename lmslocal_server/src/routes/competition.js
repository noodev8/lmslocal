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

// Get competition by invite code (for join flow)
router.post('/get-by-invite-code', async (req, res) => {
    try {
        console.log('🔍 Getting competition by invite code');
        
        const { invite_code } = req.body;

        // Validation
        if (!invite_code || invite_code.trim().length === 0) {
            return res.json({
                return_code: 'VALIDATION_ERROR',
                message: 'Invite code is required'
            });
        }

        const client = await pool.connect();
        
        try {
            // Find competition by invite code
            const query = `
                SELECT c.id as competition_id, c.name, c.description, c.organisation_id, c.team_list_id, 
                       c.status, c.lives_per_player, c.no_team_twice, c.lock_hours_before_kickoff,
                       c.created_at, c.timezone, c.logo_url,
                       o.name as organisation_name,
                       tl.name as team_list_name,
                       COUNT(cu.user_id) as player_count,
                       i.invite_code,
                       i.max_uses,
                       i.current_uses,
                       i.expires_at
                FROM invitation i
                JOIN competition c ON i.competition_id = c.id
                JOIN organisation o ON c.organisation_id = o.id
                JOIN team_list tl ON c.team_list_id = tl.id
                LEFT JOIN competition_user cu ON c.id = cu.competition_id AND cu.role LIKE '%player%'
                WHERE i.invite_code = $1 
                  AND (i.expires_at IS NULL OR i.expires_at > CURRENT_TIMESTAMP)
                  AND (i.max_uses = 0 OR i.current_uses < i.max_uses)
                GROUP BY c.id, c.name, c.description, c.organisation_id, c.team_list_id,
                         c.status, c.lives_per_player, c.no_team_twice, c.lock_hours_before_kickoff,
                         c.created_at, c.timezone, c.logo_url, o.name, tl.name, i.invite_code,
                         i.max_uses, i.current_uses, i.expires_at
            `;
            
            const result = await client.query(query, [invite_code.trim().toUpperCase()]);

            if (result.rows.length === 0) {
                return res.json({
                    return_code: 'INVITE_CODE_NOT_FOUND',
                    message: 'Invalid or expired invite code'
                });
            }

            const comp = result.rows[0];
            
            // Check if competition is still accepting players
            if (comp.status === 'completed') {
                return res.json({
                    return_code: 'COMPETITION_COMPLETED',
                    message: 'This competition has already finished'
                });
            }

            console.log(`✅ Competition found by invite code: ${comp.name}`);

            res.json({
                return_code: 'SUCCESS',
                competition_id: comp.competition_id,
                name: comp.name,
                description: comp.description,
                logo_url: comp.logo_url,
                organisation_name: comp.organisation_name,
                team_list_name: comp.team_list_name,
                status: comp.status,
                lives_per_player: comp.lives_per_player,
                no_team_twice: comp.no_team_twice,
                lock_hours_before_kickoff: comp.lock_hours_before_kickoff,
                timezone: comp.timezone,
                player_count: parseInt(comp.player_count),
                created_at: comp.created_at
            });

        } finally {
            client.release();
        }

    } catch (error) {
        console.error('❌ Get competition by invite code failed:', error);
        res.json({
            return_code: 'SERVER_ERROR',
            message: 'Failed to lookup competition'
        });
    }
});

// Join competition using invite code
router.post('/join', async (req, res) => {
    try {
        console.log('🎮 User joining competition');
        
        const { invite_code, competition_id } = req.body;
        const userId = req.user.id;

        // Validation
        if (!invite_code || !competition_id) {
            return res.json({
                return_code: 'VALIDATION_ERROR',
                message: 'Invite code and competition ID are required'
            });
        }

        const client = await pool.connect();
        
        try {
            await client.query('BEGIN');

            // Verify invite code is still valid
            const inviteCheck = await client.query(`
                SELECT i.id, i.competition_id, i.max_uses, i.current_uses, i.expires_at,
                       c.status, c.lives_per_player
                FROM invitation i
                JOIN competition c ON i.competition_id = c.id
                WHERE i.invite_code = $1 
                  AND i.competition_id = $2
                  AND (i.expires_at IS NULL OR i.expires_at > CURRENT_TIMESTAMP)
                  AND (i.max_uses = 0 OR i.current_uses < i.max_uses)
            `, [invite_code.trim().toUpperCase(), competition_id]);

            if (inviteCheck.rows.length === 0) {
                await client.query('ROLLBACK');
                return res.json({
                    return_code: 'INVITE_CODE_INVALID',
                    message: 'Invalid or expired invite code'
                });
            }

            const invitation = inviteCheck.rows[0];

            // Check if competition is still accepting players
            if (invitation.status === 'completed') {
                await client.query('ROLLBACK');
                return res.json({
                    return_code: 'COMPETITION_COMPLETED',
                    message: 'This competition has already finished'
                });
            }

            // Check if user is already in this competition
            const existingMember = await client.query(`
                SELECT id, role, status 
                FROM competition_user 
                WHERE competition_id = $1 AND user_id = $2
            `, [competition_id, userId]);

            if (existingMember.rows.length > 0) {
                await client.query('ROLLBACK');
                const member = existingMember.rows[0];
                return res.json({
                    return_code: 'ALREADY_MEMBER',
                    message: `You are already a ${member.role} in this competition`
                });
            }

            // Add user as player
            await client.query(`
                INSERT INTO competition_user (
                    competition_id,
                    user_id,
                    role,
                    status,
                    lives_remaining
                ) VALUES ($1, $2, 'player', 'active', $3)
            `, [competition_id, userId, invitation.lives_per_player]);

            // Update invite usage count if it has a limit
            if (invitation.max_uses > 0) {
                await client.query(`
                    UPDATE invitation 
                    SET current_uses = current_uses + 1 
                    WHERE id = $1
                `, [invitation.id]);
            }

            await client.query('COMMIT');
            console.log(`✅ User ${userId} successfully joined competition ${competition_id}`);

            res.json({
                return_code: 'SUCCESS',
                message: 'Successfully joined competition',
                competition_id: competition_id,
                role: 'player',
                lives_remaining: invitation.lives_per_player
            });

        } catch (dbError) {
            await client.query('ROLLBACK');
            throw dbError;
        } finally {
            client.release();
        }

    } catch (error) {
        console.error('❌ Join competition failed:', error);
        res.json({
            return_code: 'SERVER_ERROR',
            message: 'Failed to join competition'
        });
    }
});

// Get user's competitions (for player dashboard)
router.post('/user-competitions', async (req, res) => {
    try {
        console.log('📋 Getting user competitions');
        
        const userId = req.user.id;

        const client = await pool.connect();
        
        try {
            // Get all competitions where user is a member
            const query = `
                SELECT 
                    c.id as competition_id,
                    c.name,
                    c.description,
                    c.logo_url,
                    c.status,
                    c.lives_per_player,
                    c.no_team_twice,
                    c.timezone,
                    c.created_at,
                    o.name as organisation_name,
                    tl.name as team_list_name,
                    cu.role,
                    cu.status as player_status,
                    cu.lives_remaining,
                    cu.joined_at,
                    -- Get current round info (if any)
                    r.round_number as current_round,
                    r.status as round_status,
                    r.lock_time as round_lock_time
                FROM competition_user cu
                JOIN competition c ON cu.competition_id = c.id
                JOIN organisation o ON c.organisation_id = o.id
                JOIN team_list tl ON c.team_list_id = tl.id
                LEFT JOIN round r ON c.id = r.competition_id 
                    AND r.status IN ('open', 'locked')
                    AND r.round_number = (
                        SELECT MAX(round_number) 
                        FROM round r2 
                        WHERE r2.competition_id = c.id
                    )
                WHERE cu.user_id = $1
                    AND cu.role LIKE '%player%'
                ORDER BY c.created_at DESC
            `;
            
            const result = await client.query(query, [userId]);
            
            console.log(`✅ Found ${result.rows.length} competitions for user ${userId}`);
            
            res.json({
                return_code: 'SUCCESS',
                competitions: result.rows.map(comp => ({
                    competition_id: comp.competition_id,
                    name: comp.name,
                    description: comp.description,
                    logo_url: comp.logo_url,
                    status: comp.status,
                    lives_per_player: comp.lives_per_player,
                    no_team_twice: comp.no_team_twice,
                    timezone: comp.timezone,
                    organisation_name: comp.organisation_name,
                    team_list_name: comp.team_list_name,
                    role: comp.role,
                    player_status: comp.player_status,
                    lives_remaining: comp.lives_remaining,
                    joined_at: comp.joined_at,
                    current_round: comp.current_round,
                    round_status: comp.round_status,
                    round_lock_time: comp.round_lock_time
                }))
            });

        } finally {
            client.release();
        }

    } catch (error) {
        console.error('❌ Get user competitions failed:', error);
        res.json({
            return_code: 'SERVER_ERROR',
            message: 'Failed to load competitions'
        });
    }
});

// Get organizer's competitions (for organizer dashboard)
router.post('/organizer-competitions', async (req, res) => {
    try {
        console.log('🏆 Getting organizer competitions');
        
        const userId = req.user.id;

        const client = await pool.connect();
        
        try {
            // Get all competitions where user is an organizer
            const query = `
                SELECT 
                    c.id as competition_id,
                    c.name,
                    c.description,
                    c.logo_url,
                    c.status,
                    c.lives_per_player,
                    c.no_team_twice,
                    c.timezone,
                    c.created_at,
                    o.name as organisation_name,
                    tl.name as team_list_name,
                    cu.role,
                    cu.joined_at,
                    i.invite_code,
                    -- Count total players (including organizer if they're also a player)
                    COUNT(DISTINCT cu_players.user_id) as player_count,
                    -- Get current round info (if any)
                    r.round_number as current_round,
                    r.status as round_status,
                    r.lock_time as round_lock_time
                FROM competition_user cu
                JOIN competition c ON cu.competition_id = c.id
                JOIN organisation o ON c.organisation_id = o.id
                JOIN team_list tl ON c.team_list_id = tl.id
                LEFT JOIN invitation i ON c.id = i.competition_id
                LEFT JOIN competition_user cu_players ON c.id = cu_players.competition_id 
                    AND cu_players.role LIKE '%player%'
                LEFT JOIN round r ON c.id = r.competition_id 
                    AND r.status IN ('open', 'locked')
                    AND r.round_number = (
                        SELECT MAX(round_number) 
                        FROM round r2 
                        WHERE r2.competition_id = c.id
                    )
                WHERE cu.user_id = $1
                    AND cu.role LIKE '%organizer%'
                GROUP BY c.id, c.name, c.description, c.logo_url, c.status, c.lives_per_player,
                         c.no_team_twice, c.timezone, c.created_at, o.name, tl.name, cu.role,
                         cu.joined_at, i.invite_code, r.round_number, r.status, r.lock_time
                ORDER BY c.created_at DESC
            `;
            
            const result = await client.query(query, [userId]);
            
            console.log(`✅ Found ${result.rows.length} competitions for organizer ${userId}`);
            
            res.json({
                return_code: 'SUCCESS',
                competitions: result.rows.map(comp => ({
                    competition_id: comp.competition_id,
                    name: comp.name,
                    description: comp.description,
                    logo_url: comp.logo_url,
                    status: comp.status,
                    lives_per_player: comp.lives_per_player,
                    no_team_twice: comp.no_team_twice,
                    timezone: comp.timezone,
                    organisation_name: comp.organisation_name,
                    team_list_name: comp.team_list_name,
                    role: comp.role,
                    joined_at: comp.joined_at,
                    invite_code: comp.invite_code,
                    player_count: parseInt(comp.player_count) || 0,
                    current_round: comp.current_round,
                    round_status: comp.round_status,
                    round_lock_time: comp.round_lock_time
                }))
            });

        } finally {
            client.release();
        }

    } catch (error) {
        console.error('❌ Get organizer competitions failed:', error);
        res.json({
            return_code: 'SERVER_ERROR',
            message: 'Failed to load competitions'
        });
    }
});

// Start competition (change status from setup to active)
router.post('/start', async (req, res) => {
    try {
        console.log('🚀 Starting competition');
        
        const { competition_id } = req.body;
        const userId = req.user.id;

        // Validation
        if (!competition_id) {
            return res.json({
                return_code: 'VALIDATION_ERROR',
                message: 'Competition ID is required'
            });
        }

        const client = await pool.connect();
        
        try {
            await client.query('BEGIN');

            // Verify user is organizer of this competition
            const organizerCheck = await client.query(`
                SELECT cu.role, c.status, c.name
                FROM competition_user cu
                JOIN competition c ON cu.competition_id = c.id
                WHERE cu.competition_id = $1 
                  AND cu.user_id = $2 
                  AND cu.role LIKE '%organizer%'
            `, [competition_id, userId]);

            if (organizerCheck.rows.length === 0) {
                await client.query('ROLLBACK');
                return res.json({
                    return_code: 'UNAUTHORISED',
                    message: 'You are not an organizer of this competition'
                });
            }

            const competition = organizerCheck.rows[0];

            // Check if competition is in setup status
            if (competition.status !== 'setup') {
                await client.query('ROLLBACK');
                return res.json({
                    return_code: 'INVALID_STATUS',
                    message: `Competition is already ${competition.status}. Only competitions in setup can be started.`
                });
            }

            // Update competition status to active
            await client.query(`
                UPDATE competition 
                SET status = 'active', updated_at = CURRENT_TIMESTAMP
                WHERE id = $1
            `, [competition_id]);

            await client.query('COMMIT');
            
            console.log(`✅ Competition ${competition_id} (${competition.name}) started successfully`);

            res.json({
                return_code: 'SUCCESS',
                message: `${competition.name} has been started and is now active!`,
                competition_id: competition_id,
                new_status: 'active'
            });

        } catch (dbError) {
            await client.query('ROLLBACK');
            throw dbError;
        } finally {
            client.release();
        }

    } catch (error) {
        console.error('❌ Start competition failed:', error);
        res.json({
            return_code: 'SERVER_ERROR',
            message: 'Failed to start competition'
        });
    }
});

// Create round with fixtures
router.post('/create-round', async (req, res) => {
    try {
        console.log('🏗️ Creating round with fixtures');
        
        const { competition_id, round_number, name, fixtures } = req.body;
        const userId = req.user.id;

        // Validation
        if (!competition_id || !round_number || !name || !fixtures || !Array.isArray(fixtures)) {
            return res.json({
                return_code: 'VALIDATION_ERROR',
                message: 'Missing required fields: competition_id, round_number, name, fixtures'
            });
        }

        if (fixtures.length === 0) {
            return res.json({
                return_code: 'VALIDATION_ERROR',
                message: 'At least one fixture is required'
            });
        }

        const client = await pool.connect();
        
        try {
            await client.query('BEGIN');

            // Verify user is organizer of this competition
            const organizerCheck = await client.query(`
                SELECT cu.role, c.status, c.name, c.timezone
                FROM competition_user cu
                JOIN competition c ON cu.competition_id = c.id
                WHERE cu.competition_id = $1 
                  AND cu.user_id = $2 
                  AND cu.role LIKE '%organizer%'
            `, [competition_id, userId]);

            if (organizerCheck.rows.length === 0) {
                await client.query('ROLLBACK');
                return res.json({
                    return_code: 'UNAUTHORISED',
                    message: 'You are not an organizer of this competition'
                });
            }

            const competition = organizerCheck.rows[0];

            // Check if round number already exists
            const existingRound = await client.query(`
                SELECT id FROM round 
                WHERE competition_id = $1 AND round_number = $2
            `, [competition_id, round_number]);

            if (existingRound.rows.length > 0) {
                await client.query('ROLLBACK');
                return res.json({
                    return_code: 'VALIDATION_ERROR',
                    message: `Round ${round_number} already exists for this competition`
                });
            }

            // Validate fixtures
            const fixtureValidation = validateFixtures(fixtures);
            if (!fixtureValidation.valid) {
                await client.query('ROLLBACK');
                return res.json({
                    return_code: 'VALIDATION_ERROR',
                    message: fixtureValidation.error
                });
            }

            // Calculate lock time (1 hour before earliest kickoff)
            const earliestKickoff = new Date(Math.min(...fixtures.map(f => new Date(f.kickoff_time))));
            const lockTime = new Date(earliestKickoff.getTime() - (60 * 60 * 1000)); // 1 hour before

            console.log(`📅 Earliest kickoff: ${earliestKickoff.toISOString()}`);
            console.log(`🔒 Lock time: ${lockTime.toISOString()}`);

            // Create round
            const roundResult = await client.query(`
                INSERT INTO round (
                    competition_id,
                    round_number,
                    name,
                    status,
                    lock_time,
                    created_at
                ) VALUES ($1, $2, $3, 'open', $4, CURRENT_TIMESTAMP)
                RETURNING id
            `, [competition_id, round_number, name.trim(), lockTime]);

            const roundId = roundResult.rows[0].id;

            // Create fixtures
            for (const fixture of fixtures) {
                await client.query(`
                    INSERT INTO fixture (
                        round_id,
                        home_team_id,
                        away_team_id,
                        kickoff_time,
                        created_at
                    ) VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
                `, [
                    roundId,
                    parseInt(fixture.home_team_id),
                    parseInt(fixture.away_team_id),
                    fixture.kickoff_time
                ]);
            }

            await client.query('COMMIT');
            
            console.log(`✅ Round ${round_number} created with ${fixtures.length} fixtures`);

            res.json({
                return_code: 'SUCCESS',
                message: `Round ${round_number} created successfully with ${fixtures.length} fixtures`,
                round_id: roundId,
                round_number: round_number,
                lock_time: lockTime.toISOString(),
                fixture_count: fixtures.length
            });

        } catch (dbError) {
            await client.query('ROLLBACK');
            throw dbError;
        } finally {
            client.release();
        }

    } catch (error) {
        console.error('❌ Create round failed:', error);
        res.json({
            return_code: 'SERVER_ERROR',
            message: 'Failed to create round'
        });
    }
});

// Validate fixtures helper function
function validateFixtures(fixtures) {
    const teamPairings = new Set();
    
    for (let i = 0; i < fixtures.length; i++) {
        const fixture = fixtures[i];
        
        // Check required fields
        if (!fixture.home_team_id || !fixture.away_team_id || !fixture.kickoff_time) {
            return {
                valid: false,
                error: `Fixture ${i + 1}: Missing required fields (home team, away team, or kickoff time)`
            };
        }

        // Check teams are different
        if (fixture.home_team_id === fixture.away_team_id) {
            return {
                valid: false,
                error: `Fixture ${i + 1}: Home and away teams must be different`
            };
        }

        // Check for duplicate pairings (same teams playing twice in the round)
        const pairing1 = `${fixture.home_team_id}-${fixture.away_team_id}`;
        const pairing2 = `${fixture.away_team_id}-${fixture.home_team_id}`;
        
        if (teamPairings.has(pairing1) || teamPairings.has(pairing2)) {
            return {
                valid: false,
                error: `Fixture ${i + 1}: These teams are already playing each other in this round`
            };
        }
        
        teamPairings.add(pairing1);

        // Validate kickoff time format
        if (isNaN(new Date(fixture.kickoff_time))) {
            return {
                valid: false,
                error: `Fixture ${i + 1}: Invalid kickoff time format`
            };
        }
    }

    return { valid: true };
}

// Get teams for a competition (for fixture creation)
router.post('/teams', async (req, res) => {
    try {
        console.log('⚽ Getting teams for competition');
        
        const { competition_id } = req.body;
        const userId = req.user.id;

        // Validation
        if (!competition_id) {
            return res.json({
                return_code: 'VALIDATION_ERROR',
                message: 'Competition ID is required'
            });
        }

        const client = await pool.connect();
        
        try {
            // Verify user has access to this competition
            const accessCheck = await client.query(`
                SELECT c.team_list_id
                FROM competition_user cu
                JOIN competition c ON cu.competition_id = c.id
                WHERE cu.competition_id = $1 AND cu.user_id = $2
            `, [competition_id, userId]);

            if (accessCheck.rows.length === 0) {
                return res.json({
                    return_code: 'UNAUTHORISED',
                    message: 'You do not have access to this competition'
                });
            }

            const teamListId = accessCheck.rows[0].team_list_id;

            // Get teams from the competition's team list
            const teamsResult = await client.query(`
                SELECT id, name, short_name, sort_order
                FROM team
                WHERE team_list_id = $1 AND is_active = true
                ORDER BY sort_order, name
            `, [teamListId]);

            console.log(`✅ Found ${teamsResult.rows.length} teams`);

            res.json({
                return_code: 'SUCCESS',
                teams: teamsResult.rows
            });

        } finally {
            client.release();
        }

    } catch (error) {
        console.error('❌ Get teams failed:', error);
        res.json({
            return_code: 'SERVER_ERROR',
            message: 'Failed to get teams'
        });
    }
});

// Get rounds and fixtures for a competition
router.post('/rounds', async (req, res) => {
    try {
        console.log('📅 Getting rounds and fixtures for competition');
        
        const { competition_id } = req.body;
        const userId = req.user.id;

        // Validation
        if (!competition_id) {
            return res.json({
                return_code: 'VALIDATION_ERROR',
                message: 'Competition ID is required'
            });
        }

        const client = await pool.connect();
        
        try {
            // Verify user has access to this competition
            const accessCheck = await client.query(`
                SELECT cu.role
                FROM competition_user cu
                WHERE cu.competition_id = $1 AND cu.user_id = $2
            `, [competition_id, userId]);

            if (accessCheck.rows.length === 0) {
                return res.json({
                    return_code: 'UNAUTHORISED',
                    message: 'You do not have access to this competition'
                });
            }

            // Get all rounds for this competition
            const roundsResult = await client.query(`
                SELECT 
                    r.id,
                    r.round_number,
                    r.name,
                    r.status,
                    r.lock_time,
                    r.created_at,
                    COUNT(f.id) as fixture_count
                FROM round r
                LEFT JOIN fixture f ON r.id = f.round_id
                WHERE r.competition_id = $1
                GROUP BY r.id, r.round_number, r.name, r.status, r.lock_time, r.created_at
                ORDER BY r.round_number
            `, [competition_id]);

            const rounds = [];

            // For each round, get its fixtures with team details
            for (const round of roundsResult.rows) {
                const fixturesResult = await client.query(`
                    SELECT 
                        f.id,
                        f.home_team_id,
                        f.away_team_id,
                        f.kickoff_time,
                        f.home_score,
                        f.away_score,
                        f.created_at,
                        ht.name as home_team_name,
                        ht.short_name as home_team_short,
                        at.name as away_team_name,
                        at.short_name as away_team_short
                    FROM fixture f
                    JOIN team ht ON f.home_team_id = ht.id
                    JOIN team at ON f.away_team_id = at.id
                    WHERE f.round_id = $1
                    ORDER BY f.kickoff_time
                `, [round.id]);

                rounds.push({
                    id: round.id,
                    round_number: round.round_number,
                    name: round.name,
                    status: round.status,
                    lock_time: round.lock_time,
                    created_at: round.created_at,
                    fixture_count: parseInt(round.fixture_count),
                    fixtures: fixturesResult.rows.map(fixture => ({
                        id: fixture.id,
                        home_team: {
                            id: fixture.home_team_id,
                            name: fixture.home_team_name,
                            short_name: fixture.home_team_short
                        },
                        away_team: {
                            id: fixture.away_team_id,
                            name: fixture.away_team_name,
                            short_name: fixture.away_team_short
                        },
                        kickoff_time: fixture.kickoff_time,
                        status: 'scheduled', // Default status since column doesn't exist yet
                        home_score: fixture.home_score,
                        away_score: fixture.away_score,
                        created_at: fixture.created_at
                    }))
                });
            }

            console.log(`✅ Found ${rounds.length} rounds with fixtures`);

            res.json({
                return_code: 'SUCCESS',
                rounds: rounds
            });

        } finally {
            client.release();
        }

    } catch (error) {
        console.error('❌ Get rounds failed:', error);
        res.json({
            return_code: 'SERVER_ERROR',
            message: 'Failed to get rounds'
        });
    }
});

// Update fixture
router.post('/update-fixture', async (req, res) => {
    try {
        console.log('✏️ Updating fixture');
        
        const { fixture_id, home_team_id, away_team_id, kickoff_time } = req.body;
        const userId = req.user.id;

        // Validation
        if (!fixture_id || !home_team_id || !away_team_id || !kickoff_time) {
            return res.json({
                return_code: 'VALIDATION_ERROR',
                message: 'Missing required fields: fixture_id, home_team_id, away_team_id, kickoff_time'
            });
        }

        if (home_team_id === away_team_id) {
            return res.json({
                return_code: 'VALIDATION_ERROR',
                message: 'Home and away teams must be different'
            });
        }

        const client = await pool.connect();
        
        try {
            await client.query('BEGIN');

            // Verify user is organizer of the competition containing this fixture
            const authCheck = await client.query(`
                SELECT c.id as competition_id, c.name, r.round_number, r.status as round_status
                FROM fixture f
                JOIN round r ON f.round_id = r.id
                JOIN competition c ON r.competition_id = c.id
                JOIN competition_user cu ON c.id = cu.competition_id
                WHERE f.id = $1 
                  AND cu.user_id = $2 
                  AND cu.role LIKE '%organizer%'
            `, [fixture_id, userId]);

            if (authCheck.rows.length === 0) {
                await client.query('ROLLBACK');
                return res.json({
                    return_code: 'UNAUTHORISED',
                    message: 'You are not authorized to edit this fixture'
                });
            }

            const competitionInfo = authCheck.rows[0];

            // Check if round is still editable
            if (competitionInfo.round_status === 'locked' || competitionInfo.round_status === 'completed') {
                await client.query('ROLLBACK');
                return res.json({
                    return_code: 'ROUND_LOCKED',
                    message: `Round ${competitionInfo.round_number} is ${competitionInfo.round_status} and cannot be edited`
                });
            }

            // Check for duplicate team pairing in the same round
            const duplicateCheck = await client.query(`
                SELECT f.id
                FROM fixture f
                JOIN round r ON f.round_id = r.id
                WHERE r.id = (SELECT round_id FROM fixture WHERE id = $1)
                  AND f.id != $1
                  AND ((f.home_team_id = $2 AND f.away_team_id = $3) OR 
                       (f.home_team_id = $3 AND f.away_team_id = $2))
            `, [fixture_id, parseInt(home_team_id), parseInt(away_team_id)]);

            if (duplicateCheck.rows.length > 0) {
                await client.query('ROLLBACK');
                return res.json({
                    return_code: 'VALIDATION_ERROR',
                    message: 'These teams are already playing each other in this round'
                });
            }

            // Update the fixture
            await client.query(`
                UPDATE fixture 
                SET home_team_id = $2,
                    away_team_id = $3,
                    kickoff_time = $4,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = $1
            `, [fixture_id, parseInt(home_team_id), parseInt(away_team_id), kickoff_time]);

            // Recalculate round lock time (1 hour before earliest fixture)
            const roundId = await client.query(`
                SELECT round_id FROM fixture WHERE id = $1
            `, [fixture_id]);

            const earliestKickoff = await client.query(`
                SELECT MIN(kickoff_time) as earliest_kickoff
                FROM fixture
                WHERE round_id = $1
            `, [roundId.rows[0].round_id]);

            if (earliestKickoff.rows[0].earliest_kickoff) {
                const lockTime = new Date(earliestKickoff.rows[0].earliest_kickoff.getTime() - (60 * 60 * 1000));
                
                await client.query(`
                    UPDATE round 
                    SET lock_time = $2,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = $1
                `, [roundId.rows[0].round_id, lockTime]);

                console.log(`🔒 Updated lock time for round to: ${lockTime.toISOString()}`);
            }

            await client.query('COMMIT');
            
            console.log(`✅ Fixture ${fixture_id} updated successfully`);

            res.json({
                return_code: 'SUCCESS',
                message: 'Fixture updated successfully',
                fixture_id: fixture_id
            });

        } catch (dbError) {
            await client.query('ROLLBACK');
            throw dbError;
        } finally {
            client.release();
        }

    } catch (error) {
        console.error('❌ Update fixture failed:', error);
        res.json({
            return_code: 'SERVER_ERROR',
            message: 'Failed to update fixture'
        });
    }
});

// Submit player pick
router.post('/submit-pick', async (req, res) => {
    try {
        console.log('🎯 Player submitting pick');
        
        const { competition_id, round_id, team_id } = req.body;
        const userId = req.user.id;

        // Validation
        if (!competition_id || !round_id || !team_id) {
            return res.json({
                return_code: 'VALIDATION_ERROR',
                message: 'Missing required fields: competition_id, round_id, team_id'
            });
        }

        const client = await pool.connect();
        
        try {
            await client.query('BEGIN');

            // Verify user is a player in this competition
            const playerCheck = await client.query(`
                SELECT cu.role, cu.status, cu.lives_remaining, c.name as competition_name
                FROM competition_user cu
                JOIN competition c ON cu.competition_id = c.id
                WHERE cu.competition_id = $1 
                  AND cu.user_id = $2 
                  AND cu.role LIKE '%player%'
                  AND cu.status = 'active'
            `, [competition_id, userId]);

            if (playerCheck.rows.length === 0) {
                await client.query('ROLLBACK');
                return res.json({
                    return_code: 'UNAUTHORISED',
                    message: 'You are not an active player in this competition'
                });
            }

            const player = playerCheck.rows[0];

            if (player.lives_remaining <= 0) {
                await client.query('ROLLBACK');
                return res.json({
                    return_code: 'ELIMINATED',
                    message: 'You have been eliminated from this competition'
                });
            }

            // Verify round exists and is open for picks
            const roundCheck = await client.query(`
                SELECT r.id, r.name, r.status, r.lock_time, c.no_team_twice
                FROM round r
                JOIN competition c ON r.competition_id = c.id
                WHERE r.id = $1 AND r.competition_id = $2
            `, [round_id, competition_id]);

            if (roundCheck.rows.length === 0) {
                await client.query('ROLLBACK');
                return res.json({
                    return_code: 'ROUND_NOT_FOUND',
                    message: 'Round not found in this competition'
                });
            }

            const round = roundCheck.rows[0];

            if (round.status !== 'open') {
                await client.query('ROLLBACK');
                return res.json({
                    return_code: 'ROUND_LOCKED',
                    message: `Round "${round.name}" is ${round.status} and no longer accepting picks`
                });
            }

            // Check if round lock time has passed
            if (new Date() >= new Date(round.lock_time)) {
                await client.query('ROLLBACK');
                return res.json({
                    return_code: 'ROUND_LOCKED',
                    message: `Pick deadline has passed for round "${round.name}"`
                });
            }

            // Check if player already has a pick for this round
            const existingPick = await client.query(`
                SELECT id, team_id 
                FROM pick 
                WHERE round_id = $1 AND user_id = $2
            `, [round_id, userId]);

            // Verify team is valid for this competition
            const teamCheck = await client.query(`
                SELECT t.id, t.name, t.team_list_id
                FROM team t
                JOIN competition c ON t.team_list_id = c.team_list_id
                WHERE t.id = $1 AND c.id = $2 AND t.is_active = true
            `, [team_id, competition_id]);

            if (teamCheck.rows.length === 0) {
                await client.query('ROLLBACK');
                return res.json({
                    return_code: 'INVALID_TEAM',
                    message: 'Selected team is not valid for this competition'
                });
            }

            const team = teamCheck.rows[0];

            // Check "no team twice" rule if enabled
            if (round.no_team_twice) {
                const previousPick = await client.query(`
                    SELECT p.id, r.name as round_name, t.name as team_name
                    FROM pick p
                    JOIN round r ON p.round_id = r.id
                    JOIN team t ON p.team_id = t.id
                    WHERE r.competition_id = $1 
                      AND p.user_id = $2 
                      AND p.team_id = $3
                `, [competition_id, userId, team_id]);

                if (previousPick.rows.length > 0) {
                    await client.query('ROLLBACK');
                    return res.json({
                        return_code: 'TEAM_ALREADY_PICKED',
                        message: `You have already picked ${team.name} in ${previousPick.rows[0].round_name}`
                    });
                }
            }

            // Find the fixture for this team in this round
            const fixtureCheck = await client.query(`
                SELECT id 
                FROM fixture 
                WHERE round_id = $1 AND (home_team_id = $2 OR away_team_id = $2)
            `, [round_id, team_id]);

            if (fixtureCheck.rows.length === 0) {
                await client.query('ROLLBACK');
                return res.json({
                    return_code: 'TEAM_NOT_PLAYING',
                    message: `${team.name} is not playing in this round`
                });
            }

            const fixtureId = fixtureCheck.rows[0].id;

            if (existingPick.rows.length > 0) {
                // Update existing pick
                await client.query(`
                    UPDATE pick 
                    SET team_id = $1, 
                        fixture_id = $2,
                        entered_by_user_id = $3,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = $4
                `, [team_id, fixtureId, userId, existingPick.rows[0].id]);

                console.log(`✅ Updated pick for user ${userId}: ${team.name} in round ${round_id}`);
                
                res.json({
                    return_code: 'SUCCESS',
                    message: `Pick updated to ${team.name}`,
                    pick_id: existingPick.rows[0].id,
                    team_name: team.name,
                    round_name: round.name,
                    action: 'updated'
                });
            } else {
                // Create new pick
                const pickResult = await client.query(`
                    INSERT INTO pick (
                        round_id,
                        user_id,
                        team_id,
                        fixture_id,
                        entered_by_user_id,
                        created_at
                    ) VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
                    RETURNING id
                `, [round_id, userId, team_id, fixtureId, userId]);

                console.log(`✅ Created new pick for user ${userId}: ${team.name} in round ${round_id}`);
                
                res.json({
                    return_code: 'SUCCESS',
                    message: `Pick submitted: ${team.name}`,
                    pick_id: pickResult.rows[0].id,
                    team_name: team.name,
                    round_name: round.name,
                    action: 'created'
                });
            }

            await client.query('COMMIT');

        } catch (dbError) {
            await client.query('ROLLBACK');
            throw dbError;
        } finally {
            client.release();
        }

    } catch (error) {
        console.error('❌ Submit pick failed:', error);
        res.json({
            return_code: 'SERVER_ERROR',
            message: 'Failed to submit pick'
        });
    }
});

// Get player's picks for a competition
router.post('/user-picks', async (req, res) => {
    try {
        console.log('📝 Getting user picks');
        
        const { competition_id } = req.body;
        const userId = req.user.id;

        // Validation
        if (!competition_id) {
            return res.json({
                return_code: 'VALIDATION_ERROR',
                message: 'Competition ID is required'
            });
        }

        const client = await pool.connect();
        
        try {
            // Verify user is a player in this competition
            const playerCheck = await client.query(`
                SELECT cu.role, cu.status, cu.lives_remaining
                FROM competition_user cu
                WHERE cu.competition_id = $1 
                  AND cu.user_id = $2 
                  AND cu.role LIKE '%player%'
            `, [competition_id, userId]);

            if (playerCheck.rows.length === 0) {
                return res.json({
                    return_code: 'UNAUTHORISED',
                    message: 'You are not a player in this competition'
                });
            }

            const player = playerCheck.rows[0];

            // Get all user's picks for this competition with round and team details
            const picksResult = await client.query(`
                SELECT 
                    p.id as pick_id,
                    p.team_id,
                    p.outcome,
                    p.created_at as pick_made_at,
                    p.locked_at,
                    r.id as round_id,
                    r.round_number,
                    r.name as round_name,
                    r.status as round_status,
                    r.lock_time,
                    t.name as team_name,
                    t.short_name as team_short,
                    f.id as fixture_id,
                    f.kickoff_time,
                    f.home_score,
                    f.away_score,
                    ht.name as home_team_name,
                    ht.id as home_team_id,
                    at.name as away_team_name,
                    at.id as away_team_id
                FROM pick p
                JOIN round r ON p.round_id = r.id
                JOIN team t ON p.team_id = t.id
                JOIN fixture f ON p.fixture_id = f.id
                JOIN team ht ON f.home_team_id = ht.id
                JOIN team at ON f.away_team_id = at.id
                WHERE r.competition_id = $1 
                  AND p.user_id = $2
                ORDER BY r.round_number DESC, p.created_at DESC
            `, [competition_id, userId]);

            // Get current open round for this competition
            const currentRoundResult = await client.query(`
                SELECT 
                    r.id as round_id,
                    r.round_number,
                    r.name as round_name,
                    r.status,
                    r.lock_time,
                    COUNT(f.id) as fixture_count
                FROM round r
                LEFT JOIN fixture f ON r.id = f.round_id
                WHERE r.competition_id = $1 
                  AND r.status = 'open'
                GROUP BY r.id, r.round_number, r.name, r.status, r.lock_time
                ORDER BY r.round_number
                LIMIT 1
            `, [competition_id]);

            const picks = picksResult.rows.map(pick => ({
                pick_id: pick.pick_id,
                round: {
                    id: pick.round_id,
                    round_number: pick.round_number,
                    name: pick.round_name,
                    status: pick.round_status,
                    lock_time: pick.lock_time
                },
                team: {
                    id: pick.team_id,
                    name: pick.team_name,
                    short_name: pick.team_short
                },
                fixture: {
                    id: pick.fixture_id,
                    kickoff_time: pick.kickoff_time,
                    home_team: {
                        id: pick.home_team_id,
                        name: pick.home_team_name
                    },
                    away_team: {
                        id: pick.away_team_id,
                        name: pick.away_team_name
                    },
                    home_score: pick.home_score,
                    away_score: pick.away_score
                },
                outcome: pick.outcome,
                pick_made_at: pick.pick_made_at,
                locked_at: pick.locked_at
            }));

            const currentRound = currentRoundResult.rows.length > 0 ? {
                id: currentRoundResult.rows[0].round_id,
                round_number: currentRoundResult.rows[0].round_number,
                name: currentRoundResult.rows[0].round_name,
                status: currentRoundResult.rows[0].status,
                lock_time: currentRoundResult.rows[0].lock_time,
                fixture_count: parseInt(currentRoundResult.rows[0].fixture_count)
            } : null;

            console.log(`✅ Found ${picks.length} picks for user ${userId} in competition ${competition_id}`);

            res.json({
                return_code: 'SUCCESS',
                player_status: {
                    status: player.status,
                    lives_remaining: player.lives_remaining
                },
                picks: picks,
                current_round: currentRound,
                pick_count: picks.length
            });

        } finally {
            client.release();
        }

    } catch (error) {
        console.error('❌ Get user picks failed:', error);
        res.json({
            return_code: 'SERVER_ERROR',
            message: 'Failed to get user picks'
        });
    }
});

// Enter match result (organizer only)
router.post('/enter-result', async (req, res) => {
    try {
        console.log('⚽ Organizer entering match result');
        
        const { fixture_id, home_score, away_score } = req.body;
        const userId = req.user.id;

        // Validation
        if (!fixture_id || home_score === undefined || away_score === undefined) {
            return res.json({
                return_code: 'VALIDATION_ERROR',
                message: 'Missing required fields: fixture_id, home_score, away_score'
            });
        }

        if (!Number.isInteger(home_score) || !Number.isInteger(away_score) || home_score < 0 || away_score < 0) {
            return res.json({
                return_code: 'VALIDATION_ERROR',
                message: 'Scores must be non-negative integers'
            });
        }

        const client = await pool.connect();
        
        try {
            await client.query('BEGIN');

            // Verify user is organizer of the competition containing this fixture
            const authCheck = await client.query(`
                SELECT c.id as competition_id, c.name as competition_name, 
                       r.id as round_id, r.name as round_name, r.status as round_status,
                       f.id as fixture_id, f.kickoff_time,
                       ht.name as home_team_name, at.name as away_team_name
                FROM fixture f
                JOIN round r ON f.round_id = r.id
                JOIN competition c ON r.competition_id = c.id
                JOIN competition_user cu ON c.id = cu.competition_id
                JOIN team ht ON f.home_team_id = ht.id
                JOIN team at ON f.away_team_id = at.id
                WHERE f.id = $1 
                  AND cu.user_id = $2 
                  AND cu.role LIKE '%organizer%'
            `, [fixture_id, userId]);

            if (authCheck.rows.length === 0) {
                await client.query('ROLLBACK');
                return res.json({
                    return_code: 'UNAUTHORISED',
                    message: 'You are not authorized to enter results for this fixture'
                });
            }

            const fixtureInfo = authCheck.rows[0];

            // Update fixture with result
            await client.query(`
                UPDATE fixture 
                SET home_score = $2,
                    away_score = $3,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = $1
            `, [fixture_id, home_score, away_score]);

            console.log(`⚽ Result entered: ${fixtureInfo.home_team_name} ${home_score}-${away_score} ${fixtureInfo.away_team_name}`);

            // Process picks for this fixture - determine winners and losers
            const picksResult = await client.query(`
                SELECT p.id as pick_id, p.user_id, p.team_id, 
                       u.display_name, t.name as team_name,
                       f.home_team_id, f.away_team_id
                FROM pick p
                JOIN app_user u ON p.user_id = u.id
                JOIN team t ON p.team_id = t.id
                JOIN fixture f ON p.fixture_id = f.id
                WHERE f.id = $1
            `, [fixture_id]);

            console.log(`📊 Processing ${picksResult.rows.length} picks for this fixture`);

            let winners = 0;
            let losers = 0;

            for (const pick of picksResult.rows) {
                let outcome = 'lost';
                let pickedWinningTeam = false;

                // Determine if player picked the winning team
                if (home_score > away_score) {
                    // Home team won
                    pickedWinningTeam = (pick.team_id === pick.home_team_id);
                } else if (away_score > home_score) {
                    // Away team won  
                    pickedWinningTeam = (pick.team_id === pick.away_team_id);
                } else {
                    // Draw - all picks lose in LMS
                    pickedWinningTeam = false;
                }

                if (pickedWinningTeam) {
                    outcome = 'won';
                    winners++;
                } else {
                    outcome = 'lost';
                    losers++;
                    
                    // Player loses a life - update their competition status
                    const playerUpdate = await client.query(`
                        UPDATE competition_user 
                        SET lives_remaining = lives_remaining - 1
                        WHERE competition_id = $1 AND user_id = $2
                        RETURNING lives_remaining
                    `, [fixtureInfo.competition_id, pick.user_id]);

                    const livesRemaining = playerUpdate.rows[0].lives_remaining;
                    
                    // If no lives left, eliminate player
                    if (livesRemaining <= 0) {
                        await client.query(`
                            UPDATE competition_user 
                            SET status = 'eliminated'
                            WHERE competition_id = $1 AND user_id = $2
                        `, [fixtureInfo.competition_id, pick.user_id]);
                        
                        console.log(`💀 ${pick.display_name} eliminated (picked ${pick.team_name})`);
                    } else {
                        console.log(`❤️ ${pick.display_name} loses life, ${livesRemaining} remaining (picked ${pick.team_name})`);
                    }
                }

                // Update pick outcome
                await client.query(`
                    UPDATE pick 
                    SET outcome = $2,
                        locked_at = CURRENT_TIMESTAMP,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = $1
                `, [pick.pick_id, outcome]);
            }

            // Check if round should be completed
            const remainingFixtures = await client.query(`
                SELECT COUNT(*) as remaining
                FROM fixture 
                WHERE round_id = $1 
                  AND (home_score IS NULL OR away_score IS NULL)
            `, [fixtureInfo.round_id]);

            if (parseInt(remainingFixtures.rows[0].remaining) === 0) {
                // All fixtures have results - complete the round
                await client.query(`
                    UPDATE round 
                    SET status = 'completed',
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = $1
                `, [fixtureInfo.round_id]);
                
                console.log(`🏁 Round "${fixtureInfo.round_name}" completed - all fixtures have results`);
            }

            await client.query('COMMIT');

            res.json({
                return_code: 'SUCCESS',
                message: `Result entered: ${fixtureInfo.home_team_name} ${home_score}-${away_score} ${fixtureInfo.away_team_name}`,
                fixture: {
                    id: fixture_id,
                    home_team: fixtureInfo.home_team_name,
                    away_team: fixtureInfo.away_team_name,
                    home_score: home_score,
                    away_score: away_score
                },
                pick_processing: {
                    winners: winners,
                    losers: losers,
                    total_picks: picksResult.rows.length
                },
                round_completed: parseInt(remainingFixtures.rows[0].remaining) === 0
            });

        } catch (dbError) {
            await client.query('ROLLBACK');
            throw dbError;
        } finally {
            client.release();
        }

    } catch (error) {
        console.error('❌ Enter result failed:', error);
        res.json({
            return_code: 'SERVER_ERROR',
            message: 'Failed to enter result'
        });
    }
});

module.exports = router;