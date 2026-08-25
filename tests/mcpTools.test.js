/**
 * Tests — MCP Tool Registry
 *
 * Covers: tool registration, input validation, structured error responses,
 * successful tool execution, and edge cases.
 */

const { describe, it, before } = require('node:test');
const assert = require('node:assert/strict');

process.env.DEMO_MODE = 'true';
process.env.SLACK_TEAM_ID = 'T_TEST';

// We test the tool implementations via investigationAgent's _executeToolCall
// (which uses the same data layer as MCP tools) and by registering tools
// on a mock server and checking they respond correctly.

const { _executeToolCall, TOOL_DEFINITIONS } = require('../src/engine/investigationAgent');
const riskDetector = require('../src/engine/riskDetector');

let risks;

describe('MCP Tool Registry', () => {
  before(() => {
    risks = riskDetector.analyzeAll();
  });

  describe('TOOL_DEFINITIONS', () => {
    it('exports an array of tool definitions', () => {
      assert.ok(Array.isArray(TOOL_DEFINITIONS));
      assert.ok(TOOL_DEFINITIONS.length > 0);
    });

    it('every tool has a name and description', () => {
      for (const tool of TOOL_DEFINITIONS) {
        assert.ok(tool.function?.name, 'tool should have a name');
        assert.ok(tool.function?.description, 'tool should have a description');
      }
    });

    it('every tool with parameters has a parameters schema', () => {
      for (const tool of TOOL_DEFINITIONS) {
        if (tool.function.parameters?.properties &&
            Object.keys(tool.function.parameters.properties).length > 0) {
          assert.equal(tool.function.parameters.type, 'object');
          assert.ok(Array.isArray(tool.function.parameters.required));
        }
      }
    });
  });

  describe('get_risk_detail', () => {
    it('returns risk data for a valid risk ID', () => {
      const result = _executeToolCall('get_risk_detail', { risk_id: risks[0].id });
      assert.ok(!result.error, `should not error: ${result.error}`);
      assert.equal(result.id, risks[0].id);
      assert.ok(result.type);
      assert.ok(result.severity);
    });

    it('returns error for unknown risk ID', () => {
      const result = _executeToolCall('get_risk_detail', { risk_id: 'risk-does-not-exist' });
      assert.ok(result.error, 'should return an error for unknown risk');
      assert.ok(Array.isArray(result.availableRisks));
    });

    it('returns validation error for oversized risk_id', () => {
      const result = _executeToolCall('get_risk_detail', { risk_id: 'a'.repeat(200) });
      assert.ok(result.error, 'should validate risk_id length');
    });
  });

  describe('get_vendor_metrics', () => {
    it('returns vendor metrics for a valid vendor ID', () => {
      const result = _executeToolCall('get_vendor_metrics', { vendor_id: 'ven-001' });
      assert.ok(!result.error, `should not error: ${result.error}`);
      assert.ok(result.vendor);
      assert.ok(typeof result.avgResponseHours === 'number');
      assert.ok(typeof result.completionRatePct === 'number');
    });

    it('returns error for unknown vendor', () => {
      const result = _executeToolCall('get_vendor_metrics', { vendor_id: 'ven-999' });
      assert.ok(result.error);
    });

    it('rejects oversized vendor_id', () => {
      const result = _executeToolCall('get_vendor_metrics', { vendor_id: 'x'.repeat(100) });
      assert.ok(result.error);
    });

    it('Atlas Services shows degraded performance vs baseline', () => {
      const result = _executeToolCall('get_vendor_metrics', { vendor_id: 'ven-001' });
      assert.ok(result.avgResponseHours > result.baselineResponseHours,
        'Atlas Services should have above-baseline response time');
      assert.ok(result.completionRatePct < 90,
        'Atlas Services should have below-baseline completion rate');
    });
  });

  describe('get_region_complaints', () => {
    it('returns complaint data for a valid region', () => {
      const result = _executeToolCall('get_region_complaints', { region_id: 'reg-001' });
      assert.ok(!result.error);
      assert.ok(typeof result.complaints === 'number');
      assert.ok(typeof result.totalTickets === 'number');
      assert.ok(result.region);
    });

    it('Southern Spain shows above-baseline complaints', () => {
      const result = _executeToolCall('get_region_complaints', { region_id: 'reg-001' });
      assert.ok(result.complaintVsBaseline > 100,
        'Southern Spain complaints should exceed baseline');
    });

    it('returns error for unknown region', () => {
      const result = _executeToolCall('get_region_complaints', { region_id: 'reg-999' });
      assert.ok(result.error);
    });

    it('respects days parameter', () => {
      const result = _executeToolCall('get_region_complaints', { region_id: 'reg-001', days: 7 });
      assert.equal(result.lookbackDays, 7);
    });

    it('rejects days > 30', () => {
      const result = _executeToolCall('get_region_complaints', { region_id: 'reg-001', days: 31 });
      assert.ok(result.error, 'should reject days > 30');
    });
  });

  describe('get_region_reviews', () => {
    it('returns review data for a valid region', () => {
      const result = _executeToolCall('get_region_reviews', { region_id: 'reg-001' });
      assert.ok(!result.error);
      assert.ok(typeof result.avgRating === 'number');
      assert.ok(typeof result.negativeRatePct === 'number');
    });

    it('Southern Spain shows below-baseline ratings', () => {
      const result = _executeToolCall('get_region_reviews', { region_id: 'reg-001' });
      assert.ok(result.avgRating < result.baseline,
        'Southern Spain should have below-baseline ratings');
    });

    it('returns error for unknown region', () => {
      const result = _executeToolCall('get_region_reviews', { region_id: 'reg-999' });
      assert.ok(result.error);
    });
  });

  describe('get_booking_cancellations', () => {
    it('returns cancellation data for valid region', () => {
      const result = _executeToolCall('get_booking_cancellations', { region_id: 'reg-001' });
      assert.ok(!result.error);
      assert.ok(typeof result.cancellationRatePct === 'number');
      assert.ok(typeof result.refundTotal === 'number');
    });

    it('Southern Spain shows above-baseline cancellations', () => {
      const result = _executeToolCall('get_booking_cancellations', { region_id: 'reg-001' });
      assert.ok(result.cancellationRatePct > result.baselineCancellationRatePct,
        'Southern Spain cancellation rate should exceed baseline');
    });
  });

  describe('get_owner_profile', () => {
    it('returns owner profile for valid owner ID', () => {
      const result = _executeToolCall('get_owner_profile', { owner_id: 'own-001' });
      assert.ok(!result.error);
      assert.ok(result.name);
      assert.ok(typeof result.satisfactionScore === 'number');
      assert.ok(typeof result.escalations === 'number');
    });

    it('Miguel Fernandez shows high churn indicator', () => {
      const result = _executeToolCall('get_owner_profile', { owner_id: 'own-001' });
      assert.equal(result.churnIndicator, 'high');
    });

    it('returns error for unknown owner', () => {
      const result = _executeToolCall('get_owner_profile', { owner_id: 'own-999' });
      assert.ok(result.error);
    });
  });

  describe('compare_regions', () => {
    it('returns an array of region comparisons', () => {
      const result = _executeToolCall('compare_regions', {});
      assert.ok(Array.isArray(result));
      assert.ok(result.length > 0);
    });

    it('each entry has required fields', () => {
      const result = _executeToolCall('compare_regions', {});
      for (const region of result) {
        assert.ok(region.id, 'should have region id');
        assert.ok(region.name, 'should have region name');
        assert.ok(typeof region.complaints === 'number');
      }
    });

    it('Southern Spain has the highest complaint count', () => {
      const result = _executeToolCall('compare_regions', {});
      const sorted = [...result].sort((a, b) => b.complaints - a.complaints);
      assert.equal(sorted[0].id, 'reg-001',
        'Southern Spain should have the most complaints');
    });
  });

  describe('get_baseline_comparison', () => {
    it('returns baseline for complaints metric', () => {
      const result = _executeToolCall('get_baseline_comparison', { metric: 'complaints' });
      assert.ok(!result.error);
      assert.ok(typeof result.baseline === 'number');
    });

    it('includes actual value when region_id is provided', () => {
      const result = _executeToolCall('get_baseline_comparison', { metric: 'complaints', region_id: 'reg-001' });
      assert.ok(typeof result.actual === 'number');
      assert.ok(typeof result.vsBaselinePct === 'number');
    });

    it('Southern Spain complaints are significantly above baseline', () => {
      const result = _executeToolCall('get_baseline_comparison', { metric: 'complaints', region_id: 'reg-001' });
      assert.ok(result.vsBaselinePct > 100, 'Southern Spain should be >100% above baseline');
    });

    it('returns error for unknown metric', () => {
      const result = _executeToolCall('get_baseline_comparison', { metric: 'unknown_metric' });
      assert.ok(result.error);
      assert.ok(Array.isArray(result.validMetrics));
    });
  });

  describe('unknown tool', () => {
    it('returns structured error for unknown tool name', () => {
      const result = _executeToolCall('nonexistent_tool', {});
      assert.ok(result.error, 'should return error for unknown tool');
    });
  });
});
