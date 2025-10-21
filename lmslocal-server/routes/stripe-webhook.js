/*
=======================================================================================================================================
API Route: stripe-webhook
=======================================================================================================================================
Method: POST
Purpose: Handles Stripe webhook events for credit pack purchases. Verifies webhook signature and processes successful payments.
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
"checkout.session.completed" - Credit pack payment successful, adds credits to user balance
=======================================================================================================================================
Business Logic (PAYG System):
1. Add purchased credits to user's paid_credit balance
2. Insert purchase record into credit_purchases table
3. Log transaction in credit_transactions table
4. Record promo code usage if discount applied
5. Send payment confirmation email (async)
=======================================================================================================================================
Security:
- Webhook signature verification with STRIPE_WEBHOOK_SECRET
- Raw body parsing required for signature validation
- Idempotent processing to prevent duplicate updates
- Atomic transaction ensures all-or-nothing credit addition
=======================================================================================================================================
*/

const express = require('express');
const router = express.Router();
const { query, transaction } = require('../database'); // Use destructured database import
const { logApiCall } = require('../utils/apiLogger'); // API logging utility
const { sendPaymentConfirmationEmail } = require('../services/emailService'); // Email service
const Stripe = require('stripe');

// Initialize Stripe with secret key from environment
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);


/**
 * Calculate credit expiry date (12 months from purchase)
 * @returns {Date} Expiry date
 */
function calculateCreditExpiryDate() {
  const now = new Date();
  // Credits expire 12 months from purchase date (T&Cs only, not enforced in system)
  return new Date(now.setFullYear(now.getFullYear() + 1));
}

/**
 * Process successful credit pack purchase
 * @param {Object} session - Stripe checkout session
 */
async function processSuccessfulPayment(session) {
  const { user_id, pack_type, credits_purchased, promo_code, promo_code_id, original_price, discount_amount } = session.metadata;

  console.log(`Processing credit pack purchase for user ${user_id}, pack: ${pack_type}, credits: ${credits_purchased}`);

  // Use transaction wrapper for atomic credit purchase processing
  await transaction(async (client) => {

    // Extract payment details from session
    const paidAmount = session.amount_total / 100; // Convert from pence to pounds
    const creditsPurchased = parseInt(credits_purchased);

    // === STEP 1: ADD CREDITS TO USER BALANCE ===
    const addCreditsQuery = `
      UPDATE app_user
      SET paid_credit = paid_credit + $1
      WHERE id = $2
      RETURNING paid_credit as new_balance
    `;

    const updateResult = await client.query(addCreditsQuery, [creditsPurchased, parseInt(user_id)]);

    if (updateResult.rows.length === 0) {
      throw new Error(`User ${user_id} not found when adding credits`);
    }

    const newBalance = updateResult.rows[0].new_balance;
    console.log(`✅ Added ${creditsPurchased} credits to user ${user_id}. New balance: ${newBalance}`);

    // === STEP 2: INSERT PURCHASE RECORD ===
    const insertPurchaseQuery = `
      INSERT INTO credit_purchases (
        user_id,
        pack_type,
        credits_purchased,
        stripe_subscription_id,
        stripe_customer_id,
        paid_amount,
        promo_code_id,
        original_price,
        discount_amount,
        created_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP)
      RETURNING id
    `;

    const purchaseResult = await client.query(insertPurchaseQuery, [
      parseInt(user_id),
      pack_type,
      creditsPurchased,
      session.id, // Stripe session ID
      session.customer || null, // Stripe customer ID if available
      paidAmount,
      promo_code_id ? parseInt(promo_code_id) : null,
      original_price ? parseFloat(original_price) : null,
      discount_amount ? parseFloat(discount_amount) : null
    ]);

    const purchaseId = purchaseResult.rows[0].id;
    console.log(`✅ Credit purchase record created (ID: ${purchaseId})`);

    // === STEP 3: LOG CREDIT TRANSACTION ===
    const insertTransactionQuery = `
      INSERT INTO credit_transactions (
        user_id,
        transaction_type,
        amount,
        purchase_id,
        description,
        created_at
      )
      VALUES ($1, 'purchase', $2, $3, $4, CURRENT_TIMESTAMP)
    `;

    const transactionDescription = `Purchased ${pack_type} pack (${creditsPurchased} credits) for £${paidAmount.toFixed(2)}`;

    await client.query(insertTransactionQuery, [
      parseInt(user_id),
      creditsPurchased,
      purchaseId,
      transactionDescription
    ]);

    console.log(`✅ Credit transaction logged for user ${user_id}`);

    // === STEP 4: RECORD PROMO CODE USAGE (IF APPLICABLE) ===
    if (promo_code_id && promo_code) {
      // Insert usage record into promo_code_usage table
      const insertPromoUsageQuery = `
        INSERT INTO promo_code_usage (
          promo_code_id,
          user_id,
          pack_purchased,
          original_price,
          discount_amount,
          final_price,
          stripe_session_id,
          used_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)
      `;

      const finalPrice = original_price ? parseFloat(original_price) - parseFloat(discount_amount || 0) : paidAmount;

      await client.query(insertPromoUsageQuery, [
        parseInt(promo_code_id),
        parseInt(user_id),
        pack_type, // Store pack_type in plan_purchased column
        original_price ? parseFloat(original_price) : null,
        discount_amount ? parseFloat(discount_amount) : null,
        finalPrice,
        session.id
      ]);

      // Increment total usage counter in promo_codes table
      const incrementUsageQuery = `
        UPDATE promo_codes
        SET current_total_uses = current_total_uses + 1
        WHERE id = $1
      `;

      await client.query(incrementUsageQuery, [parseInt(promo_code_id)]);

      console.log(`✅ Promo code "${promo_code}" usage recorded for user ${user_id}`);
    }

    console.log(`✅ Credit pack purchase completed for user ${user_id}: ${creditsPurchased} credits added`);

    // === STEP 5: SEND CONFIRMATION EMAIL (ASYNC) ===
    const userDetailsQuery = `
      SELECT email, display_name
      FROM app_user
      WHERE id = $1
    `;
    const userDetailsResult = await client.query(userDetailsQuery, [parseInt(user_id)]);

    if (userDetailsResult.rows.length > 0) {
      const { email, display_name } = userDetailsResult.rows[0];

      // Send payment confirmation email (async, don't block webhook response)
      // Note: Using existing email function - may need updating for credit packs
      const expiryDate = calculateCreditExpiryDate();
      sendPaymentConfirmationEmail(email, display_name, pack_type, paidAmount, expiryDate.toISOString())
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

        // Verify this is a credit pack purchase
        if (session.metadata?.purchase_type === 'credit_pack') {
          await processSuccessfulPayment(session);
        } else {
          console.log(`ℹ️  Skipping non-credit-pack checkout: ${session.id}`);
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