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
const { createDetector } = require('../engine/riskDetector');
const { generateRootCauseAnalysis, generateRecommendations, generateExecutiveSummary } = require('../engine/aiNarrative');
const dataStore = require('../services/dataStore');
const { parseUpload } = require('../services/dataParser');
const blocks = require('./blocks');
const logger = require('../services/logger');

/**
 * Resolves the risk detector for a workspace.
 *
 * If the workspace has uploaded its own dataset, returns a detector bound to
 * that data. Otherwise falls back to the shared demo dataset (flagged as demo
 * so the UI can label it as sample data).
 *
 * @param {string} workspaceId
 * @returns {Promise<{ detector: object, risks: object[], isDemo: boolean }>}
 */
async function resolveDetector(workspaceId) {
  let dataset = null;
  try {
    if (workspaceId && workspaceId !== 'unknown') {
      dataset = await dataStore.getDataset(workspaceId);
    }
  } catch (err) {
    logger.error('Failed to load workspace dataset', { workspaceId, error: err.message });
  }

  if (dataset) {
    const detector = createDetector(dataset);
    return { detector, risks: detector.analyzeAll(), isDemo: false };
  }

  // Fallback: shared demo dataset singleton
  const risks = riskDetector.analyzeAll();
  return { detector: riskDetector, risks, isDemo: true };
}

/**
 * Finds a risk by exact or partial ID match within a resolved detector.
 */
