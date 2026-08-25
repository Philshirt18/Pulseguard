/**
 * PulseGuard — Billing Service
 *
 * Clean abstraction over subscription management.
 * Stripe is NOT connected yet — this defines the interface
 * so Stripe can be wired in later without changing any
 * business logic in the rest of the application.
 *
 * Current behaviour:
 *   - All workspaces default to the FREE plan
 *   - Plan overrides can be set via PLAN_OVERRIDE_<TEAM_ID>=pro env vars
 *     (useful for manual upgrades during beta)
 *   - Stripe webhook handler stub is included, ready to be connected
 *
 * To add Stripe later:
 *   1. npm install stripe
 *   2. Set STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET env vars
 *   3. Replace the stub methods below with real Stripe API calls
 *   4. Add POST /stripe/webhook route in vercel.json + api/
 *   5. No other files need to change
 */

const { getPlan } = require('./plans');
const usageTracker = require('./usageTracker');

// ---------------------------------------------------------------------------
// In-memory subscription store
// Production upgrade: replace with DB (Vercel KV, Postgres, etc.)
// ---------------------------------------------------------------------------
const _subscriptions = new Map();

/**
 * Subscription shape:
 * {
 *   workspaceId: string,
 *   planId: 'free' | 'pro' | 'business',
 *   status: 'active' | 'past_due' | 'cancelled' | 'trialing',
 *   stripeCustomerId: string | null,
 *   stripeSubscriptionId: string | null,
 *   currentPeriodEnd: string | null,   // ISO date
 *   createdAt: string,
 *   updatedAt: string,
 * }
 */

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Returns the current subscription for a workspace.
 * If no subscription exists, returns a default FREE subscription.
 *
 * @param {string} workspaceId
 * @returns {object} subscription
 */
function getSubscription(workspaceId) {
  if (_subscriptions.has(workspaceId)) {
    return _subscriptions.get(workspaceId);
  }

  // Check for manual plan override via env var (e.g. PLAN_OVERRIDE_T01234567=pro)
  const override = process.env[`PLAN_OVERRIDE_${workspaceId}`];
  const planId = override && ['free', 'pro', 'business'].includes(override) ? override : 'free';

  return _buildSubscription(workspaceId, planId);
}

/**
 * Returns the plan definition for a workspace.
 *
 * @param {string} workspaceId
 * @returns {object} plan from plans.js
 */
function getPlanForWorkspace(workspaceId) {
  const sub = getSubscription(workspaceId);
  return getPlan(sub.planId);
}

/**
 * Checks whether a workspace is entitled to a specific feature.
 *
 * @param {string} workspaceId
 * @param {string} feature  — key from plan.features
 * @returns {boolean}
 */
function checkEntitlement(workspaceId, feature) {
  const plan = getPlanForWorkspace(workspaceId);
  return plan.features[feature] === true;
}

/**
 * Checks whether the workspace can perform another AI operation
 * and records it if allowed.
 *
 * Returns { allowed, reason, used, limit, plan }
 *
 * @param {object} params
 * @param {string} params.workspaceId
 * @param {string} params.userId
 * @param {string} params.operation
 * @param {string} params.model
 * @param {number} [params.tokensUsed]
 * @param {boolean} [params.success]
 * @param {string}  [params.error]
 */
async function recordUsage({ workspaceId, userId, operation, model, tokensUsed, success = true, error }) {
  const sub = getSubscription(workspaceId);

  // Subscriptions that are past_due or cancelled still get usage checked
  // against their plan limits (no free pass for expired subs)
  const result = await usageTracker.checkAndRecord({
    workspaceId,
    userId,
    operation,
    model,
    planId: sub.planId,
    tokensUsed,
    success,
    error,
  });

  return result;
}

/**
 * Returns a full billing summary for a workspace.
 * Useful for admin commands or health checks.
 *
 * @param {string} workspaceId
 * @returns {object}
 */
