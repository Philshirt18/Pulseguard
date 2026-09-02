/**
 * Tests — Per-Workspace Data Store & Dataset-Injection Engine
 *
 * Covers: save/get/delete, metadata, per-workspace isolation,
 * and the createDetector factory operating on stored datasets.
 */

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

process.env.DEMO_MODE = 'true';

const dataStore = require('../src/services/dataStore');
const { createDetector, RiskDetector } = require('../src/engine/riskDetector');
const singleton = require('../src/engine/riskDetector');

function clearStore() {
  dataStore._memStore.clear();
}

function sampleDataset(regionName = 'Test Region') {
  return {
    regions: [{ id: 'r1', name: regionName, properties: 100 }],
    vendors: [{ id: 'v1', name: 'Bad Vendor', region: 'r1', rating: 1.5, contractValue: 50000 }],
    owners: [{ id: 'o1', name: 'Owner A', region: 'r1', properties: 5, tenure: '2 years', revenue: 100000, satisfaction: 2.0, escalations: 9 }],
    supportTickets: Array.from({ length: 80 }, () => ({ regionId: 'r1', category: 'complaint', daysAgo: 3 })),
    reviews: Array.from({ length: 50 }, () => ({ regionId: 'r1', rating: 2.0, daysAgo: 4, sentiment: 'negative' })),
    maintenanceIncidents: Array.from({ length: 40 }, (_, i) => ({ vendorId: 'v1', regionId: 'r1', responseHours: 90, completed: false, escalated: i < 20 })),
    bookings: [{ regionId: 'r1', totalBookings: 500, cancellations: 120, cancellationRate: 0.24, refundTotal: 200000, trend: 'increasing' }],
    baselines: {
      avgComplaintsPerRegion: 25, avgMaintenanceResponseHours: 14, avgCancellationRate: 0.065,
      avgReviewRating: 4.2, avgOwnerSatisfaction: 4.0, avgVendorCompletionRate: 0.90, avgRefundRate: 0.04,
    },
  };
}

describe('dataStore', () => {
  beforeEach(() => clearStore());

  describe('saveDataset() / getDataset()', () => {
    it('stores and retrieves a workspace dataset', async () => {
      await dataStore.saveDataset('W1', sampleDataset(), { uploadedBy: 'U1', source: 'json' });
      const ds = await dataStore.getDataset('W1');
      assert.ok(ds);
      assert.equal(ds.regions[0].name, 'Test Region');
    });

    it('returns null for a workspace with no dataset', async () => {
      const ds = await dataStore.getDataset('W_NONE');
      assert.equal(ds, null);
    });

    it('throws when workspaceId is missing', async () => {
      await assert.rejects(() => dataStore.saveDataset(null, sampleDataset()));
    });

    it('throws when dataset is missing', async () => {
      await assert.rejects(() => dataStore.saveDataset('W1', null));
    });

    it('overwrites an existing dataset on re-upload', async () => {
      await dataStore.saveDataset('W1', sampleDataset('First'), { source: 'json' });
      await dataStore.saveDataset('W1', sampleDataset('Second'), { source: 'json' });
      const ds = await dataStore.getDataset('W1');
      assert.equal(ds.regions[0].name, 'Second');
    });
  });

  describe('getDatasetInfo()', () => {
    it('returns metadata without the full dataset payload', async () => {
      await dataStore.saveDataset('W1', sampleDataset(), { uploadedBy: 'U1', source: 'csv' });
      const info = await dataStore.getDatasetInfo('W1');
      assert.equal(info.source, 'csv');
      assert.equal(info.uploadedBy, 'U1');
      assert.ok(info.uploadedAt);
      assert.equal(info.counts.regions, 1);
      assert.equal(info.counts.supportTickets, 80);
      assert.equal(info.dataset, undefined, 'info should not expose full dataset');
    });

    it('returns null for a workspace with no dataset', async () => {
      const info = await dataStore.getDatasetInfo('W_NONE');
      assert.equal(info, null);
    });
  });

  describe('hasDataset() / deleteDataset()', () => {
    it('hasDataset reflects presence', async () => {
      assert.equal(await dataStore.hasDataset('W1'), false);
      await dataStore.saveDataset('W1', sampleDataset(), { source: 'json' });
      assert.equal(await dataStore.hasDataset('W1'), true);
    });

    it('deleteDataset removes the dataset', async () => {
      await dataStore.saveDataset('W1', sampleDataset(), { source: 'json' });
      const removed = await dataStore.deleteDataset('W1');
      assert.equal(removed, true);
      assert.equal(await dataStore.getDataset('W1'), null);
    });

    it('deleteDataset returns false when nothing to delete', async () => {
      const removed = await dataStore.deleteDataset('W_NONE');
      assert.equal(removed, false);
    });
  });

  describe('per-workspace isolation', () => {
    it('keeps datasets separate across workspaces', async () => {
      await dataStore.saveDataset('W1', sampleDataset('Region One'), { source: 'json' });
      await dataStore.saveDataset('W2', sampleDataset('Region Two'), { source: 'json' });

      const ds1 = await dataStore.getDataset('W1');
      const ds2 = await dataStore.getDataset('W2');
      assert.equal(ds1.regions[0].name, 'Region One');
      assert.equal(ds2.regions[0].name, 'Region Two');
    });

    it('deleting one workspace does not affect another', async () => {
      await dataStore.saveDataset('W1', sampleDataset(), { source: 'json' });
      await dataStore.saveDataset('W2', sampleDataset(), { source: 'json' });
      await dataStore.deleteDataset('W1');
      assert.equal(await dataStore.hasDataset('W1'), false);
      assert.equal(await dataStore.hasDataset('W2'), true);
    });
  });
});