function findRiskIn(detector, riskId) {
  const risk = detector.getRiskById(riskId);
  if (risk) return risk;
  const all = detector.getRisksSorted();
  return all.find(r => r.id.includes(riskId) || riskId.includes(r.id)) || null;
}

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
      const { detector } = await resolveDetector(context.workspaceId);
      const risk = detector.getRiskById(riskId);
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
      const { detector } = await resolveDetector(context.workspaceId);
      const risk = detector.getRiskById(riskId);
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
      const { detector } = await resolveDetector(context.workspaceId);
      const risk = detector.getRiskById(riskId);
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

      const { risks } = await resolveDetector(context.workspaceId);
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
      const { risks } = await resolveDetector(_context(body).workspaceId);
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
    const context = _contextFromCommand(command);
    try {
      const { risks } = await resolveDetector(context.workspaceId);
      await respond({ response_type: 'in_channel', blocks: blocks.buildPulseStatus(risks) });
    } catch (error) {
      console.error('Pulse Error:', error);
      await respond({ response_type: 'ephemeral', blocks: blocks.buildErrorMessage('Failed to get pulse status.') });
    }
  });

  // /pulseguard-upload — instructions for uploading your own data
  app.command('/pulseguard-upload', async ({ ack, respond }) => {
    await ack();
    await respond({ response_type: 'ephemeral', blocks: blocks.buildUploadInstructions() });
  });

  // /pulseguard-load — open a modal to paste JSON/CSV data directly.
  // This is the reliable path on serverless (uses the interactivity endpoint,
  // no file events or extra scopes needed).
  app.command('/pulseguard-load', async ({ ack, body, client }) => {
    await ack();
    try {
      await client.views.open({
        trigger_id: body.trigger_id,
        view: blocks.buildLoadDataModal(),
      });
    } catch (error) {
      logger.error('Failed to open load modal', { error: error.message });
    }
  });

  // Handle the paste-data modal submission
  app.view('load_data_modal', async ({ ack, body, view, client }) => {
    const workspaceId = body?.team?.id || body?.user?.team_id || process.env.SLACK_TEAM_ID || 'unknown';
    const userId = body?.user?.id || 'unknown';

    const raw = view.state.values?.data_block?.data_input?.value || '';
    const format = view.state.values?.format_block?.format_select?.selected_option?.value || 'json';

    const result = parseUpload(raw, format === 'csv' ? 'pasted.csv' : 'pasted.json');

    if (!result.ok) {
      // Show validation errors inside the modal
      await ack({
        response_action: 'errors',
        errors: {
          data_block: (result.errors[0] || 'Invalid data.').slice(0, 150),
        },
      });
      return;
    }

    // Save the dataset first — this is the operation that matters.
    let saved;
    try {
      saved = await dataStore.saveDataset(workspaceId, result.dataset, { uploadedBy: userId, source: result.source });
      logger.info('Workspace data loaded via modal', { workspaceId, source: result.source, counts: saved.counts });
    } catch (error) {
      logger.error('Modal data save failed', { workspaceId, error: error.message });
      // Surface the failure inside the modal so the user knows it didn't save
      await ack({
        response_action: 'errors',
        errors: { data_block: 'Could not save your data. Please try again.' },
      });
      return;
    }

    // Data saved — close the modal and show a confirmation
    await ack({
      response_action: 'update',
      view: {
        type: 'modal',
        title: { type: 'plain_text', text: 'Data Loaded' },
        close: { type: 'plain_text', text: 'Done' },
        blocks: blocks.buildUploadResult({
          ok: true,
          counts: saved.counts,
          warnings: result.warnings,
          source: result.source,
        }),
      },
    });

    // Best-effort DM confirmation (ignored if messages tab is disabled)
    try {
      const dm = await _openDm(client, userId);
      await _dm(client, dm, blocks.buildUploadResult({
        ok: true,
        counts: saved.counts,
        warnings: result.warnings,
        source: result.source,
      }));
    } catch { /* best effort — the modal already confirmed success */ }
  });

  // /pulseguard-data — show what data is currently loaded for this workspace
  app.command('/pulseguard-data', async ({ command, ack, respond }) => {
    await ack();
    const context = _contextFromCommand(command);
    try {
      const info = await dataStore.getDatasetInfo(context.workspaceId);
      await respond({ response_type: 'ephemeral', blocks: blocks.buildDataStatus(info) });
    } catch (error) {
      console.error('Data Status Error:', error);
      await respond({ response_type: 'ephemeral', blocks: blocks.buildErrorMessage('Could not read your data status.') });
    }
  });

  // Reset to sample data (delete uploaded dataset)
  app.action('reset_to_demo', async ({ ack, respond, body }) => {
    await ack();
    const workspaceId = _context(body).workspaceId;
    try {
      const removed = await dataStore.deleteDataset(workspaceId);
      logger.info('Dataset reset to demo', { workspaceId, removed });
      await respond({
        response_type: 'ephemeral',
        blocks: blocks.buildErrorMessage(removed
          ? '✅ Your uploaded data has been removed. PulseGuard is now using sample data again.'
          : 'You had no uploaded data. PulseGuard is using sample data.'),
      });
    } catch (error) {
      console.error('Reset Error:', error);
      await respond({ response_type: 'ephemeral', blocks: blocks.buildErrorMessage('Could not reset your data.') });
    }
  });

  app.command('/executive-summary', async ({ command, ack, respond }) => {
    await ack();
    const context = _contextFromCommand(command);
    try {
      const { risks, isDemo } = await resolveDetector(context.workspaceId);
      const summary = await generateExecutiveSummary(risks, context);
      if (summary._limitExceeded) {
        await respond({ response_type: 'ephemeral', blocks: blocks.buildErrorMessage(summary.criticalInsight) });
        return;
      }
      const messageBlocks = blocks.buildExecutiveSummary(summary, risks);
      await respond({ response_type: 'in_channel', blocks: _withDemoNotice(messageBlocks, isDemo) });
    } catch (error) {
      console.error('Executive Summary Error:', error);
      await respond({ response_type: 'ephemeral', blocks: blocks.buildErrorMessage('Failed to generate executive summary. Please try again.') });
    }
  });

  app.command('/risk-report', async ({ command, ack, respond }) => {
    await ack();
    const context = _contextFromCommand(command);
    try {
      const { risks, isDemo } = await resolveDetector(context.workspaceId);
      const messageBlocks = blocks.buildRiskReport(risks);
      await respond({ response_type: 'in_channel', blocks: _withDemoNotice(messageBlocks, isDemo) });
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
      const { detector } = await resolveDetector(context.workspaceId);
      const risk = findRiskIn(detector, riskId);
      if (!risk) {
        const allRisks = detector.getRisksSorted();
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
      const { detector } = await resolveDetector(context.workspaceId);
      const risk = findRiskIn(detector, riskId);
      if (!risk) {
        const allRisks = detector.getRisksSorted();
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

  // ==========================================
  // FILE UPLOAD — ingest a workspace's own data
  // ==========================================
  // When a user shares a .csv or .json file with PulseGuard, we download it,
  // parse + validate it, and store it as this workspace's dataset.

  // file_shared — fires when a file is shared in a channel the bot is in
  app.event('file_shared', async ({ event, client, context: botContext }) => {
    const workspaceId = botContext?.teamId || event?.team_id || process.env.SLACK_TEAM_ID || 'unknown';
    const userId = event?.user_id || 'unknown';
    const fileId = event?.file_id || event?.file?.id;
    const botToken = botContext?.botToken || client.token;
    logger.info('file_shared event received', { workspaceId, hasFileId: !!fileId });
    if (!fileId) return;
    await _processUploadedFile({ client, botToken, workspaceId, userId, fileId });
  });

  // message (DM) with files — fires reliably for direct-message uploads,
  // which file_shared does not always cover
  app.event('message', async ({ event, client, context: botContext }) => {
    // Only handle DM messages that carry files
    if (event?.channel_type !== 'im') return;
    if (!Array.isArray(event.files) || event.files.length === 0) return;

    const workspaceId = botContext?.teamId || event?.team || process.env.SLACK_TEAM_ID || 'unknown';
    const userId = event?.user || 'unknown';
    const botToken = botContext?.botToken || client.token;

    logger.info('message-with-file event received', { workspaceId, fileCount: event.files.length });

    // Process the first supported file
    for (const f of event.files) {
      const fileId = f.id;
      if (fileId) {
        await _processUploadedFile({ client, botToken, workspaceId, userId, fileId, file: f });
        break;
      }
    }
  });
}

/**
 * Downloads, parses, validates, and stores an uploaded Slack file.
 * Shared by both the file_shared and message(DM) event handlers.
 */
async function _processUploadedFile({ client, botToken, workspaceId, userId, fileId, file }) {
  try {
    // Use provided file object or fetch metadata
    let meta = file;
    if (!meta) {
      const info = await client.files.info({ file: fileId });
      meta = info.file;
    }
    if (!meta) return;

    const name = (meta.name || '').toLowerCase();
    const isSupported = name.endsWith('.csv') || name.endsWith('.json');
    if (!isSupported) {
      logger.info('Ignoring unsupported file type', { workspaceId, name });
      return; // not a data file
    }

    const dmChannel = await _openDm(client, userId);

    const content = await _downloadSlackFile(meta.url_private_download || meta.url_private, botToken);
    if (content === null) {
      await _dm(client, dmChannel, blocks.buildErrorMessage('I could not download that file. Please try uploading it again.'));
      return;
    }

    const result = parseUpload(content, name);
    if (!result.ok) {
      await _dm(client, dmChannel, blocks.buildUploadResult({ ok: false, errors: result.errors, warnings: result.warnings }));
      return;
    }

    const saved = await dataStore.saveDataset(workspaceId, result.dataset, { uploadedBy: userId, source: result.source });
    logger.info('Workspace data uploaded', { workspaceId, source: result.source, counts: saved.counts });

    await _dm(client, dmChannel, blocks.buildUploadResult({
      ok: true,
      counts: saved.counts,
      warnings: result.warnings,
      source: result.source,
    }));
  } catch (error) {
    logger.error('File upload handling failed', { workspaceId, error: error.message });
    try {
      const dmChannel = await _openDm(client, userId);
      await _dm(client, dmChannel, blocks.buildErrorMessage('Something went wrong processing your file. Please try again.'));
    } catch { /* best effort */ }
  }
}

// ---------------------------------------------------------------------------
// File download / DM helpers
// ---------------------------------------------------------------------------

/**
 * Downloads a Slack private file's content using the bot token.
 * Returns the text content, or null on failure.
 */
async function _downloadSlackFile(url, botToken) {
  if (!url) return null;
  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${botToken}` },
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

async function _openDm(client, userId) {
  const im = await client.conversations.open({ users: userId });
  return im.channel.id;
}

async function _dm(client, channel, messageBlocks) {
  await client.chat.postMessage({ channel, blocks: messageBlocks, text: 'PulseGuard' });
}

/**
 * Prepends a "sample data" notice to a message when the workspace has not
 * uploaded its own dataset, so users know they're seeing the demo dataset
 * and how to load their own. No-op when isDemo is false.
 */
function _withDemoNotice(messageBlocks, isDemo) {
  if (!isDemo) return messageBlocks;
  return [
    {
      type: 'context',
      elements: [{
        type: 'mrkdwn',
        text: '📊 *Sample data* — you\'re viewing PulseGuard\'s demonstration dataset. Upload your own with `/pulseguard-upload` to analyze your operations.',
      }],
    },
    ...messageBlocks,
  ];
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
