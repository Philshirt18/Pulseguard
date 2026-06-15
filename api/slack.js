/**
 * Vercel Serverless Entry Point for PulseGuard
 * 
 * This file exposes the Slack Bolt app as a Vercel serverless function.
 * Slack sends HTTP POST requests to /api/slack for commands and interactions.
 */

require('dotenv').config();

const { App, ExpressReceiver } = require('@slack/bolt');
const { registerCommands } = require('../src/slack/commands');
const riskDetector = require('../src/engine/riskDetector');
const { isDemoMode } = require('../src/engine/cache');

// Create a custom receiver for Vercel
const receiver = new ExpressReceiver({
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  processBeforeResponse: true,
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