function getBillingSummary(workspaceId) {
  const sub = getSubscription(workspaceId);
  const plan = getPlan(sub.planId);
  const usage = usageTracker.getUsage(workspaceId);
  const remaining = usageTracker.getRemainingOperations(workspaceId, sub.planId);

  return {
    workspaceId,
    plan: plan.name,
    planId: sub.planId,
    status: sub.status,
    usage: {
      period: usage.period,
      operationsUsed: usage.count,
      operationsLimit: plan.monthlyAiOperations,
      operationsRemaining: remaining,
      totalTokens: usage.totalTokens,
      estimatedCostUsd: usage.totalCostUsd,
      breakdown: usage.operationBreakdown,
    },
    stripe: {
      customerId: sub.stripeCustomerId,
      subscriptionId: sub.stripeSubscriptionId,
      currentPeriodEnd: sub.currentPeriodEnd,
    },
  };
}

// ---------------------------------------------------------------------------
// Stripe webhook handler (stub — ready to be implemented)
// ---------------------------------------------------------------------------

/**
 * Processes an incoming Stripe webhook event.
 * Wire this to POST /stripe/webhook in vercel.json.
 *
 * @param {object} event  — raw Stripe event object (after signature verification)
 */
async function handleStripeWebhook(event) {
  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object;
      const workspaceId = session.metadata?.workspaceId;
      const planId = session.metadata?.planId;
      if (workspaceId && planId) {
        _upsertSubscription(workspaceId, {
          planId,
          status: 'active',
          stripeCustomerId: session.customer,
          stripeSubscriptionId: session.subscription,
        });
      }
      break;
    }

    case 'customer.subscription.updated': {
      const sub = event.data.object;
      const workspaceId = sub.metadata?.workspaceId;
      if (workspaceId) {
        _upsertSubscription(workspaceId, {
          planId: _stripePriceIdToPlanId(sub.items?.data?.[0]?.price?.id),
          status: sub.status,
          stripeSubscriptionId: sub.id,
          currentPeriodEnd: new Date(sub.current_period_end * 1000).toISOString(),
        });
      }
      break;
    }

    case 'customer.subscription.deleted': {
      const sub = event.data.object;
      const workspaceId = sub.metadata?.workspaceId;
      if (workspaceId) {
        _upsertSubscription(workspaceId, {
          planId: 'free',
          status: 'cancelled',
          stripeSubscriptionId: null,
          currentPeriodEnd: null,
        });
      }
      break;
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object;
      const workspaceId = invoice.subscription_details?.metadata?.workspaceId;
      if (workspaceId) {
        _upsertSubscription(workspaceId, { status: 'past_due' });
      }
      break;
    }

    default:
      // Unhandled event types are intentionally ignored
      break;
  }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function _buildSubscription(workspaceId, planId = 'free') {
  return {
    workspaceId,
    planId,
    status: 'active',
    stripeCustomerId: null,
    stripeSubscriptionId: null,
    currentPeriodEnd: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function _upsertSubscription(workspaceId, updates) {
  const existing = _subscriptions.get(workspaceId) || _buildSubscription(workspaceId);
  const updated = { ...existing, ...updates, updatedAt: new Date().toISOString() };
  _subscriptions.set(workspaceId, updated);
  return updated;
}

/**
 * Maps a Stripe price ID to a plan ID.
 * Update this map when Stripe products are created.
 */
function _stripePriceIdToPlanId(priceId) {
  const map = {
    [process.env.STRIPE_PRICE_PRO]: 'pro',
    [process.env.STRIPE_PRICE_BUSINESS]: 'business',
  };
  return map[priceId] || 'free';
}

module.exports = {
  getSubscription,
  getPlanForWorkspace,
  checkEntitlement,
  recordUsage,
  getBillingSummary,
  handleStripeWebhook,
  // Exposed for testing
  _subscriptions,
  _upsertSubscription,
};
