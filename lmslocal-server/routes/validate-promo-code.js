/*
=======================================================================================================================================
API Route: validate-promo-code
=======================================================================================================================================
Method: POST
Purpose: Validates a promotional discount code and returns calculated pricing for all applicable plans
=======================================================================================================================================
Request Payload:
{
  "code": "BLACKFRIDAY",              // string, required - promo code to validate
  "plan": "club"                      // string, optional - specific plan to check (club/venue)
}

Success Response:
{
  "return_code": "SUCCESS",
  "valid": true,
  "promo_code": {
    "code": "BLACKFRIDAY",            // string, the validated code
    "description": "Black Friday 2025 - 30% off all plans",
    "discount_type": "percentage",    // string, 'percentage' or 'fixed'
    "discount_value": 30              // number, 30 (for 30%) or 20.00 (for £20 off)
  },
  "pricing": {
    "club": {
      "original": 79.00,              // number, original price in £
      "discount": 23.70,              // number, discount amount in £
      "final": 55.30                  // number, final price after discount
    },
    "venue": {
      "original": 179.00,
      "discount": 53.70,
      "final": 125.30
    }
  },
  "expires_at": "2025-11-30T23:59:59Z"  // string, expiry timestamp (null if no expiry)
}

Error Response:
{
  "return_code": "INVALID_CODE",
  "valid": false,
  "message": "This promo code is not valid"
}
=======================================================================================================================================
Return Codes:
"SUCCESS"
"INVALID_CODE"              - Code doesn't exist or is inactive
"EXPIRED"                   - Code has expired
"ALREADY_USED"              - User already used this code
"LIMIT_REACHED"             - Maximum uses reached
"PLAN_NOT_APPLICABLE"       - Code not valid for selected plan
"VALIDATION_ERROR"          - Missing required fields
"UNAUTHORIZED"              - Invalid or missing JWT token
"SERVER_ERROR"              - Unexpected server error
=======================================================================================================================================
*/

const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/auth'); // JWT authentication middleware
const { logApiCall } = require('../utils/apiLogger'); // API logging utility
const { query } = require('../database'); // Database connection pooling
const { PLAN_LIMITS } = require('../config/plans'); // Plan configuration

// Plan pricing configuration (matches create-checkout-session)
const PLAN_PRICING = {
  club: 79,
  venue: 179
};

/**
 * Calculate discount amount based on type and value
 * @param {number} originalPrice - Original price in pounds
 * @param {string} discountType - 'percentage' or 'fixed'
 * @param {number} discountValue - Discount value (25 for 25% or 20.00 for £20)
 * @returns {object} - { discountAmount, finalPrice }
 */
function calculateDiscount(originalPrice, discountType, discountValue) {
  let discountAmount = 0;

  if (discountType === 'percentage') {
    // Calculate percentage discount
    discountAmount = (originalPrice * discountValue) / 100;
  } else if (discountType === 'fixed') {
    // Fixed amount discount
    discountAmount = discountValue;
  }

  // Ensure discount doesn't exceed original price
  discountAmount = Math.min(discountAmount, originalPrice);

  // Calculate final price
  const finalPrice = Math.max(0, originalPrice - discountAmount);

  return {
    discountAmount: parseFloat(discountAmount.toFixed(2)),
    finalPrice: parseFloat(finalPrice.toFixed(2))
  };
}

/**
 * POST /validate-promo-code
 * Validates a promo code and returns pricing information
 */
