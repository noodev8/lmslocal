/*
=======================================================================================================================================
API Route: create-checkout-session
=======================================================================================================================================
Method: POST
Purpose: Creates a Stripe checkout session for subscription upgrade. Returns a checkout URL for the user to complete payment.
=======================================================================================================================================
Request Payload:
{
  "plan": "club",                        // string, required - target plan: "club" or "venue"
  "billing_cycle": "yearly",             // string, required - only "yearly" supported
  "promo_code": "BLACKFRIDAY"            // string, optional - promotional discount code
}

Success Response:
{
  "return_code": "SUCCESS",
  "checkout_url": "https://checkout.stripe.com/pay/cs_...", // string, Stripe checkout URL
  "session_id": "cs_1234567890"          // string, Stripe session ID for tracking
}

Error Response:
{
  "return_code": "ERROR_TYPE",
  "message": "Descriptive error message"
}
=======================================================================================================================================
Return Codes:
"SUCCESS"
"VALIDATION_ERROR"
"UNAUTHORIZED"
"INVALID_PLAN"
"INVALID_PROMO"             - Promo code validation failed
"STRIPE_ERROR"
"SERVER_ERROR"

Business Logic:
- Only allows upgrades to club/venue (free tier is free)
- Creates Stripe checkout session with plan pricing
- Sets success/cancel URLs for redirect handling
- Stores session metadata for webhook processing
- Only yearly billing supported (one-time payment)
=======================================================================================================================================
*/

const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/auth'); // JWT authentication middleware
const { logApiCall } = require('../utils/apiLogger'); // API logging utility
const { query } = require('../database'); // Database connection pooling
const Stripe = require('stripe');

// Initialize Stripe with secret key from environment
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

// Plan pricing configuration for dynamic Stripe checkout
const PLAN_PRICING = {
  club: {
    yearly: {
      amount: 7900, // £79.00 in pence
    }
  },
  venue: {
    yearly: {
      amount: 17900, // £179.00 in pence
    }
  }
};

/**
 * POST /create-checkout-session
 * Creates a Stripe checkout session for subscription upgrade
 */
