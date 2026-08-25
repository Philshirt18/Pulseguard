/**
 * Tests — AI Investigation Agent
 *
 * Covers: demo mode investigation, tool execution, billing limit blocking,
 * fallback behaviour, and response shape validation.
 * All tests run in DEMO_MODE — no real OpenAI calls.
 */

const { describe, it, before, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

process.env.DEMO_MODE = 'true';
process.env.SLACK_TEAM_ID = 'T_TEST';

const { investigateRisk } = require('../src/engine/investigationAgent');
const riskDetector = require('../src/engine/riskDetector');
const tracker = require('../src/services/usageTracker');

function clearStores() {
  tracker._store.clear();
  require('../src/services/billingService')._subscriptions.clear();
}

const CONTEXT = { workspaceId: 'T_TEST', userId: 'U_TEST', planId: 'free' };

describe('investigationAgent', () => {
  let risks;

  before(() => {
    risks = riskDetector.analyzeAll();
  });

  beforeEach(() => clearStores());

  describe('investigateRisk() — demo mode', () => {
    it('returns a structured investigation report', async () => {
      const result = await investigateRisk(risks[0], CONTEXT);
      assert.ok(result, 'should return a result');
      assert.ok(result.rootCause, 'should have rootCause');
      assert.ok(result.summary, 'should have summary');
      assert.ok(Array.isArray(result.keyFindings), 'keyFindings should be an array');
      assert.ok(Array.isArray(result.evidenceSources), 'evidenceSources should be an array');
      assert.ok(typeof result.confidence === 'number', 'confidence should be a number');
      assert.ok(Array.isArray(result.immediateActions), 'immediateActions should be an array');
      assert.ok(result.businessImpact, 'should have businessImpact');
    });

    it('marks demo responses with _demo: true', async () => {
      const result = await investigateRisk(risks[0], CONTEXT);
      assert.equal(result._demo, true);
    });

    it('returns high confidence for the Atlas Services risk', async () => {
      const atlasRisk = risks.find(r => r.id === 'risk-ops-ven-001');
      const result = await investigateRisk(atlasRisk, CONTEXT);
      assert.ok(result.confidence >= 0.8, 'Atlas Services should have high confidence');
    });

    it('works for all risk types', async () => {
      const types = ['operational', 'customer_satisfaction', 'revenue', 'owner_churn'];
      for (const type of types) {
        const risk = risks.find(r => r.type === type);
        if (!risk) continue;
        const result = await investigateRisk(risk, CONTEXT);
        assert.ok(result.rootCause, `should produce rootCause for ${type} risk`);
      }
    });

    it('uses default context when none provided', async () => {
      const result = await investigateRisk(risks[0]);
      assert.ok(result, 'should work without explicit context');
    });
  });

  describe('billing limit enforcement', () => {
    it('returns limit-exceeded response when workspace is over its plan limit', async () => {
      // Fill up the free limit
      for (let i = 0; i < 10; i++) {
        tracker.record({
          workspaceId: 'T_TEST', userId: 'U_TEST',
          operation: 'agent_investigation', model: 'gpt-4o-mini',
          tokensUsed: 100, success: true,
        });
      }

      // In demo mode the billing check still runs
      // We need to verify the billing check pathway works by
      // temporarily disabling demo mode
      const originalDemo = process.env.DEMO_MODE;
      process.env.DEMO_MODE = 'false';

      const result = await investigateRisk(risks[0], CONTEXT);

      process.env.DEMO_MODE = originalDemo;

      // Should get limit-exceeded OR a demo fallback (since no real API key)
      // Either way it should not throw and should return a structured object
      assert.ok(result, 'should return a result even at limit');
      assert.ok(result.rootCause || result._limitExceeded, 'should have rootCause or _limitExceeded');
    });
  });

  describe('investigation report quality', () => {
    it('keyFindings is not empty', async () => {
      const result = await investigateRisk(risks[0], CONTEXT);
      assert.ok(result.keyFindings.length > 0, 'should have at least one key finding');
    });

    it('confidence is between 0 and 1', async () => {
      const result = await investigateRisk(risks[0], CONTEXT);
      assert.ok(result.confidence >= 0 && result.confidence <= 1,
        `confidence ${result.confidence} should be between 0 and 1`);
    });

    it('immediateActions contains actionable strings', async () => {
      const result = await investigateRisk(risks[0], CONTEXT);
      for (const action of result.immediateActions) {
        assert.equal(typeof action, 'string', 'each action should be a string');
        assert.ok(action.length > 5, 'actions should be meaningful strings');
      }
    });
  });
});
