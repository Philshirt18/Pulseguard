/**
 * Vercel Serverless Entry Point for PulseGuard
 *
 * Handles:
 * - Slack slash commands and interactions (POST /api/slack)
 * - OAuth install flow (GET /slack/install)
 * - OAuth callback (GET /slack/oauth_redirect)
 */

require('dotenv').config();

const { App, ExpressReceiver } = require('@slack/bolt');
const { registerCommands } = require('../src/slack/commands');
const installationStore = require('../src/slack/installationStore');
const riskDetector = require('../src/engine/riskDetector');

const receiver = new ExpressReceiver({
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  clientId: process.env.SLACK_CLIENT_ID,
  clientSecret: process.env.SLACK_CLIENT_SECRET,
  stateSecret: process.env.SLACK_STATE_SECRET || 'pulseguard-state-secret',
  scopes: ['commands', 'chat:write', 'chat:write.public'],
  installationStore,
  installerOptions: {
    directInstall: true,
    stateVerification: true,
  },
  processBeforeResponse: true,
  endpoints: '/api/slack',
});

const app = new App({
  receiver,
  // When using installationStore, don't pass a single token — Bolt resolves it per request
  ...(process.env.SLACK_BOT_TOKEN && !process.env.SLACK_CLIENT_ID
    ? { token: process.env.SLACK_BOT_TOKEN }
    : {}),
});

// Register commands and button handlers
registerCommands(app);

// Pre-analyze risks
riskDetector.analyzeAll();

// Export the express app for Vercel
module.exports = receiver.app;
