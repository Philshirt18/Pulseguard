/**
 * Tests — Data Parser & Validator
 *
 * Covers: JSON parsing, CSV parsing (entity column), validation rules,
 * numeric coercion, size/row limits, and round-trip through the risk engine.
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

process.env.DEMO_MODE = 'true';

const { parseUpload, _parseCsvRows } = require('../src/services/dataParser');
const { createDetector } = require('../src/engine/riskDetector');

// A minimal valid dataset as JSON
const VALID_JSON = JSON.stringify({
  regions: [{ id: 'r1', name: 'North', properties: 100 }],
  vendors: [{ id: 'v1', name: 'Acme', region: 'r1', rating: 2.0, contractValue: 50000 }],
  owners: [{ id: 'o1', name: 'Pat', region: 'r1', properties: 5, tenure: '2 years', revenue: 100000, satisfaction: 2.0, escalations: 9 }],
  supportTickets: Array.from({ length: 60 }, () => ({ regionId: 'r1', category: 'complaint', daysAgo: 3 })),
  reviews: Array.from({ length: 30 }, () => ({ regionId: 'r1', rating: 2.0, daysAgo: 4 })),
  maintenanceIncidents: Array.from({ length: 30 }, (_, i) => ({ vendorId: 'v1', regionId: 'r1', responseHours: 90, completed: false, escalated: i < 15 })),
  bookings: [{ regionId: 'r1', totalBookings: 400, cancellations: 100, refundTotal: 150000, trend: 'increasing' }],
});

describe('dataParser', () => {
  describe('JSON parsing', () => {
    it('parses a valid JSON dataset', () => {
      const result = parseUpload(VALID_JSON, 'data.json');
      assert.equal(result.ok, true, `errors: ${result.errors}`);
      assert.equal(result.source, 'json');
      assert.equal(result.dataset.regions.length, 1);
      assert.equal(result.dataset.supportTickets.length, 60);
    });

    it('detects JSON by content even without .json extension', () => {
      const result = parseUpload(VALID_JSON, 'noext');
      assert.equal(result.source, 'json');
    });

    it('applies default baselines when not provided', () => {
      const result = parseUpload(VALID_JSON, 'data.json');
      assert.ok(result.dataset.baselines.avgComplaintsPerRegion > 0);
      assert.ok(result.dataset.baselines.avgReviewRating > 0);
    });

    it('rejects a JSON array (must be an object)', () => {
      const result = parseUpload('[1,2,3]', 'data.json');
      assert.equal(result.ok, false);
    });

    it('rejects malformed JSON with a clear error', () => {
      const result = parseUpload('{ not valid json', 'data.json');
      assert.equal(result.ok, false);
      assert.match(result.errors[0], /parse/i);
    });

    it('round-trips through the risk engine', () => {
      const result = parseUpload(VALID_JSON, 'data.json');
      const risks = createDetector(result.dataset).analyzeAll();
      assert.ok(risks.length > 0, 'should detect risks in the uploaded data');
    });
  });

  describe('CSV parsing', () => {
    const VALID_CSV = [
      'entity,id,name,region,regionId,category,rating,daysAgo,vendorId,responseHours,completed,escalated,totalBookings,cancellations,refundTotal,trend,properties',
      'region,r1,North,,,,,,,,,,,,,,100',
      'vendor,v1,Acme,r1,,,2.0,,,,,,,,,,',
      'ticket,,,,r1,complaint,,3,,,,,,,,,',
      'ticket,,,,r1,complaint,,5,,,,,,,,,',
      'review,,,,r1,,2.0,4,,,,,,,,,',
      'maintenance,,,,r1,,,2,v1,90,false,true,,,,,',
      'booking,,,,r1,,,,,,,,400,100,150000,increasing,',
    ].join('\n');

    it('parses a valid CSV with entity column', () => {
      const result = parseUpload(VALID_CSV, 'data.csv');
      assert.equal(result.ok, true, `errors: ${result.errors}`);
      assert.equal(result.source, 'csv');
      assert.equal(result.dataset.regions.length, 1);
      assert.equal(result.dataset.vendors.length, 1);
      assert.equal(result.dataset.supportTickets.length, 2);
      assert.equal(result.dataset.reviews.length, 1);
      assert.equal(result.dataset.maintenanceIncidents.length, 1);
      assert.equal(result.dataset.bookings.length, 1);
    });

    it('rejects CSV without an entity column', () => {
      const csv = 'id,name\nr1,North';
      const result = parseUpload(csv, 'data.csv');
      assert.equal(result.ok, false);
      assert.match(result.errors[0], /entity/i);
    });

    it('ignores unknown entity types', () => {
      const csv = 'entity,id,name,regionId,category,rating\nregion,r1,North,,,\nwidget,w1,Thing,,,\nreview,,,r1,,3.0';
      const result = parseUpload(csv, 'data.csv');
      // widget row ignored; region + review kept
      assert.equal(result.dataset.regions.length, 1);
      assert.equal(result.dataset.reviews.length, 1);
    });

    it('handles quoted fields with embedded commas', () => {
      const rows = _parseCsvRows('entity,name\nregion,"North, East"\n');
      assert.equal(rows[1][1], 'North, East');
    });

    it('handles escaped double quotes', () => {
      const rows = _parseCsvRows('entity,name\nregion,"The ""Big"" One"\n');
      assert.equal(rows[1][1], 'The "Big" One');
    });

    it('handles CRLF line endings', () => {
      const rows = _parseCsvRows('entity,name\r\nregion,North\r\n');
      assert.equal(rows.length, 2);
      assert.equal(rows[1][1], 'North');
    });
  });

  describe('validation rules', () => {
    it('requires at least one region', () => {
      const json = JSON.stringify({ reviews: [{ regionId: 'r1', rating: 2 }] });
      const result = parseUpload(json, 'x.json');
      assert.equal(result.ok, false);
      assert.ok(result.errors.some(e => /region/i.test(e)));
    });

    it('requires at least one signal source', () => {
      const json = JSON.stringify({ regions: [{ id: 'r1', name: 'North' }] });
      const result = parseUpload(json, 'x.json');
      assert.equal(result.ok, false);
      assert.ok(result.errors.some(e => /signal source/i.test(e)));
    });

    it('reports row-level errors for regions missing id/name', () => {
      const json = JSON.stringify({
        regions: [{ name: 'No ID' }],
        reviews: [{ regionId: 'r1', rating: 2 }],
      });
      const result = parseUpload(json, 'x.json');
      assert.equal(result.ok, false);
      assert.ok(result.errors.some(e => /region\[0\]/.test(e)));
    });

    it('rejects a review with a non-numeric rating', () => {
      const json = JSON.stringify({
        regions: [{ id: 'r1', name: 'North' }],
        reviews: [{ regionId: 'r1', rating: 'excellent' }],
      });
      const result = parseUpload(json, 'x.json');
      assert.equal(result.ok, false);
      assert.ok(result.errors.some(e => /rating.*number/i.test(e)));
    });

    it('produces non-fatal warnings for unknown region references', () => {
      const json = JSON.stringify({
        regions: [{ id: 'r1', name: 'North' }],
        vendors: [{ id: 'v1', name: 'Acme', region: 'UNKNOWN' }],
        reviews: [{ regionId: 'r1', rating: 2 }],
      });
      const result = parseUpload(json, 'x.json');
      assert.equal(result.ok, true, 'unknown region ref should be a warning, not an error');
      assert.ok(result.warnings.length > 0);
    });
  });

  describe('numeric coercion', () => {
    it('strips currency symbols and commas from numbers', () => {
      const json = JSON.stringify({
        regions: [{ id: 'r1', name: 'North' }],
        bookings: [{ regionId: 'r1', totalBookings: '1,000', cancellations: '250', refundTotal: '€45,000' }],
      });
      const result = parseUpload(json, 'x.json');
      assert.equal(result.ok, true);
      assert.equal(result.dataset.bookings[0].totalBookings, 1000);
      assert.equal(result.dataset.bookings[0].refundTotal, 45000);
    });

    it('computes cancellationRate when not provided', () => {
      const json = JSON.stringify({
        regions: [{ id: 'r1', name: 'North' }],
        bookings: [{ regionId: 'r1', totalBookings: 200, cancellations: 50 }],
      });
      const result = parseUpload(json, 'x.json');
      assert.equal(result.dataset.bookings[0].cancellationRate, 0.25);
    });

    it('coerces boolean-like values for ticket resolution', () => {
      const json = JSON.stringify({
        regions: [{ id: 'r1', name: 'North' }],
        supportTickets: [
          { regionId: 'r1', category: 'complaint', resolved: 'yes' },
          { regionId: 'r1', category: 'complaint', resolved: 'no' },
        ],
      });
      const result = parseUpload(json, 'x.json');
      assert.equal(result.dataset.supportTickets[0].resolved, true);
      assert.equal(result.dataset.supportTickets[1].resolved, false);
    });
  });

  describe('limits and edge cases', () => {
    it('rejects an empty file', () => {
      const result = parseUpload('', 'x.csv');
      assert.equal(result.ok, false);
      assert.match(result.errors[0], /empty/i);
    });

    it('rejects whitespace-only content', () => {
      const result = parseUpload('   \n  ', 'x.csv');
      assert.equal(result.ok, false);
    });

    it('rejects a file exceeding the byte limit', () => {
      const huge = '{"regions":[' + '{"id":"r","name":"x"},'.repeat(200000) + ']}';
      const result = parseUpload(huge, 'x.json');
      assert.equal(result.ok, false);
      assert.ok(result.errors.some(e => /too large/i.test(e)));
    });
  });
});
