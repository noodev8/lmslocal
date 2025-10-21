/*
=======================================================================================================================================
Configuration: Credit Packs
=======================================================================================================================================
Purpose: Defines pricing and metadata for PAYG credit pack purchases

Each pack includes:
- pack_type: Unique identifier (e.g., 'starter_10', 'popular_50', 'value_200')
- credits: Number of player slots included in the pack
- price_gbp / price_pence: Price in pounds and pence
- name: Display name for the pack
- description: Marketing description
- per_credit_cost: Cost per slot (calculated value)
- savings_percent: Discount percentage vs baseline starter pack (optional)
- badge: Display badge text shown on pricing cards (optional)

Usage:
const { CREDIT_PACKS } = require('../config/credit-packs');
const pack = CREDIT_PACKS.starter_10;
console.log(pack.price_gbp); // Access pricing data
console.log(pack.credits);   // Access slot count

Note: This is the single source of truth for all pricing. Frontend and backend both reference this file.
=======================================================================================================================================
*/

const CREDIT_PACKS = {
  starter_10: {
    pack_type: 'starter_10',
    credits: 10,
    price_gbp: 10,
    price_pence: 1000,
    name: 'Starter Pack',
    description: '10 slots - Perfect for small groups',
    per_credit_cost: 1.00,
    badge: null
  },
  popular_50: {
    pack_type: 'popular_50',
    credits: 40,
    price_gbp: 25,
    price_pence: 2500,
    name: 'Popular Pack',
    description: '40 slots - Great value',
    per_credit_cost: 0.625,
    savings_percent: 37,
    badge: 'SAVE 37%'
  },
  value_200: {
    pack_type: 'value_200',
    credits: 120,
    price_gbp: 40,
    price_pence: 4000,
    name: 'Best Value Pack',
    description: '120 slots - Maximum savings',
    per_credit_cost: 0.33,
    savings_percent: 67,
    badge: 'SAVE 67%'
  }
};

module.exports = {
  CREDIT_PACKS
};
