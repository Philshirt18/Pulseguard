/**
 * Vercel Serverless Entry Point for PulseGuard
 * Slack sends HTTP POST requests here for commands and interactions.
 */

require('dotenv').config();

const { App, ExpressReceiver } = require('@slack/bolt');
const { registerCommands } = require('../src/slack/commands');
const riskDetector = require('../src/engine/riskDetector');

// Create receiver that listens at the root path (Vercel routes /api/slack here)
const receiver = new ExpressReceiver({
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  processBeforeResponse: true,
  endpoints: '/api/slack',
});

const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  receiver,
});

// Register commands and button handlers
registerCommands(app);

// Pre-analyze risks
riskDetector.analyzeAll();

// Export the express app for Vercel
module.exports = receiver.app;
