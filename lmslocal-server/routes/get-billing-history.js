/*
=======================================================================================================================================
API Route: get-billing-history
=======================================================================================================================================
Method: POST
Purpose: Retrieves user's billing history from subscription payments. Returns chronological list of all payments made by the user.
=======================================================================================================================================
Request Payload:
{}

Success Response:
{
  "return_code": "SUCCESS",
  "billing_history": [
    {
      "id": 1,                                    // number, subscription record ID
      "plan_name": "starter",                     // string, plan purchased
      "paid_amount": 29.00,                       // number, amount paid in pounds
      "payment_date": "2025-01-15T10:30:00Z",    // string, ISO date when payment occurred
      "stripe_session_id": "cs_1234567890",      // string, Stripe session reference
      "billing_cycle": "monthly"                 // string, extracted from amount/plan
    }
  ]
}

Error Response:
{
  "return_code": "ERROR_TYPE",
  "message": "Descriptive error message"
}
=======================================================================================================================================
Return Codes:
"SUCCESS"
"UNAUTHORIZED"
"SERVER_ERROR"

Business Logic:
- Returns all subscription payments for the authenticated user
- Ordered by payment date (newest first)
- Includes plan details and payment amounts
- Shows Stripe session IDs for reference
=======================================================================================================================================
*/

const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/auth'); // JWT authentication middleware
const { query } = require('../database'); // Use destructured database import
const { logApiCall } = require('../utils/apiLogger'); // API logging utility

/**
 * Determine billing cycle from plan and amount
 * @param {string} planName - Plan name (club/venue or old names)
 * @param {number} amount - Paid amount
 * @returns {string} Billing cycle (yearly only now)
 */
function determineBillingCycle(planName, amount) {
  // Map old plan names to new ones
  const planMapping = {
    'lite': 'free',
    'starter': 'club',
    'pro': 'venue'
  };

  const mappedPlan = planMapping[planName] || planName;

  const planPricing = {
    club: { yearly: 49.00 },
    venue: { yearly: 149.00 }
  };

  const plan = planPricing[mappedPlan];
  if (!plan) return 'yearly'; // Default to yearly for unknown plans

  // Check if amount matches yearly pricing (with small tolerance for decimal precision)
  if (Math.abs(amount - plan.yearly) < 0.01) {
    return 'yearly';
  }

  return 'custom'; // For non-standard amounts
}

/**
 * POST /get-billing-history
 * Retrieves user's complete billing history
 */
router.post('/', verifyToken, async (req, res) => {
  let userId;

  try {
    // Extract user ID from JWT token (set by verifyToken middleware)
    userId = req.user.id;

    // Log the API call for monitoring and debugging
    logApiCall('get-billing-history');

    // Query subscription table for all payments by this user
    const billingQuery = `
      SELECT
        id,
        plan_name,
        paid_amount,
        created_at,
        stripe_subscription_id
      FROM subscription
      WHERE user_id = $1
      ORDER BY created_at DESC
    `;

    const billingResult = await query(billingQuery, [userId]);

    // Format billing history for frontend consumption
    const billingHistory = billingResult.rows.map(payment => {
      const paidAmount = parseFloat(payment.paid_amount);

      // Map old plan names to new ones
      const planMapping = {
        'lite': 'free',
        'starter': 'club',
        'pro': 'venue'
      };

      const mappedPlanName = planMapping[payment.plan_name] || payment.plan_name;

      return {
        id: payment.id,
        plan_name: mappedPlanName,
        paid_amount: paidAmount,
        payment_date: payment.created_at,
        stripe_session_id: payment.stripe_subscription_id,
        billing_cycle: determineBillingCycle(payment.plan_name, paidAmount)
      };
    });

    // Return successful response with billing history
    return res.status(200).json({
      return_code: 'SUCCESS',
      billing_history: billingHistory
    });

  } catch (error) {
    // Log error for debugging and monitoring
    console.error('Error in get-billing-history:', error);

    // Handle general server errors
    return res.status(200).json({
      return_code: 'SERVER_ERROR',
      message: 'An unexpected error occurred while retrieving billing history'
    });
  }
});

module.exports = router;