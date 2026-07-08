/**
 * PulseGuard — Slack Installation Store
 *
 * Stores OAuth installations so the app can serve multiple workspaces.
 *
 * Strategy:
 * - Uses in-memory Map as the primary store (works for single Vercel instance)
 * - On cold start, seeds from SLACK_BOT_TOKEN env var if present (backward compat)
 * - For true multi-tenant production, swap this with Vercel KV, DynamoDB, or Postgres
 */

const installations = new Map();

/**
 * Seed the store with the legacy single-workspace token if present.
 * This keeps backward compatibility — existing deployments continue to work
 * without requiring every workspace to re-install.
 */
function seedFromEnv() {
  if (process.env.SLACK_BOT_TOKEN && process.env.SLACK_TEAM_ID) {
    const teamId = process.env.SLACK_TEAM_ID;
    if (!installations.has(teamId)) {
      installations.set(teamId, {
        team: { id: teamId },
        bot: {
          token: process.env.SLACK_BOT_TOKEN,
          scopes: ['commands', 'chat:write', 'chat:write.public'],
          userId: process.env.SLACK_BOT_USER_ID || 'unknown',
        },
      });
    }
  }
}

seedFromEnv();

const installationStore = {
  storeInstallation: async (installation) => {
    if (installation.isEnterpriseInstall && installation.enterprise) {
      installations.set(installation.enterprise.id, installation);
      console.log(`  ✅ Stored enterprise installation: ${installation.enterprise.id}`);
    } else if (installation.team) {
      installations.set(installation.team.id, installation);
      console.log(`  ✅ Stored team installation: ${installation.team.id}`);
    } else {
      throw new Error('Failed to store installation: no team or enterprise ID');
    }
  },

  fetchInstallation: async (installQuery) => {
    // Seed on every fetch in case of cold start
    seedFromEnv();

    if (installQuery.isEnterpriseInstall && installQuery.enterpriseId) {
      const install = installations.get(installQuery.enterpriseId);
      if (install) return install;
      throw new Error(`No installation found for enterprise: ${installQuery.enterpriseId}`);
    }

    if (installQuery.teamId) {
      const install = installations.get(installQuery.teamId);
      if (install) return install;
      throw new Error(`No installation found for team: ${installQuery.teamId}`);
    }

    throw new Error('Failed to fetch installation: no teamId or enterpriseId');
  },

  deleteInstallation: async (installQuery) => {
    if (installQuery.isEnterpriseInstall && installQuery.enterpriseId) {
      installations.delete(installQuery.enterpriseId);
    } else if (installQuery.teamId) {
      installations.delete(installQuery.teamId);
    } else {
      throw new Error('Failed to delete installation: no teamId or enterpriseId');
    }
  },
};

module.exports = installationStore;
