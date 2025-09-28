/*
=======================================================================================================================================
API Route: create-checkout-session
=======================================================================================================================================
Method: POST
Purpose: Creates a Stripe checkout session for subscription upgrade. Returns a checkout URL for the user to complete payment.
=======================================================================================================================================
Request Payload:
{
  "plan": "starter",                     // string, required - target plan: "starter" or "pro"
  "billing_cycle": "monthly"             // string, required - "monthly" or "yearly"
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
"STRIPE_ERROR"
"SERVER_ERROR"

Business Logic:
- Only allows upgrades to starter/pro (lite is free)
- Creates Stripe checkout session with plan pricing
- Sets success/cancel URLs for redirect handling
- Stores session metadata for webhook processing
=======================================================================================================================================
*/

const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/auth'); // JWT authentication middleware
const { logApiCall } = require('../utils/apiLogger'); // API logging utility
const Stripe = require('stripe');

// Initialize Stripe with secret key from environment
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

// Plan pricing configuration - must match your Stripe product prices
const PLAN_PRICING = {
  starter: {
    monthly: {
      price_id: 'price_starter_monthly', // TODO: Replace with actual Stripe price ID
      amount: 2900, // £29.00 in pence
    },
    yearly: {
      price_id: 'price_starter_yearly', // TODO: Replace with actual Stripe price ID
      amount: 23200, // £232.00 in pence (£29 x 8 months)
    }
  },
  pro: {
    monthly: {
      price_id: 'price_pro_monthly', // TODO: Replace with actual Stripe price ID
      amount: 7900, // £79.00 in pence
    },
    yearly: {
      price_id: 'price_pro_yearly', // TODO: Replace with actual Stripe price ID
      amount: 63200, // £632.00 in pence (£79 x 8 months)
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
    const { plan, billing_cycle } = req.body;

    // Validate required fields
    if (!plan || !billing_cycle) {
      return res.status(200).json({
        return_code: 'VALIDATION_ERROR',
        message: 'Missing required fields: plan and billing_cycle'
      });
    }

    // Validate plan (only allow upgrades to paid plans)
    if (!['starter', 'pro'].includes(plan)) {
      return res.status(200).json({
        return_code: 'INVALID_PLAN',
        message: 'Invalid plan. Only starter and pro plans are available for purchase.'
      });
    }

    // Validate billing cycle
    if (!['monthly', 'yearly'].includes(billing_cycle)) {
      return res.status(200).json({
        return_code: 'VALIDATION_ERROR',
        message: 'Invalid billing_cycle. Must be monthly or yearly.'
      });
    }

    // Get pricing information for the selected plan and cycle
    const planConfig = PLAN_PRICING[plan][billing_cycle];
    if (!planConfig) {
      return res.status(200).json({
        return_code: 'INVALID_PLAN',
        message: 'Pricing not available for the selected plan and billing cycle.'
      });
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
            description: `${billing_cycle.charAt(0).toUpperCase() + billing_cycle.slice(1)} subscription for Last Man Standing competitions`,
          },
          unit_amount: planConfig.amount, // Amount in pence
        },
        quantity: 1,
      }],

      // Store metadata for webhook processing
      metadata: {
        user_id: userId.toString(),
        plan: plan,
        billing_cycle: billing_cycle,
        upgrade_type: 'subscription_purchase'
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