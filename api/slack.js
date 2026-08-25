/**
 * PulseGuard — Vercel Serverless Entry Point
 *
 * Handles:
 * - Slack slash commands and interactions  POST /api/slack
 * - OAuth install flow                     GET  /slack/install
 * - OAuth callback                         GET  /slack/oauth_redirect
 * - Application health check              GET  /health
 *
 * Security:
 * - All Slack requests are verified via HMAC signature (Bolt handles this)
 * - OAuth state is verified to prevent CSRF (stateVerification: true)
 * - Tokens are never logged — only workspace/user IDs
 */

require('dotenv').config();

const { App, ExpressReceiver } = require('@slack/bolt');
const { registerCommands } = require('../src/slack/commands');
const installationStore = require('../src/slack/installationStore');
const billingService = require('../src/services/billingService');
const riskDetector = require('../src/engine/riskDetector');
const logger = require('../src/services/logger');

// ---------------------------------------------------------------------------
// Bolt receiver
// ---------------------------------------------------------------------------

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
  // When installationStore is active, Bolt resolves the token per workspace.
  // Fall back to a single token only in legacy single-workspace mode
  // (when CLIENT_ID is not set, i.e. OAuth is not configured).
  ...(process.env.SLACK_BOT_TOKEN && !process.env.SLACK_CLIENT_ID
    ? { token: process.env.SLACK_BOT_TOKEN }
    : {}),
});

// ---------------------------------------------------------------------------
// Register all slash commands and button handlers
// ---------------------------------------------------------------------------

registerCommands(app);

// ---------------------------------------------------------------------------
// Health endpoint — safe to expose publicly
// Returns service status without leaking secrets or internal state
// ---------------------------------------------------------------------------

receiver.app.get('/health', (_req, res) => {
  const risks = riskDetector.getRisksSorted();

  res.json({
    status: 'ok',
    service: 'pulseguard',
    timestamp: new Date().toISOString(),
    demo: process.env.DEMO_MODE === 'true',
    risks: {
      total: risks.length,
      critical: risks.filter(r => r.severity === 'critical').length,
      high: risks.filter(r => r.severity === 'high').length,
    },
    installations: installationStore.getInstallationCount(),
    uptime: Math.round(process.uptime()),
  });
});

// ---------------------------------------------------------------------------
// Warm up the risk engine on cold start
// ---------------------------------------------------------------------------

try {
  riskDetector.analyzeAll();
  logger.info('PulseGuard started', {
    demo: process.env.DEMO_MODE === 'true',
    installations: installationStore.getInstallationCount(),
  });
} catch (err) {
  logger.error('Risk engine warm-up failed', { error: err.message });
}

// ---------------------------------------------------------------------------
// Export Express app for Vercel
// ---------------------------------------------------------------------------

module.exports = receiver.app;
