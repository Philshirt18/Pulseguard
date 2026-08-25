/**
 * PulseGuard — Slack Installation Store
 *
 * Persists OAuth installations so the app can serve multiple workspaces.
 *
 * ── Current implementation ──────────────────────────────────────────────────
 * In-memory Map. Works correctly within a single Node.js process.
 *
 * Known limitation on Vercel (serverless):
 *   Each function invocation may run in a fresh process, which means
 *   installations stored in memory are lost on cold start.
 *
 *   Mitigation 1 (current): seed from SLACK_BOT_TOKEN + SLACK_TEAM_ID env
 *     vars on every fetch so at least the primary workspace always works.
 *   Mitigation 2 (recommended for production): replace _store below with a
 *     persistent backend — see the "Production upgrade" comment.
 *
 * ── Production upgrade path ─────────────────────────────────────────────────
 * Swap _store for a persistent implementation. The interface (storeInstallation,
 * fetchInstallation, deleteInstallation) is identical — no other file changes.
 *
 * Options:
 *   - Vercel KV (Redis)  → @vercel/kv
 *   - Upstash Redis      → @upstash/redis
 *   - Postgres/Neon      → pg or @vercel/postgres
 *   - DynamoDB           → @aws-sdk/client-dynamodb
 *
 * Example (Vercel KV):
 *   import { kv } from '@vercel/kv';
 *   storeInstallation: async (i) => kv.set(`install:${teamId}`, i),
 *   fetchInstallation: async (q) => kv.get(`install:${teamId}`),
 *
 * ── Tenant isolation ────────────────────────────────────────────────────────
 * Each workspace gets its own key. A workspace can NEVER retrieve another
 * workspace's installation. Lookup is always by teamId or enterpriseId — never
 * by a shared global key.
 */

const _store = new Map();

// ---------------------------------------------------------------------------
// Env-var seeding (backward-compat for existing deployments)
// ---------------------------------------------------------------------------

/**
 * Seeds the store from SLACK_BOT_TOKEN + SLACK_TEAM_ID env vars.
 * Called on every fetchInstallation to survive cold starts.
 * Safe to call multiple times — is a no-op if the entry already exists.
 */
function _seedFromEnv() {
  const token = process.env.SLACK_BOT_TOKEN;
  const teamId = process.env.SLACK_TEAM_ID;
  if (!token || !teamId || _store.has(teamId)) return;

  _store.set(teamId, {
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

// Run once at module load for non-serverless environments
_seedFromEnv();

// ---------------------------------------------------------------------------
// Installation store interface (required by @slack/bolt ExpressReceiver)
// ---------------------------------------------------------------------------

const installationStore = {
  /**
   * Persist a new or updated installation.
   * Called automatically by Bolt after a successful OAuth flow.
   */
  storeInstallation: async (installation) => {
    const key = _getKey(installation);
    if (!key) throw new Error('storeInstallation: cannot determine workspace key');

    _store.set(key, {
      ...installation,
      installedAt: installation.installedAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      source: 'oauth',
    });
  },

  /**
   * Retrieve an installation by workspace/enterprise ID.
   * Called by Bolt on every incoming Slack request to resolve the bot token.
   */
  fetchInstallation: async (installQuery) => {
    // Always re-seed on fetch to survive cold starts
    _seedFromEnv();

    const key = _getKeyFromQuery(installQuery);
    if (!key) throw new Error('fetchInstallation: cannot determine workspace key');

    const installation = _store.get(key);
    if (!installation) {
      throw new Error(
        `No installation found for workspace "${key}". ` +
        `The workspace may need to re-install the app at /slack/install.`
      );
    }

    return installation;
  },

  /**
   * Remove an installation. Called when a workspace uninstalls the app.
   */
  deleteInstallation: async (installQuery) => {
    const key = _getKeyFromQuery(installQuery);
    if (!key) throw new Error('deleteInstallation: cannot determine workspace key');
    _store.delete(key);
  },
};

// ---------------------------------------------------------------------------
// Utility: get workspace ID from an installation or install query
// ---------------------------------------------------------------------------

function _getKey(installation) {
  if (installation.isEnterpriseInstall && installation.enterprise?.id) {
    return `enterprise:${installation.enterprise.id}`;
  }
  if (installation.team?.id) {
    return `team:${installation.team.id}`;
  }
  return null;
}

function _getKeyFromQuery(query) {
  if (query.isEnterpriseInstall && query.enterpriseId) {
    return `enterprise:${query.enterpriseId}`;
  }
  if (query.teamId) {
    return `team:${query.teamId}`;
  }
  return null;
}

/**
 * Returns the plain workspace ID (without prefix) from a Bolt install query.
 * Used throughout the app as the tenant identifier passed to billing/usage.
 *
 * @param {object} installQuery  — { teamId?, enterpriseId?, isEnterpriseInstall? }
 * @returns {string | null}
 */
function getWorkspaceId(installQuery) {
  if (installQuery?.isEnterpriseInstall && installQuery.enterpriseId) {
    return installQuery.enterpriseId;
  }
  return installQuery?.teamId || null;
}

/**
 * Returns the number of currently stored installations.
 * Used by the health endpoint.
 */
function getInstallationCount() {
  return _store.size;
}

module.exports = {
  ...installationStore,
  getWorkspaceId,
  getInstallationCount,
  // Exposed for testing only
  _store,
  _seedFromEnv,
};