router.post('/', verifyToken, async (req, res) => {
  try {
    // Extract user ID from JWT token (set by verifyToken middleware)
    const userId = req.user.id;

    // Log the API call for monitoring and debugging
    logApiCall('validate-promo-code');

    // Extract and validate request payload
    const { code, plan } = req.body;

    // Validate required fields
    if (!code) {
      return res.status(200).json({
        return_code: 'VALIDATION_ERROR',
        valid: false,
        message: 'Promo code is required'
      });
    }

    // Normalize code to uppercase for case-insensitive matching
    const normalizedCode = code.trim().toUpperCase();

    // ============================================================================
    // STEP 1: Check if promo code exists and is active
    // ============================================================================
    const promoCodeQuery = `
      SELECT
        id,
        code,
        description,
        discount_type,
        discount_value,
        applies_to_plans,
        valid_from,
        valid_until,
        max_total_uses,
        max_uses_per_user,
        current_total_uses,
        campaign_source
      FROM promo_codes
      WHERE UPPER(code) = $1 AND active = true
    `;

    const promoCodeResult = await query(promoCodeQuery, [normalizedCode]);

    // Check if code exists
    if (promoCodeResult.rows.length === 0) {
      return res.status(200).json({
        return_code: 'INVALID_CODE',
        valid: false,
        message: 'This promo code is not valid'
      });
    }

    const promoCode = promoCodeResult.rows[0];

    // ============================================================================
    // STEP 2: Check time validity (valid_from and valid_until)
    // ============================================================================
    const now = new Date();

    // Check if code is not yet valid
    if (promoCode.valid_from && new Date(promoCode.valid_from) > now) {
      return res.status(200).json({
        return_code: 'NOT_YET_VALID',
        valid: false,
        message: 'This promo code is not yet active'
      });
    }

    // Check if code has expired
    if (promoCode.valid_until && new Date(promoCode.valid_until) < now) {
      return res.status(200).json({
        return_code: 'EXPIRED',
        valid: false,
        message: 'This promo code has expired'
      });
    }

    // ============================================================================
    // STEP 3: Check total usage limit
    // ============================================================================
    if (promoCode.max_total_uses !== null &&
        promoCode.current_total_uses >= promoCode.max_total_uses) {
      return res.status(200).json({
        return_code: 'LIMIT_REACHED',
        valid: false,
        message: 'This promo code is no longer available'
      });
    }

    // ============================================================================
    // STEP 4: Check if user has already used this code
    // ============================================================================
    const userUsageQuery = `
      SELECT COUNT(*) as usage_count
      FROM promo_code_usage
      WHERE promo_code_id = $1 AND user_id = $2
    `;

    const userUsageResult = await query(userUsageQuery, [promoCode.id, userId]);
    const userUsageCount = parseInt(userUsageResult.rows[0].usage_count);

    // Check if user has exceeded max uses per user
    if (userUsageCount >= promoCode.max_uses_per_user) {
      return res.status(200).json({
        return_code: 'ALREADY_USED',
        valid: false,
        message: 'You have already used this promo code'
      });
    }

    // ============================================================================
    // STEP 5: Check plan applicability
    // ============================================================================
    // If applies_to_plans is set, check if selected plan is included
    if (plan && promoCode.applies_to_plans && promoCode.applies_to_plans.length > 0) {
      if (!promoCode.applies_to_plans.includes(plan)) {
        const planName = plan.charAt(0).toUpperCase() + plan.slice(1);
        return res.status(200).json({
          return_code: 'PLAN_NOT_APPLICABLE',
          valid: false,
          message: `This code is not valid for the ${planName} plan`
        });
      }
    }

    // ============================================================================
    // STEP 6: Calculate pricing for all applicable plans
    // ============================================================================
    const pricing = {};

    // Determine which plans to calculate pricing for
    let plansToCalculate = ['club', 'venue'];

    // If code is plan-specific, only calculate for those plans
    if (promoCode.applies_to_plans && promoCode.applies_to_plans.length > 0) {
      plansToCalculate = promoCode.applies_to_plans;
    }

    // Calculate discount for each applicable plan
    for (const planName of plansToCalculate) {
      const originalPrice = PLAN_PRICING[planName];
      const { discountAmount, finalPrice } = calculateDiscount(
        originalPrice,
        promoCode.discount_type,
        parseFloat(promoCode.discount_value)
      );

      pricing[planName] = {
        original: originalPrice,
        discount: discountAmount,
        final: finalPrice
      };
    }

    // ============================================================================
    // STEP 7: Return success response with pricing details
    // ============================================================================
    const responseData = {
      return_code: 'SUCCESS',
      valid: true,
      promo_code: {
        code: promoCode.code,
        description: promoCode.description,
        discount_type: promoCode.discount_type,
        discount_value: parseFloat(promoCode.discount_value)
      },
      pricing: pricing,
      expires_at: promoCode.valid_until || null
    };

    return res.status(200).json(responseData);

  } catch (error) {
    // Log error for debugging and monitoring
    console.error('Error in validate-promo-code:', error);

    // Return generic server error
    return res.status(200).json({
      return_code: 'SERVER_ERROR',
      valid: false,
      message: 'An unexpected error occurred while validating promo code'
    });
  }
});

module.exports = router;
