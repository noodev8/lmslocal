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
  lite: 20,
  starter: 100,
  pro: 300
};

// Plan pricing - annual pricing structure (£)
const PLAN_PRICING = {
  lite: 0,
  starter: 199,
  pro: 249
};

module.exports = {
  PLAN_LIMITS,
  PLAN_PRICING
};