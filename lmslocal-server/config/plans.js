/*
=======================================================================================================================================
Shared Plan Configuration
=======================================================================================================================================
Centralized configuration for subscription plan limits and pricing.
Used across multiple routes to ensure consistency.
=======================================================================================================================================
*/

// Plan limits - maximum players allowed per subscription plan
const PLAN_LIMITS = {
  free: 20,
  club: 50,
  venue: 200
};

// Plan pricing - annual pricing structure (£)
const PLAN_PRICING = {
  free: 0,
  club: 79,
  venue: 179
};

module.exports = {
  PLAN_LIMITS,
  PLAN_PRICING
};