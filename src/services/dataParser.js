/**
 * PulseGuard — Data Parser & Validator
 *
 * Parses uploaded operational data (CSV or JSON) into the dataset shape the
 * risk engine consumes, and validates it so bad input produces clear errors
 * instead of silent wrong analysis.
 *
 * ── Supported formats ────────────────────────────────────────────────────────
 * JSON:
 *   A single JSON object with entity arrays:
 *   {
 *     "regions": [...], "vendors": [...], "owners": [...],
 *     "supportTickets": [...], "reviews": [...],
 *     "maintenanceIncidents": [...], "bookings": [...],
 *     "baselines": { ... }        // optional; sensible defaults applied
 *   }
 *
 * CSV:
 *   One CSV file per entity type is awkward in Slack, so we accept a single
 *   CSV whose first column is `entity` identifying the row's type. Example:
 *     entity,id,name,region,rating,contractValue
 *     vendor,ven-001,Atlas Services,reg-001,2.1,450000
 *     region,reg-001,Southern Spain,,,
 *   Rows are grouped by their `entity` value into the dataset arrays.
 *
 * ── Validation philosophy ────────────────────────────────────────────────────
 * - Required entity types: regions, and at least one signal source
 *   (supportTickets, reviews, maintenanceIncidents, or bookings).
 * - Numeric fields are coerced; non-numeric where a number is required = error.
 * - Unknown entity types / columns are ignored (forward-compatible).
 * - Row-level errors are collected and reported, capped to avoid huge messages.
 * - Hard limits on row counts prevent oversized uploads.
 */

// Maximum rows accepted across all entities (guards memory + cost)
const MAX_ROWS = parseInt(process.env.UPLOAD_MAX_ROWS || '20000', 10);
// Maximum raw upload size in bytes (guards parsing cost)
const MAX_BYTES = parseInt(process.env.UPLOAD_MAX_BYTES || String(2 * 1024 * 1024), 10); // 2 MB
// Cap on number of individual validation errors reported back
const MAX_REPORTED_ERRORS = 25;

const DEFAULT_BASELINES = {
  avgComplaintsPerRegion: 25,
  avgMaintenanceResponseHours: 14,
  avgCancellationRate: 0.065,
  avgReviewRating: 4.2,
  avgOwnerSatisfaction: 4.0,
  avgVendorCompletionRate: 0.90,
  avgRefundRate: 0.04,
};

