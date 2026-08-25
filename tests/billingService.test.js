/**
 * Tests — Billing Service
 *
 * Covers: plan resolution, env-var overrides, entitlement checks,
 * billing summary structure, Stripe webhook handler stubs.
 */

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

process.env.DEMO_MODE = 'true';

const billing = require('../src/services/billingService');
const tracker = require('../src/services/usageTracker');

function clearStores() {
  billing._subscriptions.clear();
  tracker._store.clear();
}

describe('billingService', () => {
  beforeEach(() => clearStores());

  describe('getSubscription()', () => {
    it('defaults to free plan for unknown workspaces', () => {
      const sub = billing.getSubscription('W_UNKNOWN');
      assert.equal(sub.planId, 'free');
      assert.equal(sub.status, 'active');
    });

    it('returns stored subscription when present', () => {
      billing._upsertSubscription('W1', { planId: 'pro', status: 'active' });
      const sub = billing.getSubscription('W1');
      assert.equal(sub.planId, 'pro');
    });

    it('respects PLAN_OVERRIDE_<TEAM_ID> env var', () => {
      process.env.PLAN_OVERRIDE_W_OVERRIDE_TEST = 'business';
      const sub = billing.getSubscription('W_OVERRIDE_TEST');
      assert.equal(sub.planId, 'business');
      delete process.env.PLAN_OVERRIDE_W_OVERRIDE_TEST;
    });

    it('ignores invalid plan override values', () => {
      process.env.PLAN_OVERRIDE_W_INVALID = 'superplan';
      const sub = billing.getSubscription('W_INVALID');
      assert.equal(sub.planId, 'free', 'should fall back to free for invalid override');
      delete process.env.PLAN_OVERRIDE_W_INVALID;
    });
  });

  describe('getPlanForWorkspace()', () => {
    it('returns free plan for default workspace', () => {
      const plan = billing.getPlanForWorkspace('W_NEW');
      assert.equal(plan.id, 'free');
    });

    it('returns correct plan after subscription upsert', () => {
      billing._upsertSubscription('W1', { planId: 'pro' });
      const plan = billing.getPlanForWorkspace('W1');
      assert.equal(plan.id, 'pro');
      assert.ok(plan.monthlyAiOperations > 10, 'pro should have more ops than free');
    });
  });

  describe('checkEntitlement()', () => {
    it('free plan does not have mcpAccess', () => {
      assert.equal(billing.checkEntitlement('W_FREE', 'mcpAccess'), false);
    });

    it('pro plan has mcpAccess', () => {
      billing._upsertSubscription('W_PRO', { planId: 'pro' });
      assert.equal(billing.checkEntitlement('W_PRO', 'mcpAccess'), true);
    });

    it('all plans have riskDetection', () => {
      for (const planId of ['free', 'pro', 'business']) {
        billing._upsertSubscription(`W_${planId.toUpperCase()}`, { planId });
        assert.equal(billing.checkEntitlement(`W_${planId.toUpperCase()}`, 'riskDetection'), true);
      }
    });

    it('unknown feature returns false', () => {
      assert.equal(billing.checkEntitlement('W_NEW', 'nonExistentFeature'), false);
    });
  });

  describe('getBillingSummary()', () => {
    it('returns correct structure', () => {
      const summary = billing.getBillingSummary('W1');
      assert.ok('workspaceId' in summary);
      assert.ok('plan' in summary);
      assert.ok('planId' in summary);
      assert.ok('status' in summary);
      assert.ok('usage' in summary);
      assert.ok('stripe' in summary);
    });

    it('usage reflects recorded operations', async () => {
      await billing.recordUsage({ workspaceId: 'W1', userId: 'U1', operation: 'rca', model: 'gpt-4o-mini', tokensUsed: 300, success: true });
      const summary = billing.getBillingSummary('W1');
      assert.equal(summary.usage.operationsUsed, 1);
      assert.equal(summary.usage.totalTokens, 300);
    });

    it('operationsRemaining decreases after usage', async () => {
      const before = billing.getBillingSummary('W1').usage.operationsRemaining;
      await billing.recordUsage({ workspaceId: 'W1', userId: 'U1', operation: 'rca', model: 'gpt-4o-mini', tokensUsed: 100, success: true });
      const after = billing.getBillingSummary('W1').usage.operationsRemaining;
      assert.equal(after, before - 1);
    });
  });

  describe('handleStripeWebhook()', () => {
    it('upgrades subscription on checkout.session.completed', async () => {
      await billing.handleStripeWebhook({
        type: 'checkout.session.completed',
        data: {
          object: {
            metadata: { workspaceId: 'W1', planId: 'pro' },
            customer: 'cus_test123',
            subscription: 'sub_test123',
          },
        },
      });
      const sub = billing.getSubscription('W1');
      assert.equal(sub.planId, 'pro');
      assert.equal(sub.status, 'active');
      assert.equal(sub.stripeCustomerId, 'cus_test123');
    });

    it('marks subscription as cancelled on subscription.deleted', async () => {
      billing._upsertSubscription('W1', { planId: 'pro', status: 'active' });
      await billing.handleStripeWebhook({
        type: 'customer.subscription.deleted',
        data: { object: { metadata: { workspaceId: 'W1' }, id: 'sub_test' } },
      });
      const sub = billing.getSubscription('W1');
      assert.equal(sub.planId, 'free');
      assert.equal(sub.status, 'cancelled');
    });

    it('marks subscription as past_due on payment failure', async () => {
      billing._upsertSubscription('W1', { planId: 'pro', status: 'active' });
      await billing.handleStripeWebhook({
        type: 'invoice.payment_failed',
        data: { object: { subscription_details: { metadata: { workspaceId: 'W1' } } } },
      });
      const sub = billing.getSubscription('W1');
      assert.equal(sub.status, 'past_due');
    });

    it('ignores unknown event types without throwing', async () => {
      await assert.doesNotReject(() =>
        billing.handleStripeWebhook({ type: 'unknown.event.type', data: { object: {} } })
      );
    });
  });

  describe('recordUsage()', () => {
    it('blocks and returns allowed=false when plan limit reached', async () => {
      // Use up the free limit
      for (let i = 0; i < 10; i++) {
        tracker.record({ workspaceId: 'W1', userId: 'U1', operation: 'rca', model: 'gpt-4o-mini', tokensUsed: 100, success: true });
      }
      const result = await billing.recordUsage({
        workspaceId: 'W1', userId: 'U1', operation: 'rca',
        model: 'gpt-4o-mini', tokensUsed: 100, success: true,
      });
      assert.equal(result.allowed, false);
    });
  });
});
