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
const logger = require('../services/logger');

function registerCommands(app) {
  // ==========================================
  // BUTTON ACTIONS (interactive clicks)
  // ==========================================

  // "Why?" / "Investigate" / "Root Cause" button handler
  app.action(/why_risk_(.+)/, async ({ action, ack, respond, body }) => {
    await ack();
    const riskId = action.value;
    const context = _context(body);

    try {
      riskDetector.analyzeAll();
      const risk = riskDetector.getRiskById(riskId);
      if (!risk) {
        await respond({ response_type: 'ephemeral', blocks: blocks.buildErrorMessage(`Risk "${riskId}" not found.`) });
        return;
      }

      const analysis = await generateRootCauseAnalysis(risk, context);
      if (analysis._limitExceeded) {
        await respond({ response_type: 'ephemeral', blocks: blocks.buildErrorMessage(analysis.explanation) });
        return;
      }
      await respond({ response_type: 'in_channel', replace_original: false, blocks: blocks.buildRootCauseAnalysis(risk, analysis) });
    } catch (error) {
      console.error('Button Why Risk Error:', error);
      await respond({ response_type: 'ephemeral', blocks: blocks.buildErrorMessage('Failed to generate analysis. Please try again.') });
    }
  });

  // "Recommend Action" / "Get Actions" button handler
  app.action(/recommend_btn_(.+)/, async ({ action, ack, respond, body }) => {
    await ack();
    const riskId = action.value;
    const context = _context(body);

    try {
      riskDetector.analyzeAll();
      const risk = riskDetector.getRiskById(riskId);
      if (!risk) {
        await respond({ response_type: 'ephemeral', blocks: blocks.buildErrorMessage(`Risk "${riskId}" not found.`) });
        return;
      }

      const recommendations = await generateRecommendations(risk, context);
      if (recommendations._limitExceeded) {
        await respond({ response_type: 'ephemeral', blocks: blocks.buildErrorMessage(recommendations.executiveSummary) });
        return;
      }
      await respond({ response_type: 'in_channel', replace_original: false, blocks: blocks.buildRecommendations(risk, recommendations) });

      // Approval request for critical/high risks
      if ((risk.severity === 'critical' || risk.severity === 'high') && recommendations.immediateActions?.length > 0) {
        const topAction = recommendations.immediateActions[0];
        await respond({
          response_type: 'in_channel',
          replace_original: false,
          blocks: blocks.buildApprovalRequest({
            risk,
            action: topAction.action,
            actionIndex: 0,
            owner: topAction.owner,
            timeline: topAction.timeline,
          }),
        });
      }
    } catch (error) {
      console.error('Button Recommend Error:', error);
      await respond({ response_type: 'ephemeral', blocks: blocks.buildErrorMessage('Failed to generate recommendations.') });
    }
  });

  // "Full Analysis" button — chains root cause + recommendations
  app.action(/full_analysis_(.+)/, async ({ action, ack, respond, body }) => {
    await ack();
    const riskId = action.value;
    const context = _context(body);

    try {
      riskDetector.analyzeAll();
      const risk = riskDetector.getRiskById(riskId);
      if (!risk) {
        await respond({ response_type: 'ephemeral', blocks: blocks.buildErrorMessage(`Risk "${riskId}" not found.`) });
        return;
      }

      const analysis = await generateRootCauseAnalysis(risk, context);
      if (analysis._limitExceeded) {
        await respond({ response_type: 'ephemeral', blocks: blocks.buildErrorMessage(analysis.explanation) });
        return;
      }
      await respond({ response_type: 'in_channel', replace_original: false, blocks: blocks.buildRootCauseAnalysis(risk, analysis) });

      const recommendations = await generateRecommendations(risk, context);
      if (!recommendations._limitExceeded) {
        await respond({ response_type: 'in_channel', replace_original: false, blocks: blocks.buildRecommendations(risk, recommendations) });
      }
    } catch (error) {
      console.error('Full Analysis Error:', error);
      await respond({ response_type: 'ephemeral', blocks: blocks.buildErrorMessage('Failed to generate full analysis.') });
    }
  });

  // Home tab buttons
  app.action('home_executive_summary', async ({ ack, client, body }) => {
    await ack();
    const context = _context(body);
    try {
      await client.chat.postMessage({
        channel: body.user.id,
        blocks: blocks.buildAnalyzingMessage(),
        text: 'PulseGuard AI is analyzing...',
      });

      const risks = riskDetector.analyzeAll();
      const summary = await generateExecutiveSummary(risks, context);
      await client.chat.postMessage({
        channel: body.user.id,
        blocks: blocks.buildExecutiveSummary(summary, risks),
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
      try {
        await respond({ response_type: 'in_channel', replace_original: false, blocks: messageBlocks });
      } catch {
        await client.chat.postMessage({ channel: body.user.id, blocks: messageBlocks, text: 'PulseGuard Risk Report' });
      }
    } catch (error) {
      console.error('Home Risk Report Error:', error);
    }
  });

  // ==========================================
  // SLASH COMMANDS
  // ==========================================
  // Handles approval/rejection of high-impact AI recommendations.
  // The AI suggests; a human confirms before any action is logged as approved.

  app.action(/approve_action_(.+)/, async ({ action, ack, respond, body }) => {
    await ack();
    const [riskId, actionIndex] = action.value.split('::');
    const approvedBy = body?.user?.id || 'unknown';
    const workspaceId = body?.team?.id || 'unknown';

    logger.info('Action approved', { workspaceId, riskId, actionIndex, approvedBy });

    await respond({
      response_type: 'in_channel',
      replace_original: false,
      blocks: blocks.buildApprovalConfirmed({
        riskId,
        actionIndex: parseInt(actionIndex, 10),
        approvedBy,
        approved: true,
      }),
    });
  });

  app.action(/reject_action_(.+)/, async ({ action, ack, respond, body }) => {
    await ack();
    const [riskId, actionIndex] = action.value.split('::');
    const rejectedBy = body?.user?.id || 'unknown';
    const workspaceId = body?.team?.id || 'unknown';

    logger.info('Action rejected', { workspaceId, riskId, actionIndex, rejectedBy });

    await respond({
      response_type: 'in_channel',
      replace_original: false,
      blocks: blocks.buildApprovalConfirmed({
        riskId,
        actionIndex: parseInt(actionIndex, 10),
        approvedBy: rejectedBy,
        approved: false,
      }),
    });
  });

  app.command('/pulse', async ({ command, ack, respond }) => {
    await ack();
    try {
      const risks = riskDetector.analyzeAll();
      await respond({ response_type: 'in_channel', blocks: blocks.buildPulseStatus(risks) });
    } catch (error) {
      console.error('Pulse Error:', error);
      await respond({ response_type: 'ephemeral', blocks: blocks.buildErrorMessage('Failed to get pulse status.') });
    }
  });

  app.command('/executive-summary', async ({ command, ack, respond }) => {
    await ack();
    const context = _contextFromCommand(command);
    try {
      const risks = riskDetector.analyzeAll();
      const summary = await generateExecutiveSummary(risks, context);
      if (summary._limitExceeded) {
        await respond({ response_type: 'ephemeral', blocks: blocks.buildErrorMessage(summary.criticalInsight) });
        return;
      }
      await respond({ response_type: 'in_channel', blocks: blocks.buildExecutiveSummary(summary, risks) });
    } catch (error) {
      console.error('Executive Summary Error:', error);
      await respond({ response_type: 'ephemeral', blocks: blocks.buildErrorMessage('Failed to generate executive summary. Please try again.') });
    }
  });

  app.command('/risk-report', async ({ command, ack, respond }) => {
    await ack();
    try {
      const risks = riskDetector.analyzeAll();
      await respond({ response_type: 'in_channel', blocks: blocks.buildRiskReport(risks) });
    } catch (error) {
      console.error('Risk Report Error:', error);
      await respond({ response_type: 'ephemeral', blocks: blocks.buildErrorMessage('Failed to generate risk report. Please try again.') });
    }
  });

  app.command('/why-risk', async ({ command, ack, respond }) => {
    await ack();
    const riskId = command.text?.trim();
    const context = _contextFromCommand(command);

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

      const analysis = await generateRootCauseAnalysis(risk, context);
      if (analysis._limitExceeded) {
        await respond({ response_type: 'ephemeral', blocks: blocks.buildErrorMessage(analysis.explanation) });
        return;
      }
      await respond({ response_type: 'in_channel', blocks: blocks.buildRootCauseAnalysis(risk, analysis) });
    } catch (error) {
      console.error('Why Risk Error:', error);
      await respond({ response_type: 'ephemeral', blocks: blocks.buildErrorMessage('Failed to generate root cause analysis. Please try again.') });
    }
  });

  app.command('/recommend-action', async ({ command, ack, respond }) => {
    await ack();
    const riskId = command.text?.trim();
    const context = _contextFromCommand(command);

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

      const recommendations = await generateRecommendations(risk, context);
      if (recommendations._limitExceeded) {
        await respond({ response_type: 'ephemeral', blocks: blocks.buildErrorMessage(recommendations.executiveSummary) });
        return;
      }
      await respond({ response_type: 'in_channel', blocks: blocks.buildRecommendations(risk, recommendations) });

      // For critical/high risks: append approval request for the top immediate action
      if ((risk.severity === 'critical' || risk.severity === 'high') && recommendations.immediateActions?.length > 0) {
        const topAction = recommendations.immediateActions[0];
        await respond({
          response_type: 'in_channel',
          replace_original: false,
          blocks: blocks.buildApprovalRequest({
            risk,
            action: topAction.action,
            actionIndex: 0,
            owner: topAction.owner,
            timeline: topAction.timeline,
          }),
        });
      }
    } catch (error) {
      console.error('Recommend Action Error:', error);
      await respond({ response_type: 'ephemeral', blocks: blocks.buildErrorMessage('Failed to generate recommendations. Please try again.') });
    }
  });
}

// Helper: find risk by exact or partial match
function findRisk(riskId) {
  const risk = riskDetector.getRiskById(riskId);
  if (risk) return risk;
  const allRisks = riskDetector.getRisksSorted();
  return allRisks.find(r => r.id.includes(riskId) || riskId.includes(r.id)) || null;
}

/**
 * Builds a workspace context object from a Slack button interaction body.
 * Used to pass workspace + user identity into AI calls for billing tracking.
 */
function _context(body) {
  return {
    workspaceId: body?.team?.id || body?.enterprise?.id || process.env.SLACK_TEAM_ID || 'unknown',
    userId: body?.user?.id || 'unknown',
    planId: 'free', // TODO: replace with billingService.getPlanForWorkspace(workspaceId).id
  };
}

/**
 * Builds a workspace context object from a Slack slash command payload.
 */
function _contextFromCommand(command) {
  return {
    workspaceId: command?.team_id || process.env.SLACK_TEAM_ID || 'unknown',
    userId: command?.user_id || 'unknown',
    planId: 'free', // TODO: replace with billingService.getPlanForWorkspace(workspaceId).id
  };
}

module.exports = { registerCommands };