describe('dataset-injection engine', () => {
  it('createDetector analyzes a provided dataset', () => {
    const detector = createDetector(sampleDataset());
    const risks = detector.analyzeAll();
    assert.ok(risks.length > 0);
    assert.ok(risks.every(r => r.severity));
  });

  it('createDetector is isolated from the default singleton', () => {
    const custom = createDetector(sampleDataset());
    const customRisks = custom.analyzeAll();
    const demoRisks = singleton.analyzeAll();
    // Different datasets produce different risk counts
    assert.notEqual(customRisks.length, demoRisks.length);
  });

  it('setDataset swaps the dataset and clears cached risks', () => {
    const detector = new RiskDetector(sampleDataset('First'));
    detector.analyzeAll();
    detector.setDataset(sampleDataset('Second'));
    const risks = detector.analyzeAll();
    assert.ok(risks.some(r => r.region === 'Second'));
  });

  it('a workspace with an obviously-bad vendor detects an operational risk', () => {
    const risks = createDetector(sampleDataset()).analyzeAll();
    assert.ok(risks.some(r => r.type === 'operational'), 'should flag the bad vendor');
  });

  it('handles an empty-ish dataset without throwing', () => {
    const minimal = {
      regions: [{ id: 'r1', name: 'Quiet Region', properties: 10 }],
      vendors: [], owners: [],
      supportTickets: [], reviews: [], maintenanceIncidents: [],
      bookings: [{ regionId: 'r1', totalBookings: 100, cancellations: 2, cancellationRate: 0.02, refundTotal: 1000, trend: 'stable' }],
      baselines: {
        avgComplaintsPerRegion: 25, avgMaintenanceResponseHours: 14, avgCancellationRate: 0.065,
        avgReviewRating: 4.2, avgOwnerSatisfaction: 4.0, avgVendorCompletionRate: 0.90, avgRefundRate: 0.04,
      },
    };
    const risks = createDetector(minimal).analyzeAll();
    assert.ok(Array.isArray(risks), 'should return an array even with low-risk data');
  });
});