const ENTITY_KEYS = {
  region: 'regions',
  vendor: 'vendors',
  owner: 'owners',
  ticket: 'supportTickets',
  supportticket: 'supportTickets',
  review: 'reviews',
  maintenance: 'maintenanceIncidents',
  maintenanceincident: 'maintenanceIncidents',
  incident: 'maintenanceIncidents',
  booking: 'bookings',
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Parse and validate an upload.
 *
 * @param {string} content   - raw file content
 * @param {string} filename  - used to detect format by extension
 * @returns {{ ok: boolean, dataset?: object, source?: string, errors: string[], warnings: string[] }}
 */
function parseUpload(content, filename = '') {
  const errors = [];
  const warnings = [];

  if (typeof content !== 'string' || content.trim().length === 0) {
    return { ok: false, errors: ['The uploaded file is empty.'], warnings };
  }
  if (Buffer.byteLength(content, 'utf8') > MAX_BYTES) {
    return { ok: false, errors: [`File too large. Maximum size is ${Math.round(MAX_BYTES / 1024)} KB.`], warnings };
  }

  const isJson = filename.toLowerCase().endsWith('.json') || _looksLikeJson(content);
  let raw;
  let source;

  try {
    if (isJson) {
      raw = _parseJsonUpload(content);
      source = 'json';
    } else {
      raw = _parseCsvUpload(content);
      source = 'csv';
    }
  } catch (err) {
    return { ok: false, errors: [`Could not parse ${isJson ? 'JSON' : 'CSV'}: ${err.message}`], warnings };
  }

  const totalRows = Object.values(raw)
    .filter(Array.isArray)
    .reduce((sum, arr) => sum + arr.length, 0);
  if (totalRows > MAX_ROWS) {
    return { ok: false, errors: [`Too many rows (${totalRows}). Maximum is ${MAX_ROWS}.`], warnings };
  }

  const { dataset, rowErrors, rowWarnings } = _validateAndNormalise(raw);
  errors.push(...rowErrors);
  warnings.push(...rowWarnings);

  // Structural requirements
  if (!dataset.regions.length) {
    errors.push('At least one "region" row is required.');
  }
  const hasSignals =
    dataset.supportTickets.length ||
    dataset.reviews.length ||
    dataset.maintenanceIncidents.length ||
    dataset.bookings.length;
  if (!hasSignals) {
    errors.push('At least one signal source is required (supportTickets, reviews, maintenanceIncidents, or bookings).');
  }

  if (errors.length) {
    return { ok: false, errors: _cap(errors), warnings: _cap(warnings), source };
  }

  return { ok: true, dataset, source, errors: [], warnings: _cap(warnings) };
}

// ---------------------------------------------------------------------------
// JSON parsing
// ---------------------------------------------------------------------------

function _parseJsonUpload(content) {
  const obj = JSON.parse(content);
  if (Array.isArray(obj) || typeof obj !== 'object' || obj === null) {
    throw new Error('JSON must be an object with entity arrays (regions, vendors, ...).');
  }
  return {
    regions: _asArray(obj.regions),
    vendors: _asArray(obj.vendors),
    owners: _asArray(obj.owners),
    supportTickets: _asArray(obj.supportTickets),
    reviews: _asArray(obj.reviews),
    maintenanceIncidents: _asArray(obj.maintenanceIncidents),
    bookings: _asArray(obj.bookings),
    baselines: obj.baselines && typeof obj.baselines === 'object' ? obj.baselines : {},
  };
}

// ---------------------------------------------------------------------------
// CSV parsing (RFC-4180-ish: handles quoted fields, commas, escaped quotes)
// ---------------------------------------------------------------------------

function _parseCsvUpload(content) {
  const rows = _parseCsvRows(content);
  if (rows.length < 2) throw new Error('CSV must have a header row and at least one data row.');

  const header = rows[0].map(h => h.trim());
  const entityIdx = header.findIndex(h => h.toLowerCase() === 'entity');
  if (entityIdx === -1) {
    throw new Error('CSV must include an "entity" column identifying each row type (region, vendor, ticket, ...).');
  }

  const out = {
    regions: [], vendors: [], owners: [], supportTickets: [],
    reviews: [], maintenanceIncidents: [], bookings: [], baselines: {},
  };

  for (let i = 1; i < rows.length; i++) {
    const cells = rows[i];
    if (cells.every(c => c.trim() === '')) continue; // skip blank lines

    const entityRaw = (cells[entityIdx] || '').trim().toLowerCase();
    const key = ENTITY_KEYS[entityRaw];
    if (!key) continue; // unknown entity type — ignored

    const record = {};
    header.forEach((col, idx) => {
      if (idx === entityIdx) return;
      const val = cells[idx];
      if (val !== undefined && val !== '') record[col.trim()] = val;
    });
    out[key].push(record);
  }

  return out;
}

/**
 * Split raw CSV text into an array of rows (each an array of string cells).
 * Handles quoted fields, embedded commas, escaped double-quotes, and CRLF.
 */
function _parseCsvRows(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];

    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else { inQuotes = false; }
      } else {
        field += c;
      }
      continue;
    }

    if (c === '"') { inQuotes = true; }
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (c === '\r') { /* ignore, handled by \n */ }
    else { field += c; }
  }
  // Last field/row (if file doesn't end with newline)
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

// ---------------------------------------------------------------------------
// Validation & normalisation
// ---------------------------------------------------------------------------