router.post('/', verifyToken, async (req, res) => {
  const startTime = Date.now();
  let userId;

  try {
    // Extract user ID from JWT token (set by verifyToken middleware)
    userId = req.user.id;

    // Log the API call for monitoring and debugging
    logApiCall('create-checkout-session');

    // Extract and validate request payload
    const { plan, billing_cycle, promo_code } = req.body;

    // Validate required fields
    if (!plan || !billing_cycle) {
      return res.status(200).json({
        return_code: 'VALIDATION_ERROR',
        message: 'Missing required fields: plan and billing_cycle'
      });
    }

    // Validate plan (only allow upgrades to paid plans)
    if (!['club', 'venue'].includes(plan)) {
      return res.status(200).json({
        return_code: 'INVALID_PLAN',
        message: 'Invalid plan. Only club and venue plans are available for purchase.'
      });
    }

    // Validate billing cycle (only yearly supported now)
    if (billing_cycle !== 'yearly') {
      return res.status(200).json({
        return_code: 'VALIDATION_ERROR',
        message: 'Invalid billing_cycle. Only yearly billing is supported.'
      });
    }

    // Get base pricing information for the selected plan and cycle
    const planConfig = PLAN_PRICING[plan][billing_cycle];
    if (!planConfig) {
      return res.status(200).json({
        return_code: 'INVALID_PLAN',
        message: 'Pricing not available for the selected plan and billing cycle.'
      });
    }

    // ============================================================================
    // Promo code validation and discount calculation
    // ============================================================================
    let finalAmount = planConfig.amount; // Amount in pence (e.g., 7900 for £79)
    let promoCodeId = null;
    let originalPrice = finalAmount / 100; // Convert to pounds for storage
    let discountAmount = 0;
    let promoCodeData = null;

    // If promo code is provided, validate it and apply discount
    if (promo_code && promo_code.trim()) {
      const normalizedCode = promo_code.trim().toUpperCase();

      // Query promo code from database
      const promoQuery = `
        SELECT
          id,
          code,
          discount_type,
          discount_value,
          applies_to_plans,
          valid_from,
          valid_until,
          max_total_uses,
          max_uses_per_user,
          current_total_uses,
          active
        FROM promo_codes
        WHERE UPPER(code) = $1 AND active = true
      `;

      const promoResult = await query(promoQuery, [normalizedCode]);

      // Validate promo code exists
      if (promoResult.rows.length === 0) {
        return res.status(200).json({
          return_code: 'INVALID_PROMO',
          message: 'Invalid promo code'
        });
      }

      promoCodeData = promoResult.rows[0];

      // Check time validity
      const now = new Date();
      if (promoCodeData.valid_from && new Date(promoCodeData.valid_from) > now) {
        return res.status(200).json({
          return_code: 'INVALID_PROMO',
          message: 'This promo code is not yet active'
        });
      }

      if (promoCodeData.valid_until && new Date(promoCodeData.valid_until) < now) {
        return res.status(200).json({
          return_code: 'INVALID_PROMO',
          message: 'This promo code has expired'
        });
      }

      // Check total usage limit
      if (promoCodeData.max_total_uses !== null &&
          promoCodeData.current_total_uses >= promoCodeData.max_total_uses) {
        return res.status(200).json({
          return_code: 'INVALID_PROMO',
          message: 'This promo code is no longer available'
        });
      }

      // Check user usage limit
      const usageQuery = `
        SELECT COUNT(*) as usage_count
        FROM promo_code_usage
        WHERE promo_code_id = $1 AND user_id = $2
      `;

      const usageResult = await query(usageQuery, [promoCodeData.id, userId]);
      const userUsageCount = parseInt(usageResult.rows[0].usage_count);

      if (userUsageCount >= promoCodeData.max_uses_per_user) {
        return res.status(200).json({
          return_code: 'INVALID_PROMO',
          message: 'You have already used this promo code'
        });
      }

      // Check plan applicability
      if (promoCodeData.applies_to_plans && promoCodeData.applies_to_plans.length > 0) {
        if (!promoCodeData.applies_to_plans.includes(plan)) {
          return res.status(200).json({
            return_code: 'INVALID_PROMO',
            message: `This promo code is not valid for the ${plan} plan`
          });
        }
      }

      // Calculate discount amount
      if (promoCodeData.discount_type === 'percentage') {
        // Percentage discount
        const discountPercent = parseFloat(promoCodeData.discount_value);
        discountAmount = (originalPrice * discountPercent) / 100;
      } else if (promoCodeData.discount_type === 'fixed') {
        // Fixed amount discount
        discountAmount = parseFloat(promoCodeData.discount_value);
      }

      // Ensure discount doesn't exceed original price
      discountAmount = Math.min(discountAmount, originalPrice);
      discountAmount = parseFloat(discountAmount.toFixed(2));

      // Calculate final price in pounds then convert to pence
      const finalPriceInPounds = Math.max(0, originalPrice - discountAmount);
      finalAmount = Math.round(finalPriceInPounds * 100); // Convert to pence

      // Store promo code ID for metadata
      promoCodeId = promoCodeData.id;
    }

    // Create Stripe checkout session
    const session = await stripe.checkout.sessions.create({
      // Payment configuration
      payment_method_types: ['card'],
      mode: 'payment', // One-time payment (not subscription)

      // Line items for the checkout
      line_items: [{
        price_data: {
          currency: 'gbp',
          product_data: {
            name: `LMSLocal ${plan.charAt(0).toUpperCase() + plan.slice(1)} Plan`,
            description: promo_code
              ? `${billing_cycle.charAt(0).toUpperCase() + billing_cycle.slice(1)} subscription (${promo_code} discount applied)`
              : `${billing_cycle.charAt(0).toUpperCase() + billing_cycle.slice(1)} subscription for Last Man Standing competitions`,
          },
          unit_amount: finalAmount, // Amount in pence (discounted if promo applied)
        },
        quantity: 1,
      }],

      // Store metadata for webhook processing
      metadata: {
        user_id: userId.toString(),
        plan: plan,
        billing_cycle: billing_cycle,
        upgrade_type: 'subscription_purchase',
        promo_code: promo_code || '',
        promo_code_id: promoCodeId ? promoCodeId.toString() : '',
        original_price: originalPrice.toString(),
        discount_amount: discountAmount.toString()
      },

      // Success and cancel URLs - redirect after payment
      // Use dedicated Stripe frontend URL for clean redirect handling
      success_url: `${process.env.STRIPE_FRONTEND_URL || 'http://localhost:3000'}/billing?session_id={CHECKOUT_SESSION_ID}&success=true`,
      cancel_url: `${process.env.STRIPE_FRONTEND_URL || 'http://localhost:3000'}/billing?canceled=true`,

      // Customer information (optional - Stripe will collect if needed)
      customer_creation: 'always',

      // Billing address collection
      billing_address_collection: 'required',
    });

    // Return success response with checkout URL
    const responseData = {
      return_code: 'SUCCESS',
      checkout_url: session.url,
      session_id: session.id
    };

    return res.status(200).json(responseData);

  } catch (error) {
    // Log error for debugging and monitoring
    console.error('Error in create-checkout-session:', error);

    // Handle Stripe-specific errors
    if (error.type && error.type.startsWith('Stripe')) {
      return res.status(200).json({
        return_code: 'STRIPE_ERROR',
        message: 'Payment processing error. Please try again.'
      });
    }

    // Handle general server errors
    return res.status(200).json({
      return_code: 'SERVER_ERROR',
      message: 'An unexpected error occurred while creating checkout session'
    });
  }
});

module.exports = router;