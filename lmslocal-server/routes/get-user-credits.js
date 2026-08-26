/*
=======================================================================================================================================
API Route: get-user-credits
=======================================================================================================================================
Method: POST
Purpose: Retrieve user's credit balance and usage statistics for PAYG system
=======================================================================================================================================
Request Payload:
{} // Empty - user identified from JWT token

Success Response (ALWAYS HTTP 200):
{
  "return_code": "SUCCESS",
  "credits": {
    "paid_credit": 47,                  // integer, available paid credits
    "total_players": 67,                // integer, total players across all competitions
    "free_players_used": 20,            // integer, players using free tier (0-FREE_PLAYER_LIMIT)
    "paid_players_used": 47,            // integer, players beyond free tier
    "free_player_limit": 20             // integer, configurable free tier limit from .env
  },
  "recent_purchases": [                 // array, last 3 credit purchases
    {
      "pack_type": "value_100",         // string, pack identifier
      "pack_name": "Best Value Pack",   // string, friendly pack name
      "credits_purchased": 100,         // integer, credits in pack
      "paid_amount": 40.00,             // number, amount paid in GBP
      "purchased_at": "2025-03-15T10:30:00Z"  // string, ISO datetime
    }
  ],
  "place_usage": [                      // array, which competitions hold the places, biggest first
    {
      "competition_id": 229,            // integer
      "name": "Aptar",                  // string, competition name
      "status": "COMPLETE",             // string, upper-cased competition status
      "status_label": "Finished",       // string, human label ("" if status unrecognised)
      "places": 8                       // integer, chargeable places this competition holds
    }
  ]
}

Error Response (ALWAYS HTTP 200):
{
  "return_code": "ERROR_TYPE",
  "message": "Descriptive error message"
}
=======================================================================================================================================
Return Codes:
"SUCCESS"
"GUEST_USER_NO_CREDITS"  - User is a guest player (cannot purchase credits)
"BOT_USER_NO_CREDITS"    - User is a bot (cannot purchase credits)
"UNAUTHORIZED"           - Invalid or missing JWT token
"SERVER_ERROR"           - Unexpected server error
=======================================================================================================================================
Business Logic:
- Only real organizers (created_by_user_id IS NULL) can view/purchase credits
- Guest players and bots are rejected early to save database queries
- Player count includes ALL players in ALL competitions owned by this organizer
- Free tier: 20 player slots are free, counted live — a player leaving frees their slot again
- Paid tier: slots beyond the free limit consume paid credits (1 credit per player)
- place_usage says WHICH competitions hold those slots, including finished ones, which is the
  part the totals cannot show. Same definition as the dashboard banner and the join_blocked
  email — services/placeUsage.js
=======================================================================================================================================
*/

const express = require('express');
const { query } = require('../database');
const { verifyToken } = require('../middleware/auth');
const { CREDIT_PACKS } = require('../config/credit-packs');
const { organiserChargeableCountSql } = require('../services/botPool');
const { getPlaceUsage } = require('../services/placeUsage');
const router = express.Router();

router.post('/', verifyToken, async (req, res) => {
  try {
    // Extract user ID from JWT token (set by verifyToken middleware)
    const userId = req.user.id;

    // === STEP 1: CHECK IF USER IS REAL ORGANIZER (PERFORMANCE OPTIMIZATION) ===
    // Guest players and bots cannot purchase credits - reject early to skip expensive queries
    const userCheckQuery = `
      SELECT
        id,
        created_by_user_id,
        email,
        paid_credit
      FROM app_user
      WHERE id = $1
    `;

    const userResult = await query(userCheckQuery, [userId]);

    if (userResult.rows.length === 0) {
      return res.json({
        return_code: "UNAUTHORIZED",
        message: "User not found"
      });
    }

    const user = userResult.rows[0];

    // Check if user is a guest or bot (created_by_user_id NOT NULL)
    // Real organizers have created_by_user_id = NULL (self-created accounts)
    // Guests have created_by_user_id = organizer's ID
    // Bots have created_by_user_id = 1 (system user)
    if (user.created_by_user_id !== null) {
      return res.json({
        return_code: "GUEST_USER_NO_CREDITS",
        message: "Guest and bot users cannot purchase credits"
      });
    }

    // === STEP 2: GET CREDIT BALANCE AND PLAYER COUNT (SINGLE OPTIMIZED QUERY) ===
    // Balance plus the chargeable player count across all their competitions, in one query.
    // Bots are excluded - they cost nothing and take no free place, so reporting them as usage
    // would show the organiser places being consumed that they are not being charged for.
    // services/botPool.js owns that definition.
    const creditsQuery = `
      SELECT
        u.paid_credit,
        ${organiserChargeableCountSql('u.id')} as total_player_count
      FROM app_user u
      WHERE u.id = $1
    `;

    const creditsResult = await query(creditsQuery, [userId]);
    const creditsData = creditsResult.rows[0];

    // Calculate player usage based on PAYG business rules
    // Free tier limit from environment variable (defaults to 20 if not set)
    const FREE_PLAYER_LIMIT = parseInt(process.env.FREE_PLAYER_LIMIT) || 20;

    const totalPlayers = parseInt(creditsData.total_player_count) || 0;
    const freePlayersUsed = Math.min(totalPlayers, FREE_PLAYER_LIMIT); // First X are free
    const paidPlayersUsed = Math.max(0, totalPlayers - FREE_PLAYER_LIMIT); // Players beyond free limit

    // === STEP 3: GET RECENT PURCHASES (OPTIONAL - LAST 3) ===
    // Query credit_purchases table for purchase history
    const purchasesQuery = `
      SELECT
        pack_type,
        credits_purchased,
        paid_amount,
        created_at as purchased_at
      FROM credit_purchases
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT 3
    `;

    const purchasesResult = await query(purchasesQuery, [userId]);

    /*
    === STEP 3.5: WHERE THE PLACES WENT ===
    The totals above say how many places are gone; this says which competitions are holding them,
    which is the part an organiser cannot work out for themselves. A finished competition holds
    its places exactly like a running one, so somebody blocked on a brand new competition with
    four people in it has nothing on screen that explains it.

    Same service as the dashboard banner and the join_blocked email, so all three account for the
    same number the same way. See services/placeUsage.js.
    */
    const usage = await getPlaceUsage(userId);

    // Map pack_type to friendly pack names using CREDIT_PACKS config
    const recentPurchases = purchasesResult.rows.map(purchase => ({
      pack_type: purchase.pack_type,
      pack_name: CREDIT_PACKS[purchase.pack_type]?.name || purchase.pack_type,
      credits_purchased: purchase.credits_purchased,
      paid_amount: parseFloat(purchase.paid_amount),
      purchased_at: purchase.purchased_at
    }));

    // === STEP 4: RETURN SUCCESS RESPONSE ===
    return res.json({
      return_code: "SUCCESS",
      credits: {
        paid_credit: creditsData.paid_credit,
        total_players: totalPlayers,
        free_players_used: freePlayersUsed,
        paid_players_used: paidPlayersUsed,
        free_player_limit: FREE_PLAYER_LIMIT  // Include configurable limit for frontend
      },
      recent_purchases: recentPurchases,
      place_usage: usage.competitions
    });

  } catch (error) {
    // Log detailed error for debugging
    console.error('Get user credits error:', {
      error: error.message,
      stack: error.stack?.substring(0, 500),
      user_id: req.user?.id,
      timestamp: new Date().toISOString()
    });

    // Return generic error to client (don't leak internal details)
    return res.json({
      return_code: "SERVER_ERROR",
      message: "Failed to retrieve credit information"
    });
  }
});

module.exports = router;