function _validateAndNormalise(raw) {
  const rowErrors = [];
  const rowWarnings = [];

  const dataset = {
    regions: [],
    vendors: [],
    owners: [],
    supportTickets: [],
    reviews: [],
    maintenanceIncidents: [],
    bookings: [],
    baselines: { ...DEFAULT_BASELINES, ..._normaliseBaselines(raw.baselines || {}) },
  };

  // Regions: id, name required
  raw.regions.forEach((r, i) => {
    if (!r.id || !r.name) { rowErrors.push(`region[${i}]: "id" and "name" are required.`); return; }
    dataset.regions.push({
      id: String(r.id),
      name: String(r.name),
      country: r.country ? String(r.country) : undefined,
      properties: _num(r.properties, 0),
      manager: r.manager ? String(r.manager) : undefined,
    });
  });

  // Vendors: id, name, region required
  raw.vendors.forEach((v, i) => {
    if (!v.id || !v.name || !v.region) { rowErrors.push(`vendor[${i}]: "id", "name", and "region" are required.`); return; }
    dataset.vendors.push({
      id: String(v.id),
      name: String(v.name),
      region: String(v.region),
      type: v.type ? String(v.type) : 'maintenance',
      rating: _num(v.rating, 0),
      responseTime: _num(v.responseTime, 0),
      contractValue: _num(v.contractValue, 0),
    });
  });

  // Owners: id, name, region required
  raw.owners.forEach((o, i) => {
    if (!o.id || !o.name || !o.region) { rowErrors.push(`owner[${i}]: "id", "name", and "region" are required.`); return; }
    dataset.owners.push({
      id: String(o.id),
      name: String(o.name),
      region: String(o.region),
      properties: _num(o.properties, 0),
      tenure: o.tenure ? String(o.tenure) : '1 year',
      revenue: _num(o.revenue, 0),
      satisfaction: _num(o.satisfaction, 4.0),
      escalations: _num(o.escalations, 0),
    });
  });

  // Support tickets: regionId, category required
  raw.supportTickets.forEach((t, i) => {
    if (!t.regionId || !t.category) { rowErrors.push(`ticket[${i}]: "regionId" and "category" are required.`); return; }
    dataset.supportTickets.push({
      id: t.id ? String(t.id) : `ticket-${i}`,
      regionId: String(t.regionId),
      category: String(t.category).toLowerCase(),
      daysAgo: _num(t.daysAgo, 0),
      resolved: _bool(t.resolved, false),
      severity: t.severity ? String(t.severity) : 'medium',
    });
  });

  // Reviews: regionId, rating required
  raw.reviews.forEach((r, i) => {
    if (!r.regionId || r.rating === undefined) { rowErrors.push(`review[${i}]: "regionId" and "rating" are required.`); return; }
    const rating = _num(r.rating, null);
    if (rating === null) { rowErrors.push(`review[${i}]: "rating" must be a number.`); return; }
    dataset.reviews.push({
      id: r.id ? String(r.id) : `review-${i}`,
      regionId: String(r.regionId),
      rating,
      daysAgo: _num(r.daysAgo, 0),
      sentiment: r.sentiment ? String(r.sentiment).toLowerCase() : (rating < 3 ? 'negative' : rating < 4 ? 'neutral' : 'positive'),
    });
  });

  // Maintenance incidents: vendorId, regionId required
  raw.maintenanceIncidents.forEach((m, i) => {
    if (!m.vendorId || !m.regionId) { rowErrors.push(`maintenance[${i}]: "vendorId" and "regionId" are required.`); return; }
    dataset.maintenanceIncidents.push({
      id: m.id ? String(m.id) : `maint-${i}`,
      vendorId: String(m.vendorId),
      regionId: String(m.regionId),
      daysAgo: _num(m.daysAgo, 0),
      responseHours: _num(m.responseHours, 0),
      completed: _bool(m.completed, true),
      escalated: _bool(m.escalated, false),
      type: m.type ? String(m.type) : 'general',
    });
  });

  // Bookings: regionId required
  raw.bookings.forEach((b, i) => {
    if (!b.regionId) { rowErrors.push(`booking[${i}]: "regionId" is required.`); return; }
    const totalBookings = _num(b.totalBookings, 0);
    const cancellations = _num(b.cancellations, 0);
    let cancellationRate = _num(b.cancellationRate, null);
    if (cancellationRate === null) {
      cancellationRate = totalBookings > 0 ? cancellations / totalBookings : 0;
    }
    dataset.bookings.push({
      regionId: String(b.regionId),
      totalBookings,
      cancellations,
      cancellationRate,
      refundTotal: _num(b.refundTotal, 0),
      trend: b.trend ? String(b.trend) : 'stable',
    });
  });

  // Referential warnings (non-fatal): vendors/owners/tickets referencing unknown regions
  const regionIds = new Set(dataset.regions.map(r => r.id));
  dataset.vendors.forEach(v => {
    if (!regionIds.has(v.region)) rowWarnings.push(`vendor "${v.id}" references unknown region "${v.region}".`);
  });
  dataset.bookings.forEach(b => {
    if (!regionIds.has(b.regionId)) rowWarnings.push(`booking for region "${b.regionId}" has no matching region row.`);
  });

  return { dataset, rowErrors, rowWarnings };
}

function _normaliseBaselines(b) {
  const out = {};
  for (const [k, v] of Object.entries(b)) {
    const n = _num(v, null);
    if (n !== null) out[k] = n;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Coercion helpers
// ---------------------------------------------------------------------------

function _num(value, fallback) {
  if (value === undefined || value === null || value === '') return fallback;
  const n = Number(String(value).replace(/[%,€$\s]/g, ''));
  return Number.isFinite(n) ? n : fallback;
}

function _bool(value, fallback) {
  if (value === undefined || value === null || value === '') return fallback;
  const s = String(value).trim().toLowerCase();
  if (['true', 'yes', '1', 'y'].includes(s)) return true;
  if (['false', 'no', '0', 'n'].includes(s)) return false;
  return fallback;
}

function _asArray(v) {
  return Array.isArray(v) ? v : [];
}

function _looksLikeJson(content) {
  const t = content.trim();
  return t.startsWith('{') || t.startsWith('[');
}

function _cap(arr) {
  if (arr.length <= MAX_REPORTED_ERRORS) return arr;
  return [...arr.slice(0, MAX_REPORTED_ERRORS), `...and ${arr.length - MAX_REPORTED_ERRORS} more.`];
}

module.exports = {
  parseUpload,
  DEFAULT_BASELINES,
  // Exposed for testing
  _parseCsvRows,
  MAX_ROWS,
  MAX_BYTES,
};
