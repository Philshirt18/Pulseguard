/**
 * Tests — Usage Tracking Service
 *
 * Covers: operation recording, plan limit enforcement, cost estimation,
 * period keys, and the checkAndRecord convenience method.
 */

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

process.env.DEMO_MODE = 'true';

const tracker = require('../src/services/usageTracker');

// Helper: clear the in-memory store between tests
function clearStore() {
  tracker._store.clear();
}

describe('usageTracker', () => {
  beforeEach(() => clearStore());

  describe('currentPeriod()', () => {
    it('returns a YYYY-MM string', () => {
      const period = tracker.currentPeriod();
      assert.match(period, /^\d{4}-\d{2}$/, 'should be YYYY-MM format');
    });

    it('matches the current year and month', () => {
      const period = tracker.currentPeriod();
      const now = new Date();
      const expected = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      assert.equal(period, expected);
    });
  });

  describe('estimateCost()', () => {
    it('returns 0 when tokensUsed is 0', () => {
      assert.equal(tracker.estimateCost('gpt-4o-mini', 0), 0);
    });

    it('returns 0 when tokensUsed is undefined', () => {
      assert.equal(tracker.estimateCost('gpt-4o-mini', undefined), 0);
    });

    it('calculates cost for gpt-4o-mini', () => {
      const cost = tracker.estimateCost('gpt-4o-mini', 1000);
      assert.ok(cost > 0, 'should return a positive cost');
      assert.ok(cost < 0.01, 'gpt-4o-mini should be cheap');
    });

    it('falls back to gpt-4o-mini rate for unknown model', () => {
      const known = tracker.estimateCost('gpt-4o-mini', 1000);
      const unknown = tracker.estimateCost('unknown-model-xyz', 1000);
      assert.equal(known, unknown, 'unknown model should use gpt-4o-mini rate');
    });
  });

  describe('record()', () => {
    it('increments count for successful operations', () => {
      tracker.record({ workspaceId: 'W1', userId: 'U1', operation: 'rca', model: 'gpt-4o-mini', tokensUsed: 500, success: true });
      const usage = tracker.getUsage('W1');
      assert.equal(usage.count, 1);
    });

    it('does not increment count for failed operations', () => {
      tracker.record({ workspaceId: 'W1', userId: 'U1', operation: 'rca', model: 'gpt-4o-mini', success: false, error: 'API error' });
      const usage = tracker.getUsage('W1');
      assert.equal(usage.count, 0);
    });

    it('accumulates token counts across operations', () => {
      tracker.record({ workspaceId: 'W1', userId: 'U1', operation: 'rca', model: 'gpt-4o-mini', tokensUsed: 300, success: true });
      tracker.record({ workspaceId: 'W1', userId: 'U1', operation: 'rec', model: 'gpt-4o-mini', tokensUsed: 400, success: true });
      const usage = tracker.getUsage('W1');
      assert.equal(usage.totalTokens, 700);
    });

    it('keeps workspaces isolated', () => {
      tracker.record({ workspaceId: 'W1', userId: 'U1', operation: 'rca', model: 'gpt-4o-mini', tokensUsed: 500, success: true });
      tracker.record({ workspaceId: 'W2', userId: 'U2', operation: 'rca', model: 'gpt-4o-mini', tokensUsed: 200, success: true });
      assert.equal(tracker.getUsage('W1').count, 1);
      assert.equal(tracker.getUsage('W2').count, 1);
      assert.equal(tracker.getUsage('W1').totalTokens, 500);
      assert.equal(tracker.getUsage('W2').totalTokens, 200);
    });
  });

  describe('checkLimit()', () => {
    it('allows operations when under the plan limit', () => {
      const result = tracker.checkLimit('W1', 'free');
      assert.equal(result.allowed, true);
      assert.equal(result.used, 0);
    });

    it('blocks when workspace has reached the free plan limit', () => {
      const freeLimit = 10;
      for (let i = 0; i < freeLimit; i++) {
        tracker.record({ workspaceId: 'W1', userId: 'U1', operation: 'rca', model: 'gpt-4o-mini', tokensUsed: 100, success: true });
      }
      const result = tracker.checkLimit('W1', 'free');
      assert.equal(result.allowed, false);
      assert.ok(result.reason, 'should provide a reason message');
      assert.equal(result.used, freeLimit);
    });

    it('allows more operations on pro plan', () => {
      // Use up the free limit
      for (let i = 0; i < 10; i++) {
        tracker.record({ workspaceId: 'W1', userId: 'U1', operation: 'rca', model: 'gpt-4o-mini', tokensUsed: 100, success: true });
      }
      // Pro plan should still allow it
      const result = tracker.checkLimit('W1', 'pro');
      assert.equal(result.allowed, true);
    });

    it('includes plan name in the response', () => {
      const result = tracker.checkLimit('W1', 'pro');
      assert.ok(result.plan, 'should include plan name');
    });
  });

  describe('getRemainingOperations()', () => {
    it('returns full limit for a fresh workspace', () => {
      const remaining = tracker.getRemainingOperations('W_NEW', 'free');
      assert.ok(remaining > 0, 'should have remaining operations');
    });

    it('decreases as operations are recorded', () => {
      const before = tracker.getRemainingOperations('W1', 'free');
      tracker.record({ workspaceId: 'W1', userId: 'U1', operation: 'rca', model: 'gpt-4o-mini', tokensUsed: 100, success: true });
      const after = tracker.getRemainingOperations('W1', 'free');
      assert.equal(after, before - 1);
    });

    it('returns 0 when limit is reached', () => {
      for (let i = 0; i < 10; i++) {
        tracker.record({ workspaceId: 'W1', userId: 'U1', operation: 'rca', model: 'gpt-4o-mini', tokensUsed: 100, success: true });
      }
      const remaining = tracker.getRemainingOperations('W1', 'free');
      assert.equal(remaining, 0);
    });
  });

  describe('getUsage()', () => {
    it('returns usage summary with correct structure', () => {
      tracker.record({ workspaceId: 'W1', userId: 'U1', operation: 'rca', model: 'gpt-4o-mini', tokensUsed: 500, success: true });
      const usage = tracker.getUsage('W1');
      assert.ok('workspaceId' in usage);
      assert.ok('period' in usage);
      assert.ok('count' in usage);
      assert.ok('totalTokens' in usage);
      assert.ok('totalCostUsd' in usage);
      assert.ok('operationBreakdown' in usage);
      assert.equal(usage.workspaceId, 'W1');
    });

    it('operationBreakdown counts by operation type', () => {
      tracker.record({ workspaceId: 'W1', userId: 'U1', operation: 'rca', model: 'gpt-4o-mini', tokensUsed: 100, success: true });
      tracker.record({ workspaceId: 'W1', userId: 'U1', operation: 'rca', model: 'gpt-4o-mini', tokensUsed: 100, success: true });
      tracker.record({ workspaceId: 'W1', userId: 'U1', operation: 'recommendations', model: 'gpt-4o-mini', tokensUsed: 100, success: true });
      const usage = tracker.getUsage('W1');
      assert.equal(usage.operationBreakdown.rca, 2);
      assert.equal(usage.operationBreakdown.recommendations, 1);
    });
  });

  describe('checkAndRecord()', () => {
    it('returns allowed=true and records when under limit', async () => {
      const result = await tracker.checkAndRecord({
        workspaceId: 'W1', userId: 'U1', operation: 'rca',
        model: 'gpt-4o-mini', planId: 'free', tokensUsed: 200, success: true,
      });
      assert.equal(result.allowed, true);
      assert.equal(tracker.getUsage('W1').count, 1);
    });

    it('returns allowed=false and does not record when over limit', async () => {
      for (let i = 0; i < 10; i++) {
        tracker.record({ workspaceId: 'W1', userId: 'U1', operation: 'rca', model: 'gpt-4o-mini', tokensUsed: 100, success: true });
      }
      const result = await tracker.checkAndRecord({
        workspaceId: 'W1', userId: 'U1', operation: 'rca',
        model: 'gpt-4o-mini', planId: 'free', tokensUsed: 200, success: true,
      });
      assert.equal(result.allowed, false);
      assert.equal(tracker.getUsage('W1').count, 10, 'count should not change after blocked call');
    });
  });
});
