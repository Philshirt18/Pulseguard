/**
 * PulseGuard — Per-Workspace Data Store
 *
 * Persists each workspace's uploaded operational dataset so PulseGuard
 * analyzes that workspace's own data instead of shared demo data.
 *
 * ── Storage backend ──────────────────────────────────────────────────────────
 * Production (Vercel + Upstash):
 *   Uses @upstash/redis when KV_REST_API_URL + KV_REST_API_TOKEN are set.
 *   Datasets survive cold starts, restarts, and redeployments.
 *
 * Local development / fallback:
 *   Falls back to an in-memory Map when Upstash env vars are absent.
 *
 * ── Tenant isolation ─────────────────────────────────────────────────────────
 * Each workspace's dataset is stored under a unique namespaced key:
 *   dataset:<workspaceId>
 * A workspace can NEVER read another workspace's dataset.
 *
 * ── Data shape ───────────────────────────────────────────────────────────────
 * Stored value is a wrapper:
 *   {
 *     workspaceId, uploadedAt, uploadedBy, source,
 *     counts: { regions, vendors, owners, supportTickets, reviews,
 *               maintenanceIncidents, bookings },
 *     dataset: { regions, vendors, owners, supportTickets, reviews,
 *                maintenanceIncidents, bookings, baselines }
 *   }
 */

const logger = require('./logger');

let _redis = null;
const _memStore = new Map();

function _getRedis() {
  if (_redis) return _redis;
  if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
    const { Redis } = require('@upstash/redis');
    _redis = new Redis({
      url: process.env.KV_REST_API_URL,
      token: process.env.KV_REST_API_TOKEN,
    });
  }
  return _redis;
}

function _key(workspaceId) {
  return `dataset:${workspaceId}`;
}

/**
 * Save a workspace's dataset.
 *
 * @param {string} workspaceId
 * @param {object} dataset  - validated dataset from dataParser
 * @param {object} meta     - { uploadedBy, source } (source e.g. 'csv' | 'json')
 * @returns {object} the stored wrapper (without exposing internals)
 */
async function saveDataset(workspaceId, dataset, meta = {}) {
  if (!workspaceId) throw new Error('saveDataset: workspaceId is required');
  if (!dataset) throw new Error('saveDataset: dataset is required');

  const wrapper = {
    workspaceId,
    uploadedAt: new Date().toISOString(),
    uploadedBy: meta.uploadedBy || 'unknown',
    source: meta.source || 'unknown',
    counts: _countEntities(dataset),
    dataset,
  };

  const redis = _getRedis();
  if (redis) {
    await redis.set(_key(workspaceId), JSON.stringify(wrapper));
  } else {
    _memStore.set(_key(workspaceId), wrapper);
  }

  logger.info('Dataset saved', {
    workspaceId,
    source: wrapper.source,
    counts: wrapper.counts,
  });

  return { workspaceId: wrapper.workspaceId, uploadedAt: wrapper.uploadedAt, counts: wrapper.counts };
}

/**
 * Get a workspace's dataset wrapper, or null if none uploaded.
 *
 * @param {string} workspaceId
 * @returns {object|null} the wrapper { ..., dataset } or null
 */
async function getDatasetWrapper(workspaceId) {
  if (!workspaceId) return null;
  const redis = _getRedis();
  let raw;
  if (redis) {
    raw = await redis.get(_key(workspaceId));
  } else {
    raw = _memStore.get(_key(workspaceId)) || null;
  }
  if (!raw) return null;
  return typeof raw === 'string' ? JSON.parse(raw) : raw;
}

/**
 * Get just the dataset for a workspace, or null if none uploaded.
 * This is what the risk engine consumes.
 *
 * @param {string} workspaceId
 * @returns {object|null}
 */
async function getDataset(workspaceId) {
  const wrapper = await getDatasetWrapper(workspaceId);
  return wrapper ? wrapper.dataset : null;
}

/**
 * Returns metadata about a workspace's dataset without the full payload.
 * Used by /pulseguard-data to show what's loaded.
 *
 * @param {string} workspaceId
 * @returns {object|null} { uploadedAt, uploadedBy, source, counts } or null
 */
async function getDatasetInfo(workspaceId) {
  const wrapper = await getDatasetWrapper(workspaceId);
  if (!wrapper) return null;
  return {
    uploadedAt: wrapper.uploadedAt,
    uploadedBy: wrapper.uploadedBy,
    source: wrapper.source,
    counts: wrapper.counts,
  };
}

/**
 * Delete a workspace's dataset (revert to demo/sample data).
 *
 * @param {string} workspaceId
 * @returns {boolean} whether something was deleted
 */
async function deleteDataset(workspaceId) {
  if (!workspaceId) return false;
  const redis = _getRedis();
  if (redis) {
    const removed = await redis.del(_key(workspaceId));
    logger.info('Dataset deleted', { workspaceId });
    return removed > 0;
  }
  const existed = _memStore.delete(_key(workspaceId));
  if (existed) logger.info('Dataset deleted', { workspaceId });
  return existed;
}

/**
 * Whether a workspace has uploaded its own dataset.
 * @param {string} workspaceId
 * @returns {boolean}
 */
async function hasDataset(workspaceId) {
  return (await getDatasetWrapper(workspaceId)) !== null;
}

// ---------------------------------------------------------------------------
// Internal
// ---------------------------------------------------------------------------

function _countEntities(dataset) {
  const keys = ['regions', 'vendors', 'owners', 'supportTickets', 'reviews', 'maintenanceIncidents', 'bookings'];
  const counts = {};
  for (const k of keys) {
    counts[k] = Array.isArray(dataset[k]) ? dataset[k].length : 0;
  }
  return counts;
}

module.exports = {
  saveDataset,
  getDataset,
  getDatasetWrapper,
  getDatasetInfo,
  deleteDataset,
  hasDataset,
  // Exposed for testing
  _memStore,
};
