/**
 * PulseGuard AI - Slack Command & Action Handlers
 * 
 * Commands:
 * /executive-summary - Executive Intelligence Brief
 * /risk-report - All risks ranked by severity
 * /why-risk [risk-id] - Root cause analysis
 * /recommend-action [risk-id] - Recommendations + business impact
 * /pulse - Quick status check
 * 
 * Interactive buttons throughout for zero-typing demo flow.
 */

const riskDetector = require('../engine/riskDetector');
const { generateRootCauseAnalysis, generateRecommendations, generateExecutiveSummary } = require('../engine/aiNarrative');
const blocks = require('./blocks');

function registerCommands(app) {
  // ==========================================
  // BUTTON ACTIONS (interactive clicks)
  // ==========================================

  // "Why?" / "Investigate" / "Root Cause" button handler
  app.action(/why_risk_(.+)/, async ({ action, ack, respond, client, body }) => {
    await ack();
    const riskId = action.value;

    try {
      riskDetector.analyzeAll();
      const risk = riskDetector.getRiskById(riskId);
      if (!risk) {
        await respond({ response_type: 'ephemeral', blocks: blocks.buildErrorMessage(`Risk "${riskId}" not found.`) });
        return;
      }

      const analysis = await generateRootCauseAnalysis(risk);
      const messageBlocks = blocks.buildRootCauseAnalysis(risk, analysis);
      await respond({ response_type: 'in_channel', replace_original: false, blocks: messageBlocks });
    } catch (error) {
      console.error('Button Why Risk Error:', error);
      await respond({ response_type: 'ephemeral', blocks: blocks.buildErrorMessage('Failed to generate analysis. Please try again.') });
    }
  });

  // "Recommend Action" / "Get Actions" button handler
  app.action(/recommend_btn_(.+)/, async ({ action, ack, respond }) => {
    await ack();
    const riskId = action.value;

    try {
      riskDetector.analyzeAll();
      const risk = riskDetector.getRiskById(riskId);
      if (!risk) {
        await respond({ response_type: 'ephemeral', blocks: blocks.buildErrorMessage(`Risk "${riskId}" not found.`) });
        return;
      }

      const recommendations = await generateRecommendations(risk);
      const messageBlocks = blocks.buildRecommendations(risk, recommendations);
      await respond({ response_type: 'in_channel', replace_original: false, blocks: messageBlocks });
    } catch (error) {
      console.error('Button Recommend Error:', error);
      await respond({ response_type: 'ephemeral', blocks: blocks.buildErrorMessage('Failed to generate recommendations.') });
    }
  });

  // "Full Analysis" button - chains root cause + recommendations in one go
  app.action(/full_analysis_(.+)/, async ({ action, ack, respond }) => {
    await ack();
    const riskId = action.value;

    try {
      riskDetector.analyzeAll();
      const risk = riskDetector.getRiskById(riskId);
      if (!risk) {
        await respond({ response_type: 'ephemeral', blocks: blocks.buildErrorMessage(`Risk "${riskId}" not found.`) });
        return;
      }

      // Send root cause first
      const analysis = await generateRootCauseAnalysis(risk);
      const rcaBlocks = blocks.buildRootCauseAnalysis(risk, analysis);
      await respond({ response_type: 'in_channel', replace_original: false, blocks: rcaBlocks });

      // Then send recommendations
      const recommendations = await generateRecommendations(risk);
      const recBlocks = blocks.buildRecommendations(risk, recommendations);
      await respond({ response_type: 'in_channel', replace_original: false, blocks: recBlocks });
    } catch (error) {
      console.error('Full Analysis Error:', error);
      await respond({ response_type: 'ephemeral', blocks: blocks.buildErrorMessage('Failed to generate full analysis.') });
    }
  });

  // Home tab buttons
  app.action('home_executive_summary', async ({ ack, client, body }) => {
    await ack();
    try {
      // Send analyzing indicator
      await client.chat.postMessage({
        channel: body.user.id,
        blocks: blocks.buildAnalyzingMessage({ tickets: 381, reviews: 1095, maintenance: 201 }),
        text: 'PulseGuard AI is analyzing...',
      });

      const risks = riskDetector.analyzeAll();
      const summary = await generateExecutiveSummary(risks);
      const messageBlocks = blocks.buildExecutiveSummary(summary, risks);

      await client.chat.postMessage({
        channel: body.user.id,
        blocks: messageBlocks,
        text: 'PulseGuard Executive Intelligence Brief',
      });
    } catch (error) {
      console.error('Home Executive Summary Error:', error);
    }
  });

  app.action('home_risk_report', async ({ ack, client, body, respond }) => {
    await ack();
    try {
      const risks = riskDetector.analyzeAll();
      const messageBlocks = blocks.buildRiskReport(risks);

      // Try respond first (works from messages), fall back to postMessage
      try {
        await respond({ response_type: 'in_channel', replace_original: false, blocks: messageBlocks });
      } catch {
        await client.chat.postMessage({
          channel: body.user.id,
          blocks: messageBlocks,
          text: 'PulseGuard Risk Report',
        });
      }
    } catch (error) {
      console.error('Home Risk Report Error:', error);
    }
  });

  // ==========================================
  // SLASH COMMANDS
  // ==========================================

  // /pulse - Quick status (one-liner)
  app.command('/pulse', async ({ command, ack, respond }) => {
    await ack();
    try {
      const risks = riskDetector.analyzeAll();
      const messageBlocks = blocks.buildPulseStatus(risks);
      await respond({ response_type: 'in_channel', blocks: messageBlocks });
    } catch (error) {
      console.error('Pulse Error:', error);
      await respond({ response_type: 'ephemeral', blocks: blocks.buildErrorMessage('Failed to get pulse status.') });
    }
  });

  // /executive-summary
  app.command('/executive-summary', async ({ command, ack, respond }) => {
    await ack();

    try {
      const risks = riskDetector.analyzeAll();
      const summary = await generateExecutiveSummary(risks);
      const messageBlocks = blocks.buildExecutiveSummary(summary, risks);

      await respond({
        response_type: 'in_channel',
        blocks: messageBlocks,
      });
    } catch (error) {
      console.error('Executive Summary Error:', error);
      await respond({
        response_type: 'ephemeral',
        blocks: blocks.buildErrorMessage('Failed to generate executive summary. Please try again.'),
      });
    }
  });

  // /risk-report
  app.command('/risk-report', async ({ command, ack, respond }) => {
    await ack();

    try {
      const risks = riskDetector.analyzeAll();
      const messageBlocks = blocks.buildRiskReport(risks);

      await respond({
        response_type: 'in_channel',
        blocks: messageBlocks,
      });
    } catch (error) {
      console.error('Risk Report Error:', error);
      await respond({
        response_type: 'ephemeral',
        blocks: blocks.buildErrorMessage('Failed to generate risk report. Please try again.'),
      });
    }
  });

  // /why-risk [risk-id]
  app.command('/why-risk', async ({ command, ack, respond }) => {
    await ack();

    const riskId = command.text?.trim();

    if (!riskId) {
      await respond({
        response_type: 'ephemeral',
        blocks: blocks.buildErrorMessage('Please provide a risk ID.\nUsage: `/why-risk risk-ops-ven-001`\n\nUse `/risk-report` to see all risk IDs.'),
      });
      return;
    }

    try {
      riskDetector.analyzeAll();
      const risk = findRisk(riskId);

      if (!risk) {
        const allRisks = riskDetector.getRisksSorted();
        await respond({
          response_type: 'ephemeral',
          blocks: blocks.buildErrorMessage(`Risk "${riskId}" not found.\n\nAvailable risk IDs:\n${allRisks.slice(0, 8).map(r => `• \`${r.id}\` — ${r.title}`).join('\n')}`),
        });
        return;
      }

      const analysis = await generateRootCauseAnalysis(risk);
      const messageBlocks = blocks.buildRootCauseAnalysis(risk, analysis);
      await respond({ response_type: 'in_channel', blocks: messageBlocks });
    } catch (error) {
      console.error('Why Risk Error:', error);
      await respond({
        response_type: 'ephemeral',
        blocks: blocks.buildErrorMessage('Failed to generate root cause analysis. Please try again.'),
      });
    }
  });

  // /recommend-action [risk-id]
  app.command('/recommend-action', async ({ command, ack, respond }) => {
    await ack();

    const riskId = command.text?.trim();

    if (!riskId) {
      await respond({
        response_type: 'ephemeral',
        blocks: blocks.buildErrorMessage('Please provide a risk ID.\nUsage: `/recommend-action risk-ops-ven-001`\n\nUse `/risk-report` to see all risk IDs.'),
      });
      return;
    }

    try {
      riskDetector.analyzeAll();
      const risk = findRisk(riskId);

      if (!risk) {
        const allRisks = riskDetector.getRisksSorted();
        await respond({
          response_type: 'ephemeral',
          blocks: blocks.buildErrorMessage(`Risk "${riskId}" not found.\n\nAvailable risk IDs:\n${allRisks.slice(0, 8).map(r => `• \`${r.id}\` — ${r.title}`).join('\n')}`),
        });
        return;
      }

      const recommendations = await generateRecommendations(risk);
      const messageBlocks = blocks.buildRecommendations(risk, recommendations);
      await respond({ response_type: 'in_channel', blocks: messageBlocks });
    } catch (error) {
      console.error('Recommend Action Error:', error);
      await respond({
        response_type: 'ephemeral',
        blocks: blocks.buildErrorMessage('Failed to generate recommendations. Please try again.'),
      });
    }
  });
}

// Helper: find risk by exact or partial match
function findRisk(riskId) {
  const risk = riskDetector.getRiskById(riskId);
  if (risk) return risk;

  // Partial match
  const allRisks = riskDetector.getRisksSorted();
  return allRisks.find(r => r.id.includes(riskId) || riskId.includes(r.id)) || null;
}

module.exports = { registerCommands };
