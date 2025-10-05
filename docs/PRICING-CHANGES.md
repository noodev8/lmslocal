# Pricing Changes Guide

This document outlines **ALL locations** that must be updated when changing pricing for LMSLocal subscription plans.

## Current Pricing Structure

- **Free Plan**: £0/year (20 players max)
- **Club Plan**: £79/year (50 players max)
- **Venue Plan**: £179/year (200 players max)

**Billing Model**: One-time yearly payment (no auto-renewal)

---

## Files to Update When Changing Prices

### 1. **Backend - Stripe Checkout Session**
**File**: `lmslocal-server/routes/create-checkout-session.js`

**Location**: Lines 53-65
```javascript
const PLAN_PRICING = {
  club: {
    yearly: {
      amount: 7900, // £79.00 in pence ⚠️ UPDATE THIS
    }
  },
  venue: {
    yearly: {
      amount: 17900, // £179.00 in pence ⚠️ UPDATE THIS
    }
  }
};
```

**Why**: This sets the actual charge amount in Stripe checkout
**Format**: Amount must be in **pence** (£79 = 7900 pence)

---

### 2. **Backend - Stripe Webhook Payment Processing**
**File**: `lmslocal-server/routes/stripe-webhook.js`

**Location**: Lines 74-79
```javascript
// Calculate payment amount based on plan and cycle
const planPricing = {
  club: { yearly: 79.00 },    // ⚠️ UPDATE THIS
  venue: { yearly: 179.00 }   // ⚠️ UPDATE THIS
};
const paidAmount = planPricing[plan]?.[billing_cycle] || 0;
```

**Why**: Records the correct payment amount in the `subscription` database table
**Format**: Amount in **pounds** (£79.00, not pence)
**Critical**: Must match checkout session amounts exactly

---

### 3. **Backend - Plan Configuration**
**File**: `lmslocal-server/config/plans.js`

**Location**: Lines 17-22
```javascript
const PLAN_PRICING = {
  free: 0,
  club: 79,     // ⚠️ UPDATE THIS
  venue: 179    // ⚠️ UPDATE THIS
};
```

**Why**: Shared configuration used across multiple backend routes
**Format**: Amount in **pounds** (whole numbers)

---

### 4. **Frontend - Public Pricing Page**
**File**: `lmslocal-web/src/app/pricing/page.tsx`

**Location**: Multiple locations (~lines 65-120)

**Club Plan Display**:
```tsx
<span className="text-5xl font-bold text-slate-900">£79</span>  {/* ⚠️ UPDATE THIS */}
<p className="text-sm text-emerald-600 font-semibold mb-6">
  £1.58 per player per year  {/* ⚠️ UPDATE THIS - Calculate: £79 ÷ 50 players */}
</p>
```

**Venue Plan Display**:
```tsx
<span className="text-5xl font-bold">£179</span>  {/* ⚠️ UPDATE THIS */}
<p className="text-sm text-emerald-400 font-semibold mb-6">
  Just 90p per player per year  {/* ⚠️ UPDATE THIS - Calculate: £179 ÷ 200 players */}
</p>
```

**Split Cost Examples** (if 10 pubs split cost):
```tsx
{/* Club tier split example */}
£7.90 each  {/* ⚠️ UPDATE THIS - Calculate: £79 ÷ 10 */}

{/* Venue tier split example */}
£17.90 each  {/* ⚠️ UPDATE THIS - Calculate: £179 ÷ 10 */}
```

**Why**: Public-facing page customers see before signing up
**Note**: Update both the price AND the per-player/split cost calculations

---

### 5. **Frontend - User Billing Dashboard**
**File**: `lmslocal-web/src/app/billing/page.tsx`

**Location**: Lines 71-75
```javascript
const planPrices = {
  free: 0,
  club: 79,     // ⚠️ UPDATE THIS
  venue: 179    // ⚠️ UPDATE THIS
};
```

**Location**: Lines 199-202 (Current plan display)
```tsx
£{subscription.plan === 'free' ? '0' :
   subscription.plan === 'club' ? '79' : '179'}  {/* ⚠️ UPDATE THESE */}
```

**Location**: Lines 270-271 (Plan selection cards)
```tsx
<div className="font-bold">
  £{planPrices[plan]}  {/* Uses planPrices object above */}
</div>
```

**Why**: Shows users their current plan cost and upgrade options
**Note**: Two locations to update - the `planPrices` object AND the display logic

