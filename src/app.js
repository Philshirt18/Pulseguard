/**
 * PulseGuard AI
 * "Detect business risks before they become business problems."
 * 
 * Slack Agent Builder Challenge Entry
 * 
 * Features:
 * - Deterministic risk detection engine (no AI for scoring)
 * - AI-powered narrative generation (OpenAI for explanations)
 * - Response caching (instant repeated demos)
 * - Demo mode (DEMO_MODE=true for zero API dependency)
 * - Proactive alerts (posts to channel on startup)
 * - Interactive buttons (zero-typing demo flow)
 * - Live dashboard (App Home tab with risk counts)
 * - Beautiful Block Kit UI with trend charts
 */

require('dotenv').config();

const { App } = require('@slack/bolt');
const { registerCommands } = require('./slack/commands');
const riskDetector = require('./engine/riskDetector');
const blocks = require('./slack/blocks');
const { isDemoMode } = require('./engine/cache');

// Validate environment
const requiredEnvVars = ['SLACK_BOT_TOKEN', 'SLACK_SIGNING_SECRET'];
if (!isDemoMode()) requiredEnvVars.push('OPENAI_API_KEY');
const missing = requiredEnvVars.filter(v => !process.env[v]);
if (missing.length > 0) {
  console.error(`❌ Missing environment variables: ${missing.join(', ')}`);
  console.error('   Copy .env.example to .env and fill in your values.');
  process.exit(1);
}

// Initialize Slack App
// Uses Socket Mode if SLACK_APP_TOKEN is present, otherwise HTTP mode (for Vercel/serverless)
const useSocketMode = !!process.env.SLACK_APP_TOKEN;

const appConfig = {
  token: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET,
};

if (useSocketMode) {
  appConfig.socketMode = true;
  appConfig.appToken = process.env.SLACK_APP_TOKEN;
}

const app = new App(appConfig);

// Register all slash commands and button handlers
registerCommands(app);

// ==========================================
// APP HOME TAB - Live Dashboard
// ==========================================

app.event('app_home_opened', async ({ event, client }) => {
  try {
    const risks = riskDetector.analyzeAll();
    const critical = risks.filter(r => r.severity === 'critical');
    const high = risks.filter(r => r.severity === 'high');
    const medium = risks.filter(r => r.severity === 'medium');
    const topRisk = risks[0];

    await client.views.publish({
      user_id: event.user,
      view: {
        type: 'home',
        blocks: [
          {
            type: 'header',
            text: { type: 'plain_text', text: '🛡️ PulseGuard AI', emoji: true },
          },
          {
            type: 'section',
            text: { type: 'mrkdwn', text: '*Detect business risks before they become business problems.*' },
          },
          { type: 'divider' },
          // Live risk status
          {
            type: 'section',
            text: { type: 'mrkdwn', text: `📡 *Live Risk Status*` },
          },
          {
            type: 'section',
            fields: [
              { type: 'mrkdwn', text: `*🔴 Critical*\n${critical.length}` },
              { type: 'mrkdwn', text: `*🟠 High*\n${high.length}` },
              { type: 'mrkdwn', text: `*🟡 Medium*\n${medium.length}` },
              { type: 'mrkdwn', text: `*📊 Total*\n${risks.length}` },
            ],
          },
          { type: 'divider' },
          // Top threat
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `⚠️ *Highest Threat*\n${topRisk ? `${topRisk.title}\n_${topRisk.region} • Confidence: ${Math.round(topRisk.confidence * 100)}%_` : 'No critical risks detected'}`,
            },
          },
          { type: 'divider' },
          // Action buttons
          {
            type: 'section',
            text: { type: 'mrkdwn', text: `⚡ *Quick Actions*` },
          },
          {
            type: 'actions',
            elements: [
              {
                type: 'button',
                text: { type: 'plain_text', text: '🛡️ Executive Brief', emoji: true },
                action_id: 'home_executive_summary',
                style: 'primary',
              },
              {
                type: 'button',
                text: { type: 'plain_text', text: '📊 Risk Report', emoji: true },
                action_id: 'home_risk_report',
              },
              {
                type: 'button',
                text: { type: 'plain_text', text: '🔬 Deep Dive: Top Risk', emoji: true },
                action_id: `full_analysis_${topRisk?.id || 'none'}`,
                value: topRisk?.id || '',
              },
            ],
          },
          { type: 'divider' },
          // Monitoring info
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: '🏢 *Monitoring: EuroStay Rentals*\n' +
                '• 15,000 properties across 7 European regions\n' +
                '• 750 employees • 5 departments\n' +
                '• Analyzing: 381 tickets, 1,095 reviews, 201 maintenance incidents',
            },
          },
          { type: 'divider' },
          {
            type: 'context',
            elements: [
              { type: 'mrkdwn', text: `_Last updated: ${new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })} • PulseGuard AI continuously monitors operational signals_` },
            ],
          },
        ],
      },
    });
  } catch (error) {
    console.error('App Home Error:', error);
  }
});

// ==========================================
// PROACTIVE ALERT (on startup)
// ==========================================

async function sendProactiveAlert() {
  const alertChannel = process.env.ALERT_CHANNEL;
  if (!alertChannel) return;

  try {
    const risks = riskDetector.analyzeAll();
    const topRisk = risks[0];
    if (!topRisk || topRisk.severity !== 'critical') return;

    const alertBlocks = blocks.buildProactiveAlert(topRisk);
    await app.client.chat.postMessage({
      channel: alertChannel,
      blocks: alertBlocks,
      text: `⚠️ PulseGuard Alert: ${topRisk.title}`,
    });
    console.log(`  📢 Proactive alert sent to #${alertChannel}`);
  } catch (error) {
    // Non-fatal: alert channel might not exist
    console.log(`  ℹ️  Proactive alerts: set ALERT_CHANNEL in .env to enable`);
  }
}

// ==========================================
// START
// ==========================================

(async () => {
  await app.start(process.env.PORT || 3000);

  // Pre-analyze risks on startup
  const risks = riskDetector.analyzeAll();

  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  🛡️  PulseGuard AI');
  console.log('  The Organizational Early Warning System');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');
  console.log(`  ✅ Mode: ${useSocketMode ? 'Socket Mode' : 'HTTP Mode (Vercel-compatible)'}`);
  console.log('  ✅ Risk Detection Engine: ' + risks.length + ' risks detected');
  console.log(`  ✅ AI Narrative Engine: ${isDemoMode() ? 'DEMO MODE (cached)' : 'Live (OpenAI)'}`);
  console.log('  ✅ Monitoring: EuroStay Rentals');
  console.log('');
  if (isDemoMode()) {
    console.log('  ⚡ DEMO MODE — instant responses, zero API latency');
    console.log('');
  }
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  // Send proactive alert if channel configured
  await sendProactiveAlert();
})();
