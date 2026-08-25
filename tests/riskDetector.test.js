/**
 * Tests — Risk Detection Engine
 *
 * Verifies deterministic behaviour: severity scoring, thresholds,
 * risk type detection, confidence bounds, and edge cases.
 */

const { describe, it, before } = require('node:test');
const assert = require('node:assert/strict');

// Set demo mode so no AI calls happen
process.env.DEMO_MODE = 'true';
process.env.SLACK_TEAM_ID = 'T_TEST';

const riskDetector = require('../src/engine/riskDetector');

describe('RiskDetector', () => {
  let risks;

  before(() => {
    risks = riskDetector.analyzeAll();
  });

  describe('analyzeAll()', () => {
    it('detects at least one risk', () => {
      assert.ok(risks.length > 0, 'should detect risks from mock data');
    });

    it('returns risks sorted by severityScore descending', () => {
      for (let i = 1; i < risks.length; i++) {
        assert.ok(
          risks[i - 1].severityScore >= risks[i].severityScore,
          `risk at index ${i - 1} should have score >= risk at index ${i}`
        );
      }
    });

    it('detects all four risk types', () => {
      const types = new Set(risks.map(r => r.type));
      assert.ok(types.has('operational'), 'should detect operational risks');
      assert.ok(types.has('customer_satisfaction'), 'should detect customer_satisfaction risks');
      assert.ok(types.has('revenue'), 'should detect revenue risks');
      assert.ok(types.has('owner_churn'), 'should detect owner_churn risks');
    });

    it('detects the Atlas Services operational risk', () => {
      const atlasRisk = risks.find(r => r.id === 'risk-ops-ven-001');
      assert.ok(atlasRisk, 'Atlas Services risk should be detected');
      assert.equal(atlasRisk.type, 'operational');
      assert.equal(atlasRisk.severity, 'critical');
      assert.equal(atlasRisk.region, 'Southern Spain');
    });
  });

  describe('Risk object shape', () => {
    it('every risk has required fields', () => {
      const requiredFields = ['id', 'type', 'title', 'region', 'severity', 'severityScore', 'confidence', 'evidence', 'detectedAt'];
      for (const risk of risks) {
        for (const field of requiredFields) {
          assert.ok(risk[field] !== undefined, `risk ${risk.id} missing field: ${field}`);
        }
      }
    });

    it('severity is one of the valid values', () => {
      const validSeverities = new Set(['critical', 'high', 'medium', 'low']);
      for (const risk of risks) {
        assert.ok(validSeverities.has(risk.severity), `invalid severity "${risk.severity}" on ${risk.id}`);
      }
    });

    it('confidence is between 0 and 1', () => {
      for (const risk of risks) {
        assert.ok(risk.confidence >= 0 && risk.confidence <= 1,
          `confidence ${risk.confidence} out of range on ${risk.id}`);
      }
    });

    it('severityScore is a positive number', () => {
      for (const risk of risks) {
        assert.ok(risk.severityScore > 0, `severityScore should be positive on ${risk.id}`);
      }
    });

    it('IDs are unique', () => {
      const ids = risks.map(r => r.id);
      const unique = new Set(ids);
      assert.equal(unique.size, ids.length, 'risk IDs should be unique');
    });
  });

  describe('getSeverity()', () => {
    it('returns critical for scores above the high threshold', () => {
      const result = riskDetector.getSeverity(100, 30, 50, 70);
      assert.equal(result, 'critical');
    });

    it('returns high for scores between medium and high', () => {
      const result = riskDetector.getSeverity(60, 30, 50, 70);
      assert.equal(result, 'high');
    });

    it('returns medium for scores between low and medium', () => {
      const result = riskDetector.getSeverity(40, 30, 50, 70);
      assert.equal(result, 'medium');
    });

    it('returns low for scores below the low threshold', () => {
      const result = riskDetector.getSeverity(10, 30, 50, 70);
      assert.equal(result, 'low');
    });

    it('returns correct severity at exact threshold boundaries', () => {
      assert.equal(riskDetector.getSeverity(70, 30, 50, 70), 'critical');
      assert.equal(riskDetector.getSeverity(50, 30, 50, 70), 'high');
      assert.equal(riskDetector.getSeverity(30, 30, 50, 70), 'medium');
    });
  });

  describe('getRiskById()', () => {
    it('returns the correct risk for a valid ID', () => {
      const risk = riskDetector.getRiskById('risk-ops-ven-001');
      assert.ok(risk, 'should find risk-ops-ven-001');
      assert.equal(risk.id, 'risk-ops-ven-001');
    });

    it('returns undefined for an unknown ID', () => {
      const risk = riskDetector.getRiskById('risk-does-not-exist');
      assert.equal(risk, undefined);
    });

    it('returns undefined for empty string', () => {
      const risk = riskDetector.getRiskById('');
      assert.equal(risk, undefined);
    });
  });

  describe('getCriticalRisks()', () => {
    it('returns only critical risks', () => {
      const critical = riskDetector.getCriticalRisks();
      for (const risk of critical) {
        assert.equal(risk.severity, 'critical', `${risk.id} should be critical`);
      }
    });

    it('returns at least one critical risk from mock data', () => {
      const critical = riskDetector.getCriticalRisks();
      assert.ok(critical.length > 0, 'should have at least one critical risk');
    });
  });

  describe('Operational risk detection', () => {
    it('Atlas Services risk has correlation data', () => {
      const risk = riskDetector.getRiskById('risk-ops-ven-001');
      assert.ok(Array.isArray(risk.correlations), 'correlations should be an array');
      assert.ok(risk.correlations.length > 0, 'Atlas Services risk should have correlations');
    });

    it('Atlas Services risk evidence includes vendor name', () => {
      const risk = riskDetector.getRiskById('risk-ops-ven-001');
      assert.equal(risk.evidence.vendor, 'Atlas Services');
    });
  });
});
