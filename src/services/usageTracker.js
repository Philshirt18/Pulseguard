/**
 * PulseGuard — Usage Tracking Service
 *
 * Tracks AI operations per workspace per month.
 * Enforces plan limits before every AI call.
 *
 * Storage: in-memory Map (suitable for demo and single-instance deployments).
 * Production upgrade path: swap _store with a DB-backed implementation
 * (Vercel KV, Redis, DynamoDB) without changing any calling code.
 *
 * Every tracked operation records:
 *   - workspaceId   — Slack team/enterprise ID (non-sensitive identifier)
 *   - userId        — Slack user ID who triggered the operation
 *   - operation     — string key (e.g. 'root_cause_analysis')
 *   - model         — OpenAI model used
 *   - tokensUsed    — token count if available from API response
 *   - estimatedCost — USD estimate based on known model pricing
 *   - success       — whether the AI call succeeded
 *   - timestamp     — ISO timestamp
 */

const { getPlan } = require('./plans');

// ---------------------------------------------------------------------------
// In-memory store
// Key: `${workspaceId}:${yearMonth}` → { operations: UsageRecord[], count: number }
// ---------------------------------------------------------------------------
const _store = new Map();

// Approximate cost per 1k tokens (input+output blended) in USD.
// Update when OpenAI pricing changes.
const MODEL_COST_PER_1K = {
  'gpt-4o': 0.005,
  'gpt-4o-mini': 0.00015,
  'gpt-4-turbo': 0.015,
  'gpt-4': 0.03,
  'gpt-3.5-turbo': 0.0005,
};

/**
 * Returns the current year-month string used as the billing period key.
 * e.g. "2025-07"
 */
function currentPeriod() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Estimates cost in USD for a given model and token count.
 */
function estimateCost(model, tokensUsed) {
  if (!tokensUsed) return 0;
  const rate = MODEL_COST_PER_1K[model] || MODEL_COST_PER_1K['gpt-4o-mini'];
  return parseFloat(((tokensUsed / 1000) * rate).toFixed(6));
}

/**
 * Returns the usage record bucket for a workspace + period.
 * Creates it if it doesn't exist.
 */
function getBucket(workspaceId, period) {
  const key = `${workspaceId}:${period}`;
  if (!_store.has(key)) {
    _store.set(key, { count: 0, operations: [], totalTokens: 0, totalCost: 0 });
  }
  return _store.get(key);
}

/**
 * Records a completed AI operation.
 *
 * @param {object} params
 * @param {string} params.workspaceId
 * @param {string} params.userId
 * @param {string} params.operation    e.g. 'root_cause_analysis'
 * @param {string} params.model        e.g. 'gpt-4o-mini'
 * @param {number} [params.tokensUsed]
 * @param {boolean} params.success
 * @param {string} [params.error]      error message if !success
 */
function record({ workspaceId, userId, operation, model, tokensUsed, success, error }) {
  const period = currentPeriod();
  const bucket = getBucket(workspaceId, period);
  const cost = estimateCost(model, tokensUsed);

  const entry = {
    workspaceId,
    userId,
    operation,
    model,
    tokensUsed: tokensUsed || 0,
    estimatedCostUsd: cost,
    success,
    error: error || null,
    timestamp: new Date().toISOString(),
  };

  bucket.operations.push(entry);
  if (success) {
    bucket.count += 1;
    bucket.totalTokens += tokensUsed || 0;
    bucket.totalCost += cost;
  }
}

/**
 * Returns usage summary for a workspace in the current billing period.
 *
 * @param {string} workspaceId
 * @returns {{ count: number, totalTokens: number, totalCostUsd: number, period: string }}
 */
function getUsage(workspaceId) {
  const period = currentPeriod();
  const bucket = getBucket(workspaceId, period);
  return {
    workspaceId,
    period,
    count: bucket.count,
    totalTokens: bucket.totalTokens,
    totalCostUsd: parseFloat(bucket.totalCost.toFixed(6)),
    operationBreakdown: _summariseOperations(bucket.operations),
  };
}

/**
 * Returns whether a workspace can perform another AI operation
 * given its current plan.
 *
 * @param {string} workspaceId
 * @param {string} planId  — 'free' | 'pro' | 'business'
 * @returns {{ allowed: boolean, reason?: string, used: number, limit: number }}
 */
function checkLimit(workspaceId, planId) {
  const plan = getPlan(planId);
  const period = currentPeriod();
  const bucket = getBucket(workspaceId, period);
  const used = bucket.count;
  const limit = plan.monthlyAiOperations;

  if (used >= limit) {
    return {
      allowed: false,
      reason: `Monthly AI operation limit reached (${used}/${limit} on the ${plan.name} plan). Upgrade to continue.`,
      used,
      limit,
      plan: plan.name,
    };
  }

  return { allowed: true, used, limit, plan: plan.name };
}

/**
 * Checks the limit and records the operation atomically.
 * Use this as a single call before every AI operation.
 *
 * Returns { allowed, reason, used, limit } — if allowed is false,
 * the caller MUST NOT proceed with the AI call.
 *
 * @param {object} params — same as record() plus planId
 */
async function checkAndRecord({ workspaceId, userId, operation, model, planId, tokensUsed, success, error }) {
  const check = checkLimit(workspaceId, planId);
  if (!check.allowed) return check;

  record({ workspaceId, userId, operation, model, tokensUsed, success, error });
  return { ...check, allowed: true };
}

/**
 * Convenience: get how many operations remain this month.
 */
function getRemainingOperations(workspaceId, planId) {
  const { used, limit } = checkLimit(workspaceId, planId);
  return Math.max(0, limit - used);
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function _summariseOperations(operations) {
  const summary = {};
  for (const op of operations) {
    if (!op.success) continue;
    summary[op.operation] = (summary[op.operation] || 0) + 1;
  }
  return summary;
}

module.exports = {
  record,
  getUsage,
  checkLimit,
  checkAndRecord,
  getRemainingOperations,
  currentPeriod,
  estimateCost,
  // Exposed for testing
  _store,
};
