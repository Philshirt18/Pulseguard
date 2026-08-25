/**
 * PulseGuard — Plan Definitions
 *
 * Single source of truth for plan limits and feature flags.
 * All values are configurable — do NOT hard-code plan limits
 * anywhere else in the application.
 *
 * Pricing is intentionally kept separate from feature limits
 * so it can change without touching business logic.
 */

const PLANS = {
  free: {
    id: 'free',
    name: 'Free',
    monthlyAiOperations: parseInt(process.env.PLAN_FREE_AI_OPS || '10', 10),
    features: {
      riskDetection: true,
      aiNarrative: true,
      aiRecommendations: true,
      mcpAccess: false,
      proactiveAlerts: false,
      multiWorkspace: false,
    },
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    monthlyAiOperations: parseInt(process.env.PLAN_PRO_AI_OPS || '200', 10),
    features: {
      riskDetection: true,
      aiNarrative: true,
      aiRecommendations: true,
      mcpAccess: true,
      proactiveAlerts: true,
      multiWorkspace: false,
    },
  },
  business: {
    id: 'business',
    name: 'Business',
    monthlyAiOperations: parseInt(process.env.PLAN_BUSINESS_AI_OPS || '1000', 10),
    features: {
      riskDetection: true,
      aiNarrative: true,
      aiRecommendations: true,
      mcpAccess: true,
      proactiveAlerts: true,
      multiWorkspace: true,
    },
  },
};

/**
 * Returns plan definition for a given plan ID.
 * Defaults to 'free' if planId is unknown.
 */
function getPlan(planId) {
  return PLANS[planId] || PLANS.free;
}

/**
 * Returns all plan definitions (useful for upgrade prompts).
 */
function getAllPlans() {
  return Object.values(PLANS);
}

module.exports = { PLANS, getPlan, getAllPlans };
