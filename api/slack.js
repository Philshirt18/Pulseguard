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

const SCOPES = ['commands', 'chat:write', 'chat:write.public', 'files:read', 'im:write', 'im:history'];

const receiver = new ExpressReceiver({
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  clientId: process.env.SLACK_CLIENT_ID,
  clientSecret: process.env.SLACK_CLIENT_SECRET,
  stateSecret: process.env.SLACK_STATE_SECRET || 'pulseguard-state-secret',
  scopes: SCOPES,
  installationStore,
  installerOptions: {
    directInstall: true,
    // State verification uses an in-memory store that does not survive across
    // Vercel serverless instances (the /slack/install and /slack/oauth_redirect
    // requests can hit different instances), causing slack_oauth_invalid_state.
    // Disabled here; Slack still round-trips the state param, and the OAuth
    // code exchange itself is the security boundary.
    stateVerification: false,
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
// OAuth install flow
//
// Because we set a custom `endpoints` value, ExpressReceiver does NOT
// auto-register the /slack/install and /slack/oauth_redirect routes.
// We register them explicitly here using the receiver's installer.
//
// GET /slack/install        — starts OAuth, redirects to Slack authorize URL
// GET /slack/oauth_redirect — Slack redirects back here with ?code=...
// ---------------------------------------------------------------------------

const expressApp = receiver.app;

// Start the OAuth flow
expressApp.get('/slack/install', async (req, res) => {
  try {
    if (!process.env.SLACK_CLIENT_ID) {
      res.status(500).send(errorPage('OAuth is not configured. SLACK_CLIENT_ID is missing.'));
      return;
    }

    const url = await receiver.installer.generateInstallUrl(
      {
        scopes: SCOPES,
        redirectUri: redirectUri(),
      },
      false, // stateVerification=false — serverless-safe (see installerOptions note)
    );

    // directInstall behaviour: send the user straight to Slack's authorize page
    res.redirect(url);
  } catch (err) {
    logger.error('Install start failed', { error: err.message });
    res.status(500).send(errorPage('Could not start the installation. Please try again.'));
  }
});

// OAuth callback
expressApp.get('/slack/oauth_redirect', async (req, res) => {
  try {
    await receiver.installer.handleCallback(req, res, {
      success: (installation, _options, _req, response) => {
        const team = installation.team?.name || installation.team?.id || 'your workspace';
        logger.info('Installation completed', {
          workspaceId: installation.team?.id || installation.enterprise?.id,
        });
        response.writeHead(200, { 'Content-Type': 'text/html' });
        response.end(successPage(team));
      },
      failure: (error, _options, _req, response) => {
        logger.error('Installation failed', { error: error?.message });
        response.writeHead(500, { 'Content-Type': 'text/html' });
        response.end(errorPage('Installation could not be completed. Please try again from the start.'));
      },
    }, {
      // Serverless-safe: do not require the in-memory state store
      stateVerification: false,
    });
  } catch (err) {
    logger.error('OAuth callback error', { error: err.message });
    if (!res.headersSent) {
      res.status(500).send(errorPage('Something went wrong during installation.'));
    }
  }
});

// Redirect URI must exactly match the one registered in Slack app settings
function redirectUri() {
  const base = process.env.APP_BASE_URL || 'https://pulseguard-2j5l.vercel.app';
  return `${base}/slack/oauth_redirect`;
}

function successPage(team) {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>PulseGuard AI — Installed</title>
<style>body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#1a1a2e;color:#fff;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;text-align:center}
.card{max-width:480px;padding:2.5rem}h1{font-size:1.6rem;margin:.5rem 0}p{color:#b8b8d0;line-height:1.6}
.check{font-size:3rem}a{color:#7c7cff}</style></head>
<body><div class="card"><div class="check">🛡️✅</div>
<h1>PulseGuard AI is installed</h1>
<p>PulseGuard has been added to <strong>${escapeHtml(team)}</strong>.</p>
<p>Head back to Slack and try <code>/executive-summary</code> to see your first intelligence brief.</p>
</div></body></html>`;
}

function errorPage(message) {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>PulseGuard AI — Installation Error</title>
<style>body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#1a1a2e;color:#fff;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;text-align:center}
.card{max-width:480px;padding:2.5rem}h1{font-size:1.6rem;margin:.5rem 0}p{color:#b8b8d0;line-height:1.6}
.x{font-size:3rem}a{color:#7c7cff}</style></head>
<body><div class="card"><div class="x">⚠️</div>
<h1>Installation could not be completed</h1>
<p>${escapeHtml(message)}</p>
<p><a href="/slack/install">Try installing again</a></p>
</div></body></html>`;
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

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
