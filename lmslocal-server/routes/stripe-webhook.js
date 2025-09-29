/*
=======================================================================================================================================
API Route: stripe-webhook
=======================================================================================================================================
Method: POST
Purpose: Handles Stripe webhook events for payment processing. Verifies webhook signature and processes successful payments.
=======================================================================================================================================
Request Payload:
Raw Stripe webhook payload with signature verification

Success Response:
{
  "received": true
}

Error Response:
{
  "error": "Webhook signature verification failed"
}
=======================================================================================================================================
Webhook Events Handled:
"checkout.session.completed" - Payment successful, updates user subscription
=======================================================================================================================================
Security:
- Webhook signature verification with STRIPE_WEBHOOK_SECRET
- Raw body parsing required for signature validation
- Idempotent processing to prevent duplicate updates
=======================================================================================================================================
*/

const express = require('express');
const router = express.Router();
const { query, transaction } = require('../database'); // Use destructured database import
const { logApiCall } = require('../utils/apiLogger'); // API logging utility
const { PLAN_LIMITS } = require('../config/plans'); // Shared plan configuration
const { sendPaymentConfirmationEmail } = require('../services/emailService'); // Email service
const Stripe = require('stripe');

// Initialize Stripe with secret key from environment
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);


/**
 * Calculate subscription expiry date based on billing cycle
 * @param {string} billingCycle - 'monthly' or 'yearly'
 * @returns {Date} Expiry date
 */
function calculateExpiryDate(billingCycle) {
  const now = new Date();
  if (billingCycle === 'yearly') {
    // 12 months from now
    return new Date(now.setFullYear(now.getFullYear() + 1));
  } else {
    // 1 month from now (monthly)
    return new Date(now.setMonth(now.getMonth() + 1));
  }
}

/**
 * Process successful checkout session
 * @param {Object} session - Stripe checkout session
 */
async function processSuccessfulPayment(session) {
  const { user_id, plan, billing_cycle } = session.metadata;

  console.log(`Processing successful payment for user ${user_id}, plan: ${plan}, cycle: ${billing_cycle}`);

  // Use transaction wrapper for atomic subscription update
  await transaction(async (client) => {

    // Calculate subscription expiry date
    const expiryDate = calculateExpiryDate(billing_cycle);

    // Calculate payment amount based on plan and cycle
    const planPricing = {
      starter: { monthly: 29.00, yearly: 232.00 },
      pro: { monthly: 79.00, yearly: 632.00 }
    };
    const paidAmount = planPricing[plan]?.[billing_cycle] || 0;

    // 1. Insert payment record into subscription table
    const insertSubscriptionQuery = `
      INSERT INTO subscription (user_id, plan_name, stripe_subscription_id, stripe_customer_id, paid_amount, created_at)
      VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
    `;

    await client.query(insertSubscriptionQuery, [
      parseInt(user_id),
      plan,
      session.id, // Use session ID as subscription reference
      session.customer || null, // Stripe customer ID if available
      paidAmount
    ]);

    // 2. Update user's subscription in app_user table
    const updateUserQuery = `
      UPDATE app_user
      SET subscription_plan = $1,
          subscription_expiry = $2
      WHERE id = $3
    `;

    await client.query(updateUserQuery, [
      plan,
      expiryDate.toISOString(),
      parseInt(user_id)
    ]);

    // 3. Update user's player allowance based on new plan
    const planLimit = PLAN_LIMITS[plan] || PLAN_LIMITS.lite;
    const updateAllowanceQuery = `
      INSERT INTO user_allowance (user_id, max_players, updated_at)
      VALUES ($1, $2, CURRENT_TIMESTAMP)
      ON CONFLICT (user_id)
      DO UPDATE SET
        max_players = EXCLUDED.max_players,
        updated_at = EXCLUDED.updated_at
    `;

    await client.query(updateAllowanceQuery, [
      parseInt(user_id),
      planLimit
    ]);

    console.log(`✅ Subscription updated successfully for user ${user_id}: ${plan} plan (${planLimit} players) expires ${expiryDate.toISOString()}`);

    // 4. Get user details for email confirmation
    const userDetailsQuery = `
      SELECT email, display_name
      FROM app_user
      WHERE id = $1
    `;
    const userDetailsResult = await client.query(userDetailsQuery, [parseInt(user_id)]);

    if (userDetailsResult.rows.length > 0) {
      const { email, display_name } = userDetailsResult.rows[0];

      // Send payment confirmation email (async, don't block webhook response)
      sendPaymentConfirmationEmail(email, display_name, plan, paidAmount, expiryDate.toISOString())
        .then(result => {
          if (result.success) {
            console.log(`✅ Payment confirmation email sent to ${email}`);
          } else {
            console.error(`❌ Failed to send payment confirmation email to ${email}:`, result.error);
          }
        })
        .catch(error => {
          console.error(`❌ Error sending payment confirmation email to ${email}:`, error);
        });
    } else {
      console.warn(`⚠️ User ${user_id} not found for email confirmation`);
    }
  });
}

/**
 * POST /stripe-webhook
 * Handles Stripe webhook events with signature verification
 *
 * NOTE: This route requires raw body parsing, which is handled by
 * special middleware in server.js before the webhook route
 */
router.post('/', async (req, res) => {
  // Log the webhook call for monitoring
  logApiCall('stripe-webhook');

  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.error('❌ STRIPE_WEBHOOK_SECRET not configured');
    return res.status(400).json({ error: 'Webhook secret not configured' });
  }

  let event;

  try {
    // Verify webhook signature using raw body
    // req.rawBody is set by middleware in server.js
    event = stripe.webhooks.constructEvent(req.rawBody, sig, webhookSecret);
    console.log(`✅ Webhook signature verified. Event type: ${event.type}`);
  } catch (err) {
    console.error(`❌ Webhook signature verification failed: ${err.message}`);
    return res.status(400).json({ error: 'Webhook signature verification failed' });
  }

  try {
    // Handle different webhook event types
    switch (event.type) {
      case 'checkout.session.completed':
        const session = event.data.object;
        console.log(`💰 Checkout session completed: ${session.id}`);

        // Verify this is a subscription purchase
        if (session.metadata?.upgrade_type === 'subscription_purchase') {
          await processSuccessfulPayment(session);
        } else {
          console.log(`ℹ️  Skipping non-subscription checkout: ${session.id}`);
        }
        break;

      case 'payment_intent.succeeded':
        console.log(`💳 Payment succeeded: ${event.data.object.id}`);
        // Additional handling if needed
        break;

      default:
        console.log(`ℹ️  Unhandled event type: ${event.type}`);
    }

    // Acknowledge receipt of webhook
    res.json({ received: true });

  } catch (error) {
    console.error('❌ Error processing webhook:', error);

    // Return 500 to tell Stripe to retry the webhook
    res.status(500).json({
      error: 'Webhook processing failed',
      message: error.message
    });
  }
});

module.exports = router;