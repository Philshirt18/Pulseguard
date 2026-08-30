/**
 * PulseGuard — Slack Installation Store
 *
 * Persists OAuth installations so the app can serve multiple workspaces.
 *
 * ── Storage backend ─────────────────────────────────────────────────────────
 * Production (Vercel + Upstash):
 *   Uses @upstash/redis when KV_REST_API_URL + KV_REST_API_TOKEN are set.
 *   Tokens survive cold starts, serverless restarts, and redeployments.
 *
 * Local development / fallback:
 *   Falls back to an in-memory Map when Upstash env vars are not present.
 *   Also seeds from SLACK_BOT_TOKEN + SLACK_TEAM_ID for backward compat.
 *
 * ── Tenant isolation ────────────────────────────────────────────────────────
 * Each workspace is stored under a unique namespaced key:
 *   install:team:<teamId>
 *   install:enterprise:<enterpriseId>
 *
 * A workspace can NEVER retrieve another workspace's installation.
 */

const logger = require('../services/logger');

// ---------------------------------------------------------------------------
// Storage backend — Upstash Redis or in-memory fallback
// ---------------------------------------------------------------------------

let _redis = null;
let _memStore = new Map();

function _getRedis() {
  if (_redis) return _redis;
  if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
    const { Redis } = require('@upstash/redis');
    _redis = new Redis({
      url: process.env.KV_REST_API_URL,
      token: process.env.KV_REST_API_TOKEN,
    });
    logger.info('InstallationStore: using Upstash Redis');
  }
  return _redis;
}

async function _storeGet(key) {
  const redis = _getRedis();
  if (redis) return redis.get(key);
  return _memStore.get(key) || null;
}

async function _storeSet(key, value) {
  const redis = _getRedis();
  if (redis) return redis.set(key, JSON.stringify(value));
  _memStore.set(key, value);
}

async function _storeDel(key) {
  const redis = _getRedis();
  if (redis) return redis.del(key);
  _memStore.delete(key);
}

// ---------------------------------------------------------------------------
// Env-var seeding (backward-compat for local dev and existing deployments)
// ---------------------------------------------------------------------------

let _seeded = false;

async function _seedFromEnv() {
  if (_seeded) return;
  const token = process.env.SLACK_BOT_TOKEN;
  const teamId = process.env.SLACK_TEAM_ID;
  if (!token || !teamId) return;

  const key = `install:team:${teamId}`;
  const existing = await _storeGet(key);
  if (!existing) {
    await _storeSet(key, {
      team: { id: teamId, name: 'Primary Workspace' },
      bot: {
        token,
        scopes: ['commands', 'chat:write', 'chat:write.public'],
        userId: process.env.SLACK_BOT_USER_ID || 'unknown',
        installedAt: new Date().toISOString(),
      },
      installedAt: new Date().toISOString(),
      source: 'env_seed',
    });
  }
  _seeded = true;
}

// Seed on load for non-serverless environments
_seedFromEnv().catch(() => {});

// ---------------------------------------------------------------------------
// Key helpers
// ---------------------------------------------------------------------------

function _getKey(installation) {
  if (installation.isEnterpriseInstall && installation.enterprise?.id) {
    return `install:enterprise:${installation.enterprise.id}`;
  }
  if (installation.team?.id) {
    return `install:team:${installation.team.id}`;
  }
  return null;
}

function _getKeyFromQuery(query) {
  if (query.isEnterpriseInstall && query.enterpriseId) {
    return `install:enterprise:${query.enterpriseId}`;
  }
  if (query.teamId) {
    return `install:team:${query.teamId}`;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Installation store interface (required by @slack/bolt ExpressReceiver)
// ---------------------------------------------------------------------------

const installationStore = {
  storeInstallation: async (installation) => {
    const key = _getKey(installation);
    if (!key) throw new Error('storeInstallation: cannot determine workspace key');

    const record = {
      ...installation,
      installedAt: installation.installedAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      source: 'oauth',
    };

    await _storeSet(key, record);
    logger.info('Installation stored', { key: key.replace(/:.+$/, ':***') });
  },

  fetchInstallation: async (installQuery) => {
    // Re-seed on every fetch to survive cold starts
    await _seedFromEnv();

    const key = _getKeyFromQuery(installQuery);
    if (!key) throw new Error('fetchInstallation: cannot determine workspace key');

    const raw = await _storeGet(key);
    if (!raw) {
      throw new Error(
        `No installation found for workspace key "${key.split(':')[2]}". ` +
        `The workspace may need to re-install the app at /slack/install.`
      );
    }

    // Upstash returns a parsed object; in-memory returns the object directly
    return typeof raw === 'string' ? JSON.parse(raw) : raw;
  },

  deleteInstallation: async (installQuery) => {
    const key = _getKeyFromQuery(installQuery);
    if (!key) throw new Error('deleteInstallation: cannot determine workspace key');
    await _storeDel(key);
    logger.info('Installation deleted', { key: key.replace(/:.+$/, ':***') });
  },
};

// ---------------------------------------------------------------------------
// Utility helpers
// ---------------------------------------------------------------------------

/**
 * Returns the plain workspace ID from a Bolt install query.
 * Used as the tenant identifier throughout the app.
 */
function getWorkspaceId(installQuery) {
  if (installQuery?.isEnterpriseInstall && installQuery.enterpriseId) {
    return installQuery.enterpriseId;
  }
  return installQuery?.teamId || null;
}

/**
 * Returns the number of installations in the in-memory store.
 * Only accurate when using the in-memory fallback.
 * Used by the health endpoint.
 */
function getInstallationCount() {
  return _memStore.size;
}

module.exports = {
  ...installationStore,
  getWorkspaceId,
  getInstallationCount,
  // Exposed for testing
  _memStore,
  _seedFromEnv,
};
