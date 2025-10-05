# Promo Code Implementation Guide

## Overview

URL-based promotional discount system for LMSLocal subscription upgrades. No visible voucher input field to maximize conversion rates.

**Access Method:** `https://lmslocal.co.uk/billing?promo=BLACKFRIDAY`

---

## Implementation Summary

### **Backend:**
- ✅ 2 new database tables (`promo_codes`, `promo_code_usage`)
- ✅ 1 new API endpoint (`POST /validate-promo-code`)
- ✅ 1 modified API endpoint (`POST /create-checkout-session`)
- ✅ 1 modified webhook (`POST /stripe-webhook`)
- **Total: 3 backend files to change**

### **Frontend:**
- ✅ 0 new pages/screens
- ✅ 1 modified page (`src/app/billing/page.tsx`)
- ✅ All changes are **dynamic** (no new UI, just conditional rendering)
- **Total: 1 frontend file to change**

### **How It Works:**
1. User clicks email link: `lmslocal.co.uk/billing?promo=BLACKFRIDAY`
2. Billing page detects `?promo=` parameter, calls validation API
3. **If valid** → shows green banner + discounted prices dynamically
4. **If invalid/expired** → shows red error banner, displays normal prices
5. User clicks upgrade → checkout session created (with discount if valid)
6. After payment → webhook records usage in database
7. Done!

**Development time: 8-10 hours**

---

## Database Schema
Check DB-Schema.sql for latest table
---

## API Requirements Summary

**New API endpoints needed: 1**
- `POST /validate-promo-code` - New endpoint

**Modified API endpoints: 1**
- `POST /create-checkout-session` - Add optional `promo_code` parameter

**Modified webhook: 1**
- `POST /stripe-webhook` - Update to record promo usage

**Total backend changes: 3 files**

---

## Frontend Requirements Summary

**No new screens/pages needed.**

**Modified screens: 1**
- `src/app/billing/page.tsx` - Existing billing page (dynamic updates)

**Changes to billing page:**
- Detect `?promo=CODE` URL parameter on load
- Call validation API automatically if promo in URL
- Show green success banner if code is valid
- Update pricing display with strikethrough + savings
- Pass promo code to checkout API when upgrading

**Visual changes:**
- Green promo banner appears dynamically when URL has `?promo=`
- Pricing shows: ~~£79~~ **£55.30** (Save £23.70!)
- Everything else stays the same

**Total frontend changes: 1 file**

### **Error Handling (Frontend):**

When user visits `/billing?promo=EXPIRED123`:

1. **Page loads** - Shows loading state briefly
2. **API called** - `POST /validate-promo-code { code: "EXPIRED123" }`
3. **API returns error** - `{ return_code: "EXPIRED", valid: false, message: "This promo code has expired" }`
4. **Red banner appears** - Shows error message with dismiss (×) button
5. **Prices unchanged** - Shows normal £79/£179 pricing
6. **User can still checkout** - No code applied, pays full price