---

## Quick Reference: Price Format by Location

| Location | Format | Example (£79) |
|----------|--------|---------------|
| `create-checkout-session.js` | Pence (integer) | `7900` |
| `stripe-webhook.js` | Pounds (decimal) | `79.00` |
| `config/plans.js` | Pounds (integer) | `79` |
| `pricing/page.tsx` | Pounds (integer) | `79` |
| `billing/page.tsx` | Pounds (integer) | `79` |

---

## Calculation Reference

When updating pricing, you may need to recalculate:

### Per-Player Costs:
- **Club**: `£[PRICE] ÷ 50 players` = per player cost
- **Venue**: `£[PRICE] ÷ 200 players` = per player cost

### Split Costs (10-way split example):
- **Club**: `£[PRICE] ÷ 10` = cost per pub
- **Venue**: `£[PRICE] ÷ 10` = cost per pub

---

## Stripe Dashboard Configuration

**Current Implementation**: Uses **dynamic pricing** (creates prices on-the-fly)

- ✅ **No Stripe Dashboard updates required** when changing prices
- ✅ Price changes take effect immediately after code deployment
- ✅ No need to create/update Stripe Price IDs or Products

**How it works**: The `create-checkout-session.js` route uses `price_data` object (lines 128-135) which dynamically creates prices during checkout instead of referencing pre-created Stripe products.

---

## Testing Checklist

After updating pricing, verify these pages/features:

- [ ] Public pricing page displays correct prices (`/pricing`)
- [ ] Billing dashboard shows correct current plan price (`/billing`)
- [ ] Billing dashboard shows correct upgrade prices (`/billing`)
- [ ] Per-player costs are accurate on pricing page
- [ ] Split cost examples are accurate (if applicable)
- [ ] Stripe checkout shows correct amount (test in Stripe test mode)
- [ ] Webhook records correct `paid_amount` in database
- [ ] Payment confirmation email shows correct amount
- [ ] Billing history table displays correct amounts

---

## Database Impact

Price changes affect these database tables:

**`subscription` table** (via webhook):
- `paid_amount` - Recorded payment amount
- Set by: `stripe-webhook.js` (line 92)

**`app_user` table** (via webhook):
- `subscription_plan` - Plan name (club/venue/free)
- `subscription_expiry` - Expiry date (12 months from payment)

**`user_allowance` table** (via webhook):
- `max_players` - Player limit based on plan
- **Note**: Player limits are NOT tied to pricing - these are set in `config/plans.js` under `PLAN_LIMITS`

---

## Common Mistakes to Avoid

❌ **Forgetting to convert pounds to pence** in `create-checkout-session.js`
  - £79 must be `7900` (not `79`)

❌ **Mismatched amounts** between checkout and webhook
  - Checkout: `7900` pence
  - Webhook: `79.00` pounds
  - These must represent the same amount!

❌ **Only updating frontend** - Stripe will still charge old amount
  - Must update BOTH frontend display AND backend Stripe integration

❌ **Forgetting per-player calculations** on pricing page
  - Update both the price AND the "per player" text

❌ **Not testing the webhook** after changes
  - Use Stripe CLI to test webhooks locally: `stripe listen --forward-to localhost:3015/stripe-webhook`

---

## Plan Limits vs Pricing

**Important**: Player limits and pricing are **separate configurations**

**To change player limits**: Update `lmslocal-server/config/plans.js`
```javascript
const PLAN_LIMITS = {
  free: 20,
  club: 50,
  venue: 200
};
```

**To change pricing**: Follow this guide (5 file locations)

**Both must be updated if**:
- You're changing the plan structure entirely
- You're adding/removing a plan tier
- You're changing what's included in a plan

---

## Version History

| Date | Club Price | Venue Price | Notes |
|------|------------|-------------|-------|
| 2025-10-05 | £79 | £179 | Current pricing - allows for offers/commission |
| Previous | £49 | £149 | Original pricing |

---

## Questions?

If you need to change pricing in the future, follow these 5 steps:

1. Update `create-checkout-session.js` (Stripe charge amount in pence)
2. Update `stripe-webhook.js` (Payment record amount in pounds)
3. Update `config/plans.js` (Shared configuration)
4. Update `pricing/page.tsx` (Public page + calculations)
5. Update `billing/page.tsx` (User dashboard)

**Remember**: Test in Stripe test mode before deploying to production!
