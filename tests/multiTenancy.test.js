/**
 * Tests — Multi-Tenancy and Tenant Isolation
 *
 * Verifies that workspace data is strictly isolated:
 * - Usage tracking per workspace
 * - Billing subscriptions per workspace
 * - Installation store per workspace
 * - One workspace cannot access another's data
 */

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

process.env.DEMO_MODE = 'true';

const tracker = require('../src/services/usageTracker');
const billing = require('../src/services/billingService');
const installStore = require('../src/slack/installationStore');

function clearAll() {
  tracker._store.clear();
  billing._subscriptions.clear();
  installStore._memStore.clear();
}

const W1 = 'T_WORKSPACE_ONE';
const W2 = 'T_WORKSPACE_TWO';
const W3 = 'T_WORKSPACE_THREE';

describe('Multi-Tenancy Isolation', () => {
  beforeEach(() => clearAll());

  describe('Usage tracking isolation', () => {
    it('records usage separately per workspace', () => {
      tracker.record({ workspaceId: W1, userId: 'U1', operation: 'rca', model: 'gpt-4o-mini', tokensUsed: 500, success: true });
      tracker.record({ workspaceId: W1, userId: 'U1', operation: 'rca', model: 'gpt-4o-mini', tokensUsed: 300, success: true });
      tracker.record({ workspaceId: W2, userId: 'U2', operation: 'rca', model: 'gpt-4o-mini', tokensUsed: 100, success: true });

      const usage1 = tracker.getUsage(W1);
      const usage2 = tracker.getUsage(W2);

      assert.equal(usage1.count, 2, 'W1 should have 2 operations');
      assert.equal(usage2.count, 1, 'W2 should have 1 operation');
      assert.equal(usage1.totalTokens, 800, 'W1 token count should be 800');
      assert.equal(usage2.totalTokens, 100, 'W2 token count should be 100');
    });

    it('plan limits are enforced independently per workspace', () => {
      // Fill W1 to the free limit
      for (let i = 0; i < 10; i++) {
        tracker.record({ workspaceId: W1, userId: 'U1', operation: 'rca', model: 'gpt-4o-mini', tokensUsed: 50, success: true });
      }

      const w1Check = tracker.checkLimit(W1, 'free');
      const w2Check = tracker.checkLimit(W2, 'free');

      assert.equal(w1Check.allowed, false, 'W1 should be at limit');
      assert.equal(w2Check.allowed, true, 'W2 should still be allowed');
    });

    it('three workspaces are tracked independently', () => {
      tracker.record({ workspaceId: W1, userId: 'U1', operation: 'op', model: 'gpt-4o-mini', tokensUsed: 100, success: true });
      tracker.record({ workspaceId: W2, userId: 'U2', operation: 'op', model: 'gpt-4o-mini', tokensUsed: 200, success: true });
      tracker.record({ workspaceId: W3, userId: 'U3', operation: 'op', model: 'gpt-4o-mini', tokensUsed: 300, success: true });

      assert.equal(tracker.getUsage(W1).totalTokens, 100);
      assert.equal(tracker.getUsage(W2).totalTokens, 200);
      assert.equal(tracker.getUsage(W3).totalTokens, 300);
    });
  });

  describe('Billing subscription isolation', () => {
    it('each workspace defaults to free plan', () => {
      const sub1 = billing.getSubscription(W1);
      const sub2 = billing.getSubscription(W2);
      assert.equal(sub1.planId, 'free');
      assert.equal(sub2.planId, 'free');
    });

    it('upgrading W1 does not affect W2', () => {
      billing._upsertSubscription(W1, { planId: 'pro', status: 'active' });

      const sub1 = billing.getSubscription(W1);
      const sub2 = billing.getSubscription(W2);

      assert.equal(sub1.planId, 'pro', 'W1 should be on pro');
      assert.equal(sub2.planId, 'free', 'W2 should remain on free');
    });

    it('entitlements differ between plan tiers', () => {
      billing._upsertSubscription(W1, { planId: 'free' });
      billing._upsertSubscription(W2, { planId: 'pro' });
      billing._upsertSubscription(W3, { planId: 'business' });

      assert.equal(billing.checkEntitlement(W1, 'mcpAccess'), false, 'free should not have mcpAccess');
      assert.equal(billing.checkEntitlement(W2, 'mcpAccess'), true, 'pro should have mcpAccess');
      assert.equal(billing.checkEntitlement(W3, 'multiWorkspace'), true, 'business should have multiWorkspace');
      assert.equal(billing.checkEntitlement(W1, 'multiWorkspace'), false, 'free should not have multiWorkspace');
    });

    it('billing summary workspace ID matches the queried workspace', () => {
      const summary1 = billing.getBillingSummary(W1);
      const summary2 = billing.getBillingSummary(W2);
      assert.equal(summary1.workspaceId, W1);
      assert.equal(summary2.workspaceId, W2);
    });
  });

  describe('Installation store isolation', () => {
    it('stores and retrieves installations by workspace ID', async () => {
      await installStore.storeInstallation({
        team: { id: W1, name: 'Workspace One' },
        bot: { token: 'xoxb-w1-token', scopes: ['commands'] },
      });

      const fetched = await installStore.fetchInstallation({ teamId: W1 });
      assert.equal(fetched.team.id, W1);
    });

    it('W2 cannot retrieve W1 installation', async () => {
      await installStore.storeInstallation({
        team: { id: W1, name: 'Workspace One' },
        bot: { token: 'xoxb-w1-token', scopes: ['commands'] },
      });

      await assert.rejects(
        () => installStore.fetchInstallation({ teamId: W2 }),
        /No installation found/,
        'fetching W2 installation should fail when only W1 is stored'
      );
    });

    it('deleting W1 installation does not affect W2', async () => {
      await installStore.storeInstallation({
        team: { id: W1 }, bot: { token: 'xoxb-w1', scopes: [] },
      });
      await installStore.storeInstallation({
        team: { id: W2 }, bot: { token: 'xoxb-w2', scopes: [] },
      });

      await installStore.deleteInstallation({ teamId: W1 });

      // W1 should be gone
      await assert.rejects(() => installStore.fetchInstallation({ teamId: W1 }), /No installation found/);

      // W2 should still be present
      const w2 = await installStore.fetchInstallation({ teamId: W2 });
      assert.equal(w2.team.id, W2);
    });

    it('enterprise installations use enterprise key, not team key', async () => {
      await installStore.storeInstallation({
        isEnterpriseInstall: true,
        enterprise: { id: 'E1', name: 'Enterprise One' },
        bot: { token: 'xoxb-enterprise', scopes: [] },
      });

      const fetched = await installStore.fetchInstallation({ isEnterpriseInstall: true, enterpriseId: 'E1' });
      assert.equal(fetched.enterprise.id, 'E1');

      // Should NOT be findable via team lookup
      await assert.rejects(
        () => installStore.fetchInstallation({ teamId: 'E1' }),
        /No installation found/
      );
    });

    it('storeInstallation throws for invalid installation object', async () => {
      await assert.rejects(
        () => installStore.storeInstallation({ bot: { token: 'xoxb-test' } }),
        /cannot determine workspace key/
      );
    });

    it('getInstallationCount returns correct count', async () => {
      const before = installStore.getInstallationCount();
      await installStore.storeInstallation({
        team: { id: 'T_COUNT_TEST' }, bot: { token: 'xoxb-test', scopes: [] },
      });
      const after = installStore.getInstallationCount();
      assert.equal(after, before + 1);
    });
  });

  describe('Cross-workspace AI limit enforcement', () => {
    it('different workspaces have independent monthly limits', async () => {
      // Fill W1 to its limit
      for (let i = 0; i < 10; i++) {
        tracker.record({ workspaceId: W1, userId: 'U1', operation: 'rca', model: 'gpt-4o-mini', tokensUsed: 50, success: true });
      }

      // W1 blocked
      const r1 = await billing.recordUsage({ workspaceId: W1, userId: 'U1', operation: 'rca', model: 'gpt-4o-mini', tokensUsed: 50, success: true });
      assert.equal(r1.allowed, false, 'W1 should be blocked');

      // W2 still allowed
      const r2 = await billing.recordUsage({ workspaceId: W2, userId: 'U2', operation: 'rca', model: 'gpt-4o-mini', tokensUsed: 50, success: true });
      assert.equal(r2.allowed, true, 'W2 should still be allowed');
    });
  });
});