**Possible error messages:**
- "This promo code is not valid" (doesn't exist)
- "This promo code has expired" (past valid_until date)
- "You have already used this promo code" (user already redeemed)
- "This promo code is no longer available" (max uses reached)
- "This code is not valid for the Club plan" (plan-specific code)

**User actions:**
- User can dismiss error banner (click ×)
- User can still upgrade at full price
- User can contact support if they think code should work
- No code is applied to checkout - normal pricing used

---

## API Endpoints

### 1. Validate Promo Code (NEW)

**Endpoint:** `POST /validate-promo-code`

**Purpose:** Check if promo code is valid before showing discount

**Request:**
```javascript
{
  "code": "BLACKFRIDAY",
  "plan": "club",            // Optional - to check plan applicability
  "user_id": 123             // From JWT token
}
```

**Success Response:**
```javascript
{
  "return_code": "SUCCESS",
  "valid": true,
  "promo_code": {
    "code": "BLACKFRIDAY",
    "description": "Black Friday 2025 - 30% off all plans",
    "discount_type": "percentage",
    "discount_value": 30,
    "applies_to_plans": ["club", "venue"]
  },
  "pricing": {
    "club": {
      "original": 79.00,
      "discount": 23.70,
      "final": 55.30
    },
    "venue": {
      "original": 179.00,
      "discount": 53.70,
      "final": 125.30
    }
  },
  "expires_at": "2025-11-30T23:59:59Z"  // If time-limited
}
```

**Error Responses:**
```javascript
// Invalid/non-existent code
{
  "return_code": "INVALID_CODE",
  "valid": false,
  "message": "This promo code is not valid"
}

// Expired code
{
  "return_code": "EXPIRED",
  "valid": false,
  "message": "This promo code has expired"
}

// Already used by this user
{
  "return_code": "ALREADY_USED",
  "valid": false,
  "message": "You have already used this promo code"
}

// Max uses reached
{
  "return_code": "LIMIT_REACHED",
  "valid": false,
  "message": "This promo code is no longer available"
}

// Not applicable to selected plan
{
  "return_code": "PLAN_NOT_APPLICABLE",
  "valid": false,
  "message": "This code is not valid for the Club plan"
}
```

**Validation Logic:**
```javascript
// Check 1: Code exists and is active
const code = await query(
  'SELECT * FROM promo_codes WHERE code = $1 AND active = true',
  [promoCode]
);
if (!code.rows.length) return { valid: false, return_code: 'INVALID_CODE' };

// Check 2: Time validity
const now = new Date();
if (code.valid_from && now < code.valid_from) return { valid: false, return_code: 'NOT_YET_VALID' };
if (code.valid_until && now > code.valid_until) return { valid: false, return_code: 'EXPIRED' };

// Check 3: Total usage limit
if (code.max_total_uses && code.current_total_uses >= code.max_total_uses) {
  return { valid: false, return_code: 'LIMIT_REACHED' };
}

// Check 4: User already used it?
const userUsage = await query(
  'SELECT * FROM promo_code_usage WHERE promo_code_id = $1 AND user_id = $2',
  [code.id, userId]
);
if (userUsage.rows.length >= code.max_uses_per_user) {
  return { valid: false, return_code: 'ALREADY_USED' };
}

// Check 5: Plan applicability
if (code.applies_to_plans && code.applies_to_plans.length > 0) {
  if (!code.applies_to_plans.includes(plan)) {
    return { valid: false, return_code: 'PLAN_NOT_APPLICABLE' };
  }
}

// All checks passed - calculate discount
const discount = calculateDiscount(originalPrice, code.discount_type, code.discount_value);
return { valid: true, pricing: { ... } };
```

---

### 2. Create Checkout with Promo (Modified existing endpoint)

**Endpoint:** `POST /create-checkout-session`

**Request (updated):**
```javascript
{
  "plan": "club",
  "billing_cycle": "yearly",
  "promo_code": "BLACKFRIDAY"  // NEW - optional field
}
```

**Logic:**
```javascript
let finalAmount = PLAN_PRICING[plan][billing_cycle].amount; // 7900 pence
let promoCodeId = null;
let originalPrice = finalAmount / 100;
let discountAmount = 0;

if (promo_code) {
  // Validate promo code again (security - don't trust client)
  const validation = await validatePromoCode(promo_code, plan, userId);

  if (validation.valid) {
    promoCodeId = validation.promo_code_id;
    originalPrice = finalAmount / 100;
    finalAmount = validation.pricing[plan].final * 100; // Convert back to pence
    discountAmount = validation.pricing[plan].discount;
  } else {
    // Invalid code - return error
    return res.status(200).json({
      return_code: validation.return_code,
      message: validation.message
    });
  }
}

// Create Stripe session with final amount
const session = await stripe.checkout.sessions.create({
  // ... existing config
  line_items: [{
    price_data: {
      currency: 'gbp',
      product_data: {
        name: `LMSLocal ${plan.charAt(0).toUpperCase() + plan.slice(1)} Plan`,
        description: promo_code
          ? `${billing_cycle} subscription (${promo_code} discount applied)`
          : `${billing_cycle} subscription`,
      },
      unit_amount: finalAmount, // Discounted amount in pence
    },
    quantity: 1,
  }],

  // Store promo info in metadata
  metadata: {
    user_id: userId.toString(),
    plan: plan,
    billing_cycle: billing_cycle,
    upgrade_type: 'subscription_purchase',
    promo_code: promo_code || null,
    promo_code_id: promoCodeId?.toString() || null,
    original_price: originalPrice.toString(),
    discount_amount: discountAmount.toString()
  },

  // ... rest of config
});
```

---

### 3. Webhook Update (stripe-webhook.js)

**Updated webhook processing:**

```javascript
async function processSuccessfulPayment(session) {
  const {
    user_id,
    plan,
    billing_cycle,
    promo_code,
    promo_code_id,
    original_price,
    discount_amount
  } = session.metadata;

  await transaction(async (client) => {
    // ... existing expiry calculation ...

    // 1. Insert payment record with promo info
    const insertSubscriptionQuery = `
      INSERT INTO subscription (
        user_id,
        plan_name,
        stripe_subscription_id,
        stripe_customer_id,
        paid_amount,
        promo_code_id,
        original_price,
        discount_amount,
        created_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP)
      RETURNING id
    `;

    const subscriptionResult = await client.query(insertSubscriptionQuery, [
      parseInt(user_id),
      plan,
      session.id,
      session.customer || null,
      session.amount_total / 100, // Actual amount paid
      promo_code_id ? parseInt(promo_code_id) : null,
      original_price ? parseFloat(original_price) : null,
      discount_amount ? parseFloat(discount_amount) : null
    ]);

    const subscriptionId = subscriptionResult.rows[0].id;

    // 2. Record promo code usage (if used)
    if (promo_code_id) {
      await client.query(`
        INSERT INTO promo_code_usage (
          promo_code_id,
          user_id,
          subscription_id,
          original_price,
          discount_amount,
          final_price,
          plan_purchased,
          campaign_source,
          used_at
        )
        SELECT
          $1,
          $2,
          $3,
          $4,
          $5,
          $6,
          $7,
          campaign_source,
          CURRENT_TIMESTAMP
        FROM promo_codes
        WHERE id = $1
      `, [
        parseInt(promo_code_id),
        parseInt(user_id),
        subscriptionId,
        parseFloat(original_price),
        parseFloat(discount_amount),
        session.amount_total / 100,
        plan
      ]);

      // 3. Increment usage counter
      await client.query(`
        UPDATE promo_codes
        SET current_total_uses = current_total_uses + 1,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
      `, [parseInt(promo_code_id)]);
    }

    // ... rest of existing webhook logic (update user, allowance, etc.) ...
  });
}
```

---

## Frontend Implementation

### 1. Billing Page Updates

**File:** `lmslocal-web/src/app/billing/page.tsx`

**Changes needed:**

```typescript
// Add state for promo code
const [promoCode, setPromoCode] = useState<string | null>(null);
const [promoValid, setPromoValid] = useState(false);
const [promoLoading, setPromoLoading] = useState(false);
const [promoError, setPromoError] = useState<string | null>(null);
const [discountedPrices, setDiscountedPrices] = useState<any>(null);

// Check URL params on load
useEffect(() => {
  const promo = searchParams.get('promo');
  if (promo) {
    validatePromoCode(promo);
  }
}, [searchParams]);

// Validate promo code
const validatePromoCode = async (code: string) => {
  setPromoLoading(true);
  setPromoError(null);

  try {
    const response = await userApi.validatePromoCode(code, selectedPlan);

    if (response.data.return_code === 'SUCCESS' && response.data.valid) {
      setPromoCode(code);
      setPromoValid(true);
      setDiscountedPrices(response.data.pricing);
      setPromoError(null);
    } else {
      setPromoCode(null);
      setPromoValid(false);
      setDiscountedPrices(null);
      setPromoError(response.data.message || 'Invalid promo code');
    }
  } catch (error) {
    console.error('Promo validation error:', error);
    setPromoError('Failed to validate promo code');
  } finally {
    setPromoLoading(false);
  }
};

// Update checkout handler
const handlePlanSwitch = async () => {
  // ... existing validation ...

  try {
    setLoading(true);

    const response = await userApi.createCheckoutSession(
      selectedPlan,
      'yearly',
      promoValid ? promoCode : undefined  // Pass promo code if valid
    );

    if (response.data.return_code === 'SUCCESS' && response.data.checkout_url) {
      window.location.href = response.data.checkout_url;
    } else {
      alert(response.data.message || 'Failed to create checkout session');
    }
  } catch (error) {
    // ... error handling ...
  }
};

// Display discounted price
const getDisplayPrice = (plan: 'club' | 'venue') => {
  if (promoValid && discountedPrices && discountedPrices[plan]) {
    return discountedPrices[plan].final;
  }
  return planPrices[plan];
};

const getOriginalPrice = (plan: 'club' | 'venue') => {
  if (promoValid && discountedPrices && discountedPrices[plan]) {
    return planPrices[plan];
  }
  return null;
};
```

**UI Updates:**

```tsx
{/* Success Banner - Valid promo code */}
{promoValid && promoCode && (
  <div className="mb-6 bg-emerald-50 border-2 border-emerald-500 rounded-lg p-4">
    <div className="flex items-center">
      <span className="text-2xl mr-3">🎉</span>
      <div>
        <h3 className="font-semibold text-emerald-900">
          Discount Applied: {promoCode}
        </h3>
        <p className="text-sm text-emerald-700">
          {discountedPrices?.club?.discount
            ? `Save £${discountedPrices.club.discount.toFixed(2)}!`
            : 'Special pricing activated'}
        </p>
      </div>
    </div>
  </div>
)}

{/* Error Banner - Invalid/expired promo code */}
{promoError && !promoValid && (
  <div className="mb-6 bg-red-50 border-2 border-red-500 rounded-lg p-4">
    <div className="flex items-center justify-between">
      <div className="flex items-center">
        <span className="text-2xl mr-3">⚠️</span>
        <div>
          <h3 className="font-semibold text-red-900">Invalid Promo Code</h3>
          <p className="text-sm text-red-700">{promoError}</p>
        </div>
      </div>
      <button
        onClick={() => setPromoError(null)}
        className="text-red-600 hover:text-red-800 text-xl font-bold"
      >
        ×
      </button>
    </div>
  </div>
)}

{/* Plan pricing display with strikethrough if discounted */}
<div className="text-right">
  {getOriginalPrice(plan) && (
    <div className="text-sm text-slate-400 line-through">
      £{getOriginalPrice(plan)}
    </div>
  )}
  <div className="text-2xl font-bold text-slate-900">
    £{getDisplayPrice(plan)}
  </div>
  {promoValid && discountedPrices?.[plan] && (
    <div className="text-sm text-emerald-600 font-semibold">
      Save £{discountedPrices[plan].discount.toFixed(2)}
    </div>
  )}
  <div className="text-sm text-slate-500">per year</div>
</div>
```

---

### 2. API Client Updates

**File:** `lmslocal-web/src/lib/api.ts`

```typescript
// Add to userApi object
validatePromoCode: (code: string, plan?: string) =>
  api.post<{
    return_code: string;
    valid: boolean;
    message?: string;
    promo_code?: {
      code: string;
      description: string;
      discount_type: string;
      discount_value: number;
    };
    pricing?: {
      club?: { original: number; discount: number; final: number };
      venue?: { original: number; discount: number; final: number };
    };
    expires_at?: string;
  }>('/validate-promo-code', { code, plan }),

createCheckoutSession: (plan: string, billing_cycle: string, promo_code?: string) =>
  api.post<{
    return_code: string;
    message?: string;
    checkout_url?: string;
    session_id?: string;
  }>('/create-checkout-session', { plan, billing_cycle, promo_code }),
```

---

## Admin Management

### Option 1: Direct Database (Quick Start)

Create codes directly in database:

```sql
-- Black Friday 2025: 30% off all plans, valid Nov 24-30
INSERT INTO promo_codes (
  code,
  description,
  discount_type,
  discount_value,
  applies_to_plans,
  valid_from,
  valid_until,
  max_total_uses,
  campaign_name,
  campaign_source,
  active
) VALUES (
  'BLACKFRIDAY',
  'Black Friday 2025 - 30% off all plans',
  'percentage',
  30,
  NULL, -- Applies to all plans
  '2025-11-24 00:00:00+00',
  '2025-11-30 23:59:59+00',
  100, -- Max 100 uses
  'black-friday-2025',
  'email',
  true
);

-- Early bird special: £20 off venue plan only
INSERT INTO promo_codes (
  code,
  description,
  discount_type,
  discount_value,
  applies_to_plans,
  valid_until,
  campaign_name,
  active
) VALUES (
  'EARLYBIRD20',
  'Early bird: £20 off Venue plan',
  'fixed',
  20.00,
  ARRAY['venue'], -- Only venue plan
  '2025-12-31 23:59:59+00',
  'early-bird-venue',
  true
);
```

### Option 2: Admin API Endpoints (Future)

**Create endpoints for admin panel:**

```javascript
// POST /admin/create-promo-code
// PUT /admin/update-promo-code/:id
// DELETE /admin/deactivate-promo-code/:id
// GET /admin/promo-codes (list all with stats)
// GET /admin/promo-code-analytics/:id
```

---

## Analytics & Reporting

### Query: Active Promo Codes

```sql
SELECT
  code,
  discount_type,
  discount_value,
  current_total_uses,
  max_total_uses,
  valid_until,
  campaign_name
FROM promo_codes
WHERE active = true
  AND (valid_until IS NULL OR valid_until > CURRENT_TIMESTAMP)
ORDER BY created_at DESC;
```

### Query: Promo Code Performance

```sql
SELECT
  pc.code,
  pc.campaign_name,
  pc.discount_type,
  pc.discount_value,
  COUNT(pcu.id) as total_uses,
  SUM(pcu.discount_amount) as total_discount_given,
  SUM(pcu.final_price) as total_revenue,
  AVG(pcu.discount_amount) as avg_discount,
  COUNT(DISTINCT pcu.user_id) as unique_users
FROM promo_codes pc
LEFT JOIN promo_code_usage pcu ON pc.id = pcu.promo_code_id
WHERE pc.code = 'BLACKFRIDAY'
GROUP BY pc.id, pc.code, pc.campaign_name, pc.discount_type, pc.discount_value;
```

### Query: Revenue Impact by Campaign

```sql
SELECT
  pc.campaign_name,
  pc.campaign_source,
  COUNT(pcu.id) as conversions,
  SUM(pcu.original_price) as potential_revenue,
  SUM(pcu.final_price) as actual_revenue,
  SUM(pcu.discount_amount) as discount_cost,
  ROUND(
    (SUM(pcu.discount_amount) / SUM(pcu.original_price) * 100)::numeric,
    2
  ) as avg_discount_percentage
FROM promo_codes pc
INNER JOIN promo_code_usage pcu ON pc.id = pcu.promo_code_id
WHERE pcu.used_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY pc.campaign_name, pc.campaign_source
ORDER BY conversions DESC;
```

### Query: Plan-Specific Conversion

```sql
SELECT
  pc.code,
  pcu.plan_purchased,
  COUNT(*) as purchases,
  AVG(pcu.discount_amount) as avg_discount,
  SUM(pcu.final_price) as total_revenue
FROM promo_code_usage pcu
JOIN promo_codes pc ON pcu.promo_code_id = pc.id
WHERE pcu.used_at >= '2025-01-01'
GROUP BY pc.code, pcu.plan_purchased
ORDER BY pc.code, pcu.plan_purchased;
```

---

## Campaign Examples

### 1. Black Friday Email Campaign

**Setup:**
```sql
INSERT INTO promo_codes (code, discount_type, discount_value, valid_from, valid_until, campaign_name, campaign_source)
VALUES ('BF2025', 'percentage', 30, '2025-11-24 00:00:00', '2025-11-30 23:59:59', 'black-friday-2025', 'email');
```

**Email:**
```
Subject: 🎉 Black Friday: 30% off Club & Venue plans

Click here to upgrade: https://lmslocal.co.uk/billing?promo=BF2025

Offer ends Monday 11:59pm.
```

**Tracking:**
- How many people clicked the link (from email analytics)
- How many saw the billing page (from server logs)
- How many completed purchase (from promo_code_usage table)
- Total revenue & discount given

---

### 2. Partner Referral Campaign

**Setup:**
```sql
INSERT INTO promo_codes (code, discount_type, discount_value, campaign_name, campaign_source, max_total_uses)
VALUES ('PARTNER15', 'percentage', 15, 'pub-industry-newsletter', 'partner', 50);
```

**Partner Newsletter:**
```
Special offer for our readers: 15% off
https://lmslocal.co.uk/billing?promo=PARTNER15
```

**Tracking:**
- Exactly 50 uses allowed
- Attribution to "partner" source
- ROI: Did the partnership fee < revenue generated?

---

### 3. Seasonal "Start of Season" Promotion

**Setup:**
```sql
INSERT INTO promo_codes (code, discount_type, discount_value, valid_from, valid_until, campaign_name)
VALUES ('KICKOFF2025', 'percentage', 20, '2025-08-01', '2025-08-31', 'season-kickoff-2025');
```

**Social Media Post:**
```
⚽ Season starting soon? Get 20% off: lmslocal.co.uk/billing?promo=KICKOFF2025
```

---

### 4. Win-Back Campaign (Expired Free Users)

**Setup:**
```sql
INSERT INTO promo_codes (code, discount_type, discount_value, valid_until, max_uses_per_user, campaign_name)
VALUES ('WELCOMEBACK', 'fixed', 15, '2025-12-31', 1, 'win-back-expired-free');
```

**Email to users who haven't upgraded:**
```
We miss you! Here's £15 off: https://lmslocal.co.uk/billing?promo=WELCOMEBACK
```

---

## Security Considerations

### 1. Rate Limiting

Prevent brute-force guessing of promo codes:

```javascript
// In validate-promo-code endpoint
const rateLimitKey = `promo-validate:${userId}:${ip}`;
const attempts = await redis.incr(rateLimitKey);
await redis.expire(rateLimitKey, 60); // 1 minute window

if (attempts > 5) {
  return res.status(429).json({
    return_code: 'RATE_LIMITED',
    message: 'Too many attempts. Please try again later.'
  });
}
```

### 2. Server-Side Validation

ALWAYS validate promo codes server-side in checkout:

```javascript
// NEVER trust client-sent discount amounts
// ALWAYS recalculate on server
const validation = await validatePromoCode(promo_code, plan, userId);
if (!validation.valid) {
  return res.status(200).json({
    return_code: 'INVALID_PROMO',
    message: 'Promo code is not valid'
  });
}
```

### 3. Prevent Code Sharing Exploits

If a code is meant to be single-use per user:

```sql
-- Check in validation query
SELECT COUNT(*)
FROM promo_code_usage
WHERE promo_code_id = $1 AND user_id = $2;

-- If count >= max_uses_per_user, reject
```

### 4. Audit Trail

Log all promo code attempts (valid and invalid):

```sql
CREATE TABLE promo_code_attempts (
  id SERIAL PRIMARY KEY,
  code_attempted VARCHAR(50),
  user_id INTEGER,
  ip_address INET,
  success BOOLEAN,
  error_reason VARCHAR(100),
  attempted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## Expiry Management

### Automatic Expiry

Codes automatically expire based on `valid_until` timestamp. No manual intervention needed.

### Scheduled Cleanup (Optional)

Archive expired codes monthly:

```sql
-- Move to archive table (optional)
INSERT INTO promo_codes_archive
SELECT * FROM promo_codes
WHERE valid_until < CURRENT_TIMESTAMP - INTERVAL '90 days';

-- Or just deactivate
UPDATE promo_codes
SET active = false
WHERE valid_until < CURRENT_TIMESTAMP;
```

### Email Notifications

Send admin email when popular codes are about to expire:

```javascript
// Cron job: Check daily for codes expiring in 3 days
const expiringCodes = await query(`
  SELECT * FROM promo_codes
  WHERE active = true
    AND valid_until BETWEEN CURRENT_TIMESTAMP AND CURRENT_TIMESTAMP + INTERVAL '3 days'
    AND current_total_uses > 10
`);

if (expiringCodes.rows.length > 0) {
  // Send email to admin
  await sendEmail(admin@lmslocal.co.uk, {
    subject: 'Promo codes expiring soon',
    body: `The following codes expire in 3 days: ${expiringCodes.rows.map(c => c.code).join(', ')}`
  });
}
```

---

## Testing Plan

### 1. Manual Testing Checklist

- [ ] Valid code applies discount correctly
- [ ] Expired code shows error
- [ ] Invalid code shows error
- [ ] Already-used code (per user) shows error
- [ ] Max uses reached shows error
- [ ] Plan-specific code only works for correct plan
- [ ] URL parameter auto-applies code on page load
- [ ] Discount shows in Stripe checkout
- [ ] Webhook records usage correctly
- [ ] Usage counter increments
- [ ] Billing history shows discount

### 2. Test Codes

Create test codes for development:

```sql
-- Test code: 50% off, no expiry, unlimited uses
INSERT INTO promo_codes (code, discount_type, discount_value, campaign_name, active)
VALUES ('TEST50', 'percentage', 50, 'test-code', true);

-- Test code: £10 off, expires soon
INSERT INTO promo_codes (code, discount_type, discount_value, valid_until, campaign_name, active)
VALUES ('TEST10', 'fixed', 10, CURRENT_TIMESTAMP + INTERVAL '1 hour', 'test-expiry', true);

-- Test code: Single use
INSERT INTO promo_codes (code, discount_type, discount_value, max_total_uses, campaign_name, active)
VALUES ('TESTONCE', 'percentage', 25, 1, 'test-single-use', true);
```

### 3. Edge Cases to Test

- [ ] Code is case-insensitive (convert to uppercase in validation)
- [ ] Whitespace trimming in code input
- [ ] Discount exceeds plan price (£200 off £79 plan)
- [ ] Negative discount values (blocked by constraint)
- [ ] Percentage > 100% (blocked by constraint)
- [ ] Concurrent usage (race condition on max_uses)
- [ ] User tries to use code twice in different sessions
- [ ] Promo code applied but user changes plan selection
- [ ] URL promo parameter with invalid/expired code

---

## Migration Path

### Phase 1: Database Setup
1. Create `promo_codes` table
2. Create `promo_code_usage` table
3. Update `subscription` table with new columns
4. Create indexes

### Phase 2: Backend API
1. Create `/validate-promo-code` endpoint
2. Update `/create-checkout-session` to accept promo code
3. Update `stripe-webhook.js` to record usage
4. Add rate limiting

### Phase 3: Frontend Integration
1. Update billing page to detect `?promo=` URL parameter
2. Add promo validation logic
3. Update pricing display with strikethrough
4. Update checkout flow to pass promo code

### Phase 4: Testing & Launch
1. Create test promo codes
2. Test full flow (URL → validation → checkout → webhook)
3. Launch first campaign (small scale)
4. Monitor analytics

### Phase 5: Analytics & Optimization
1. Build admin dashboard for promo code stats
2. Set up automated reports
3. Optimize based on conversion data

---

## Estimated Development Time

- Database schema: 1 hour
- Backend API: 3-4 hours
- Frontend integration: 2-3 hours
- Testing: 2 hours
- **Total: 8-10 hours**

---

## Cost Considerations

**Discount Budget:**
- Black Friday (30% off, 100 uses): £79 → £55.30 = £23.70 discount × 100 = **£2,370 cost**
- But you gain 100 new paying customers = £5,530 revenue
- **Net gain: £3,160**

**ROI Calculation:**
```
Without promo: 50 conversions × £79 = £3,950
With 30% promo: 100 conversions × £55.30 = £5,530
Difference: £5,530 - £3,950 = £1,580 additional revenue
```

(Assumes 30% discount doubles conversion rate)

---

## Next Steps

1. Review this implementation plan
2. Decide on Phase 1 scope (MVP vs full features)
3. Approve database schema
4. Schedule development sprint
5. Plan first campaign (good test case)

---

**Questions to Discuss:**
- Which campaign would you run first? (Black Friday, seasonal, partner, etc.)
- What discount percentages feel right? (10%, 20%, 30%?)
- Do you want admin UI for managing codes, or database-only initially?
- Any specific tracking/analytics you want to see?
