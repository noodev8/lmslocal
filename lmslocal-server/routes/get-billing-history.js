/*
=======================================================================================================================================
API Route: get-billing-history
=======================================================================================================================================
Method: POST
Purpose: Retrieve user's credit purchase history for billing page display
=======================================================================================================================================
Request Payload:
{} // Empty - user identified from JWT token

Success Response (ALWAYS HTTP 200):
{
  "return_code": "SUCCESS",
  "purchases": [
    {
      "id": 123,                                // integer, purchase ID
      "pack_type": "popular_40",                // string, pack identifier
      "pack_name": "Popular Pack",              // string, friendly pack name
      "credits_purchased": 40,                  // integer, credits in pack
      "paid_amount": 18.00,                     // number, amount paid in GBP
      "original_price": 20.00,                  // number, price before discount (null if no promo)
      "discount_amount": 2.00,                  // number, discount applied (null if no promo)
      "promo_code": "BLACKFRIDAY",              // string, promo code used (null if none)
      "stripe_session_id": "cs_test_...",       // string, Stripe session ID
      "purchased_at": "2025-03-15T10:30:00Z"    // string, ISO datetime
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
"UNAUTHORIZED"           - Invalid or missing JWT token
"SERVER_ERROR"           - Unexpected server error
=======================================================================================================================================
Business Logic:
- Returns all credit purchases for authenticated user
- Orders by most recent first (created_at DESC)
- Includes promo code information if discount was applied
- Shows original price and discount amount for transparency
- Empty array if no purchases found (not an error)
=======================================================================================================================================
*/

const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/auth');
const { query } = require('../database');
const { CREDIT_PACKS } = require('../config/credit-packs');

/**
 * POST /get-billing-history
 * Retrieves credit purchase history for authenticated user
 */
router.post('/', verifyToken, async (req, res) => {
  try {
    // Extract user ID from JWT token (set by verifyToken middleware)
    const userId = req.user.id;

    // === QUERY CREDIT PURCHASES WITH PROMO CODE INFO ===
    // Join with promo_codes table to get promo code name if used
    const purchasesQuery = `
      SELECT
        cp.id,
        cp.pack_type,
        cp.credits_purchased,
        cp.paid_amount,
        cp.original_price,
        cp.discount_amount,
        cp.stripe_subscription_id as stripe_session_id,
        cp.created_at as purchased_at,
        pc.code as promo_code
      FROM credit_purchases cp
      LEFT JOIN promo_codes pc ON cp.promo_code_id = pc.id
      WHERE cp.user_id = $1
      ORDER BY cp.created_at DESC
    `;

    const purchasesResult = await query(purchasesQuery, [userId]);

    // Map database rows to response format
    const purchases = purchasesResult.rows.map(purchase => {
      // Get friendly pack name from config (fallback to pack_type if not found)
      const packConfig = CREDIT_PACKS[purchase.pack_type];
      const packName = packConfig ? packConfig.name : purchase.pack_type;

      return {
        id: purchase.id,
        pack_type: purchase.pack_type,
        pack_name: packName,
        credits_purchased: purchase.credits_purchased,
        paid_amount: parseFloat(purchase.paid_amount),
        original_price: purchase.original_price ? parseFloat(purchase.original_price) : null,
        discount_amount: purchase.discount_amount ? parseFloat(purchase.discount_amount) : null,
        promo_code: purchase.promo_code || null,
        stripe_session_id: purchase.stripe_session_id,
        purchased_at: purchase.purchased_at
      };
    });

    // Return success with purchases array (empty array if no purchases)
    return res.json({
      return_code: 'SUCCESS',
      purchases: purchases
    });

  } catch (error) {
    // Log detailed error for debugging
    console.error('Get billing history error:', {
      error: error.message,
      stack: error.stack?.substring(0, 500),
      user_id: req.user?.id,
      timestamp: new Date().toISOString()
    });

    // Return generic error to client
    return res.json({
      return_code: 'SERVER_ERROR',
      message: 'Failed to retrieve billing history'
    });
  }
});

module.exports = router;
