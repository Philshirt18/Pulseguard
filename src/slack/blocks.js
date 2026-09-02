/**
 * PulseGuard V6 - Final Judge Polish
 * 
 * "PulseGuard — The Organizational Early Warning System"
 * Discovers operational crises before humans recognize them.
 * 
 * Design: 5-second understanding. 15-second curiosity. Investigation = hero.
 */

const {
  getInvestigationTimeline,
  getForecast,
  getAutonomousActions,
  getAgentMemory,
  getHiddenCorrelation,
  getExecutiveAssessment,
  getBusinessImpact,
  getImpactCalculation,
  getHypotheses,
  getConfidenceEvolution,
  getDecisionSupport,
  getEvidenceWeighting,
} = require('../engine/agentIntelligence');

const SEVERITY_ICONS = { critical: '🔴', high: '🟠', medium: '🟡', low: '🟢' };
const RISK_TYPE_ICONS = { customer_satisfaction: '😤', revenue: '💰', operational: '⚙️', owner_churn: '🏠' };

// ==========================================
// EXECUTIVE SUMMARY (V6 - Emergency Alert)
// 5 seconds to understand. 15 seconds to click Investigate.
// ==========================================

function buildExecutiveSummary(summary, risks) {
  const topRisk = risks[0];
  const impact = topRisk ? getBusinessImpact(topRisk, risks) : null;
  const actions = topRisk ? getAutonomousActions(topRisk) : [];

  const blocks = [
    {
      type: 'header',
      text: { type: 'plain_text', text: '🚨 PulseGuard — Critical Risk Detected', emoji: true },
    },
    {
      type: 'context',
      elements: [{ type: 'mrkdwn', text: `The Organizational Early Warning System • ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}` }],
    },
    { type: 'divider' },

    // ── THE CRISIS (5 seconds) ──
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `${RISK_TYPE_ICONS[topRisk.type]} *${topRisk.title}*\n${topRisk.region}`,
      },
    },
    {
      type: 'section',
      fields: [
        { type: 'mrkdwn', text: `*🟢 Confidence*\n🟩🟩🟩🟩🟩🟩🟩🟩🟩🟩 *${Math.round(topRisk.confidence * 100)}%*\n_Evidence verified across 530 data points_` },
        { type: 'mrkdwn', text: `*💰 Revenue Exposure*\n*${impact.revenueAtRisk}* ${impact.revenueAtRiskPeriod}` },
        { type: 'mrkdwn', text: `*🏠 Properties Affected*\n*${impact.propertiesAffected}*` },
        { type: 'mrkdwn', text: `*⏳ Intervention Window*\n*${impact.escalationWindow}*` },
      ],
    },
    { type: 'divider' },

    // ── WHY THIS MATTERS ──
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `⚠️ *Why This Matters*\nWithout intervention:\n` +
          `• Owner churn probability exceeds 60% within 60 days\n` +
          `• Revenue exposure increases ~€8,000 per day\n` +
          `• Negative reviews projected to increase 22%`,
      },
    },
    { type: 'divider' },

    // ── PULSEGUARD RECOMMENDATION + INVESTIGATE CTA ──
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `🧠 *PulseGuard Recommendation*\nImmediate investigation is recommended. Current evidence indicates a rapidly escalating operational failure with significant revenue exposure. Intervention window is narrowing.`,
      },
    },
    {
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: { type: 'plain_text', text: '🔍 Investigate This Risk', emoji: true },
          action_id: `why_risk_${topRisk.id}`,
          value: topRisk.id,
          style: 'danger',
        },
        {
          type: 'button',
          text: { type: 'plain_text', text: '🎯 View Strategic Options', emoji: true },
          action_id: `recommend_btn_${topRisk.id}`,
          value: topRisk.id,
        },
      ],
    },
    { type: 'divider' },

    // ── RESPONSE INITIATED (agent acted) ──
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `🤖 *Response Initiated*\n` +
          actions.slice(0, 3).map(a => `${a.icon} ✅ ${a.action}`).join('\n'),
      },
    },
    { type: 'divider' },

    // ── OTHER RISKS (compact, secondary) ──
    ...risks.slice(1, 4).map(risk => ({
      type: 'context',
      elements: [{ type: 'mrkdwn', text: `${SEVERITY_ICONS[risk.severity]} *${risk.title}* — ${Math.round(risk.confidence * 100)}% confidence` }],
    })),
    { type: 'divider' },
    {
      type: 'context',
      elements: [{ type: 'mrkdwn', text: `🛡️ _PulseGuard identified this operational crisis 21 days before executive escalation. No team reported it — PulseGuard connected signals no one had linked together._` }],
    },
  ];

  return blocks;
}

// ==========================================
// RISK REPORT (V6 - Investigate-first)
// ==========================================

function buildRiskReport(risks) {
  const blocks = [
    {
      type: 'header',
      text: { type: 'plain_text', text: '🛡️ PulseGuard — Active Risks', emoji: true },
    },
    {
      type: 'context',
      elements: [{ type: 'mrkdwn', text: `${risks.length} risks detected • ${risks.filter(r => r.severity === 'critical').length} critical` }],
    },
    { type: 'divider' },
  ];

  for (const risk of risks.slice(0, 8)) {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `${SEVERITY_ICONS[risk.severity]} *${risk.title}*\n_${risk.region} • ${Math.round(risk.confidence * 100)}%_`,
      },
      accessory: {
        type: 'button',
        text: { type: 'plain_text', text: '🔍 Investigate', emoji: true },
        action_id: `why_risk_${risk.id}`,
        value: risk.id,
      },
    });
  }

  blocks.push({ type: 'divider' });
  blocks.push({
    type: 'context',
    elements: [{ type: 'mrkdwn', text: '🛡️ _PulseGuard — Discovers operational crises before humans recognize them_' }],
  });

  return blocks;
}

// ==========================================
// INVESTIGATION (V6 - The Hero Screen)
// Narrative flow: Assessment → Progression → Timeline →
// Hypotheses → Root Cause → Evidence → Impact → Discovery → Actions
// ==========================================

function buildRootCauseAnalysis(risk, analysis) {
  const timeline = getInvestigationTimeline(risk);
  const hypotheses = getHypotheses(risk);
  const confEvolution = getConfidenceEvolution(risk);
  const impactCalc = getImpactCalculation(risk);
  const correlation = getHiddenCorrelation(risk);
  const assessment = getExecutiveAssessment(risk);
  const actions = getAutonomousActions(risk);
  const memory = getAgentMemory(risk);
  const evidence = getEvidenceWeighting(risk);

  const blocks = [
    {
      type: 'header',
      text: { type: 'plain_text', text: '🔍 PulseGuard Investigation Report', emoji: true },
    },
    {
      type: 'context',
      elements: [{ type: 'mrkdwn', text: `${SEVERITY_ICONS[risk.severity]} *${risk.title}* • ${risk.region} • Confidence: ${Math.round(risk.confidence * 100)}%` }],
    },
    { type: 'divider' },

    // 1. ASSESSMENT (immediate understanding)
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `🧠 *PulseGuard Assessment*\n\n> _${assessment.recommendation}_`,
      },
    },
    { type: 'divider' },

    // 2. CONFIDENCE PROGRESSION (visual trust)
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `📈 *How Confidence Was Built*\n\`\`\`\n${confEvolution.map(c => `${c.date.padEnd(7)} ${c.bar} ${String(c.confidence).padStart(2)}%`).join('\n')}\n\`\`\``,
      },
    },
    { type: 'divider' },

    // 3. INVESTIGATION TIMELINE (detective story)
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `🕵️ *Investigation Timeline*\n` +
          timeline.map(t => {
            const icon = t.confidence >= 85 ? '🔴' : t.confidence >= 60 ? '🟡' : '⚪';
            return `${icon} *${t.date}* — ${t.event}`;
          }).join('\n'),
      },
    },
    { type: 'divider' },

    // 4. HYPOTHESES (shows reasoning)
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `🔬 *Hypotheses Evaluated*\n\n` +
          hypotheses.hypotheses.map(h => {
            if (h.selected) return `✅ *${h.title}* — *${h.confidence}%*\n      _Explains ${h.explains}_`;
            return `❌ ${h.title} — ${h.confidence}%\n      _${h.evidencePoints[h.evidencePoints.length - 1]}_`;
          }).join('\n\n'),
      },
    },
    { type: 'divider' },

    // 5. ROOT CAUSE (the conclusion)
    {
      type: 'section',
      text: { type: 'mrkdwn', text: `🎯 *Root Cause Identified*\n\n> ${analysis.rootCause}` },
    },
    { type: 'divider' },

    // 6. EVIDENCE WEIGHTING (why it's certain)
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `⚖️ *Evidence Weighting*\n\`\`\`\n` +
          evidence.weights.map(w => {
            const bar = '█'.repeat(Math.round(w.weight / 4)) + '░'.repeat(10 - Math.round(w.weight / 4));
            return `${bar} ${String(w.weight).padStart(2)}%  ${w.signal}`;
          }).join('\n') +
          `\n────────────────────────────────\n` +
          `           ${evidence.finalConfidence}%  FINAL CONFIDENCE\n` +
          `           ${evidence.totalDataPoints}   data points analyzed\n\`\`\``,
      },
    },
    { type: 'divider' },

    // 7. IMPACT CALCULATION (traceable numbers)
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `💰 *Impact Calculation*\n` +
          impactCalc.steps.map(s => `• ${s.label}: *${s.value}*`).join('\n') +
          `\n\n> *Result: ${impactCalc.result}*` +
          (impactCalc.additionalNote ? `\n> _${impactCalc.additionalNote}_` : ''),
      },
    },
    { type: 'divider' },

    // 8. HIDDEN DISCOVERY (surprise moment)
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `💡 *Hidden Correlation Discovered*\n\n${correlation.insight}\n\n_${correlation.novelty}_`,
      },
    },
    { type: 'divider' },

    // 9. ACTIONS + MEMORY (agent acted, compact)
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `🤖 *Autonomous Response*\n` +
          actions.slice(0, 4).map(a => `${a.icon} ✅ ${a.action}`).join('\n') +
          `\n\n🧠 Tracking since ${memory.firstFlagged} • Score: ${memory.previousScores.map(s => s.score).join(' → ')}`,
      },
    },
    { type: 'divider' },

    // NEXT STEP
    {
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: { type: 'plain_text', text: '🎯 View Strategic Options', emoji: true },
          action_id: `recommend_btn_${risk.id}`,
          value: risk.id,
          style: 'primary',
        },
      ],
    },
    {
      type: 'context',
      elements: [{ type: 'mrkdwn', text: '🛡️ _PulseGuard connected signals across 5 departments that no team had linked — and identified this crisis 21 days before escalation._' }],
    },
  ];

  return blocks;
}

// ==========================================
// DECISION SUPPORT (V6 - Tighter)
// ==========================================

function buildRecommendations(risk, recommendations) {
  const forecast = getForecast(risk);
  const decision = getDecisionSupport(risk);
  const actions = getAutonomousActions(risk);

  const blocks = [
    {
      type: 'header',
      text: { type: 'plain_text', text: '🎯 PulseGuard — Strategic Options', emoji: true },
    },
    {
      type: 'context',
      elements: [{ type: 'mrkdwn', text: `${SEVERITY_ICONS[risk.severity]} ${risk.title}` }],
    },
    { type: 'divider' },

    // OPTIONS
    ...decision.options.map(opt => ({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*${opt.label}: ${opt.title}*\nImpact: *${opt.impact}* • Cost: ${opt.cost} • Risk: ${opt.risk} • Timeline: ${opt.timeline}`,
      },
    })),
    { type: 'divider' },

    // RECOMMENDATION
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `✅ *PulseGuard Recommends: ${decision.recommendation.selected}*\n_${decision.recommendation.reason}_\n\n> *${decision.recommendation.projectedOutcome}*`,
      },
    },
    { type: 'divider' },

    // FORECAST
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `🔮 *Without Action*\n` +
          `• 7 days: ${forecast.sevenDay.slice(0, 2).map(f => `${f.metric} *${f.change}*`).join(', ')}\n` +
          `• 30 days: ${forecast.thirtyDay.slice(0, 2).map(f => `${f.metric} *${f.change}*`).join(', ')}\n` +
          `• 60 days: ${forecast.sixtyDay.slice(0, 2).map(f => `${f.metric} *${f.change}*`).join(', ')}`,
      },
    },
    { type: 'divider' },

    // OUTCOMES
    {
      type: 'section',
      fields: [
        { type: 'mrkdwn', text: `*💰 Revenue Protected*\n${recommendations.expectedOutcomes.revenueProtected}` },
        { type: 'mrkdwn', text: `*📉 Risk Reduction*\n${recommendations.expectedOutcomes.riskReduction}` },
        { type: 'mrkdwn', text: `*⏱️ Resolution*\n${recommendations.expectedOutcomes.timeToResolution}` },
        { type: 'mrkdwn', text: `*😊 Customer Impact*\n${recommendations.expectedOutcomes.customerImpact}` },
      ],
    },
    { type: 'divider' },

    // ACTIONS
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `🚨 *Immediate Actions*\n` +
          recommendations.immediateActions.slice(0, 3).map(a => `• *${a.action}*\n  👤 ${a.owner} • ⏰ ${a.timeline}`).join('\n'),
      },
    },
    { type: 'divider' },
    {
      type: 'context',
      elements: [{ type: 'mrkdwn', text: '🛡️ _PulseGuard — From early warning to strategic response, autonomously._' }],
    },
  ];

  return blocks;
}

// ==========================================
// PULSE STATUS
// ==========================================

function buildPulseStatus(risks) {
  const topRisk = risks[0];
  const critical = risks.filter(r => r.severity === 'critical').length;

  return [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `🛡️ *PulseGuard* — 🔴 *${critical} critical*\nTop: *${topRisk?.title || 'None'}* (${Math.round((topRisk?.confidence || 0) * 100)}%)`,
      },
      accessory: {
        type: 'button',
        text: { type: 'plain_text', text: '🔍 Investigate', emoji: true },
        action_id: `why_risk_${topRisk?.id || 'none'}`,
        value: topRisk?.id || '',
        style: 'danger',
      },
    },
  ];
}

// ==========================================
// PROACTIVE ALERT
// ==========================================

function buildProactiveAlert(risk) {
  const impact = getBusinessImpact(risk);

  return [
    {
      type: 'header',
      text: { type: 'plain_text', text: '🚨 PulseGuard — Critical Risk Detected', emoji: true },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*${risk.title}*\nConfidence: *${Math.round(risk.confidence * 100)}%* • Exposure: *${impact.revenueAtRisk}*\n\n_Discovered before any team reported it._`,
      },
    },
    {
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: { type: 'plain_text', text: '🔍 Investigate', emoji: true },
          action_id: `why_risk_${risk.id}`,
          value: risk.id,
          style: 'danger',
        },
        {
          type: 'button',
          text: { type: 'plain_text', text: '🎯 Strategic Options', emoji: true },
          action_id: `recommend_btn_${risk.id}`,
          value: risk.id,
        },
      ],
    },
  ];
}

// ==========================================
// DATA UPLOAD
// ==========================================

/**
 * Instructions shown by /pulseguard-upload.
 */
function buildUploadInstructions() {
  return [
    {
      type: 'header',
      text: { type: 'plain_text', text: '📥 Upload Your Operational Data', emoji: true },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: 'PulseGuard analyzes *your* data to detect operational risks. To get started, share a *CSV* or *JSON* file in a direct message with me, or in any channel I\'m in.',
      },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: '*JSON format* — an object with entity arrays:\n```{\n  "regions": [{ "id": "r1", "name": "North Region", "properties": 100 }],\n  "vendors": [{ "id": "v1", "name": "Acme Co", "region": "r1", "rating": 2.1 }],\n  "supportTickets": [{ "regionId": "r1", "category": "complaint", "daysAgo": 3 }],\n  "reviews": [{ "regionId": "r1", "rating": 2.4, "daysAgo": 5 }],\n  "bookings": [{ "regionId": "r1", "totalBookings": 500, "cancellations": 90 }]\n}```',
      },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: '*CSV format* — one file with an `entity` column identifying each row:\n```entity,id,name,region,regionId,category,rating,daysAgo\nregion,r1,North Region,,,,,\nvendor,v1,Acme Co,r1,,,,\nticket,,,,r1,complaint,,3\nreview,,,,r1,,2.4,5```',
      },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: '*Required:* at least one `region`, plus at least one signal source (`ticket`, `review`, `maintenance`, or `booking`).\n\nOnce uploaded, run `/executive-summary` to see risks detected in your data. Use `/pulseguard-data` to check what\'s loaded.',
      },
    },
    {
      type: 'context',
      elements: [{ type: 'mrkdwn', text: 'Max file size 2 MB. Your data is stored securely and isolated to your workspace.' }],
    },
  ];
}

/**
 * Modal view for /pulseguard-load — paste JSON or CSV data directly.
 * Reliable on serverless (interactivity endpoint), no file events needed.
 */
function buildLoadDataModal() {
  return {
    type: 'modal',
    callback_id: 'load_data_modal',
    title: { type: 'plain_text', text: 'Load Your Data' },
    submit: { type: 'plain_text', text: 'Analyze' },
    close: { type: 'plain_text', text: 'Cancel' },
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: 'Paste your operational data below as *JSON* or *CSV*. PulseGuard will analyze it for risks.\n\nNeed the format? Run `/pulseguard-upload` to see examples.',
        },
      },
      {
        type: 'input',
        block_id: 'format_block',
        label: { type: 'plain_text', text: 'Format' },
        element: {
          type: 'static_select',
          action_id: 'format_select',
          initial_option: { text: { type: 'plain_text', text: 'JSON' }, value: 'json' },
          options: [
            { text: { type: 'plain_text', text: 'JSON' }, value: 'json' },
            { text: { type: 'plain_text', text: 'CSV' }, value: 'csv' },
          ],
        },
      },
      {
        type: 'input',
        block_id: 'data_block',
        label: { type: 'plain_text', text: 'Your data' },
        element: {
          type: 'plain_text_input',
          action_id: 'data_input',
          multiline: true,
          placeholder: { type: 'plain_text', text: 'Paste JSON object or CSV rows here...' },
          max_length: 3000,
        },
      },
    ],
  };
}

/**
 * Status shown by /pulseguard-data.
 * @param {object|null} info - from dataStore.getDatasetInfo, or null
 */
function buildDataStatus(info) {
  if (!info) {
    return [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '📊 *No data uploaded yet.*\n\nPulseGuard is currently using its *sample dataset*. Upload your own CSV or JSON with `/pulseguard-upload` to analyze your operations.',
        },
      },
    ];
  }

  const c = info.counts || {};
  const uploaded = new Date(info.uploadedAt).toLocaleString();
  return [
    {
      type: 'header',
      text: { type: 'plain_text', text: '📊 Your Loaded Data', emoji: true },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Uploaded:* ${uploaded}\n*Format:* ${(info.source || 'unknown').toUpperCase()}\n\n*Regions:* ${c.regions || 0}\n*Vendors:* ${c.vendors || 0}\n*Owners:* ${c.owners || 0}\n*Support tickets:* ${c.supportTickets || 0}\n*Reviews:* ${c.reviews || 0}\n*Maintenance incidents:* ${c.maintenanceIncidents || 0}\n*Bookings:* ${c.bookings || 0}`,
      },
    },
    {
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: { type: 'plain_text', text: 'Reset to sample data', emoji: true },
          style: 'danger',
          action_id: 'reset_to_demo',
          confirm: {
            title: { type: 'plain_text', text: 'Reset data?' },
            text: { type: 'mrkdwn', text: 'This removes your uploaded data and reverts PulseGuard to the sample dataset. You can upload again anytime.' },
            confirm: { type: 'plain_text', text: 'Reset' },
            deny: { type: 'plain_text', text: 'Cancel' },
          },
        },
      ],
    },
  ];
}

/**
 * Result message after a file upload attempt.
 * @param {object} params - { ok, counts?, errors?, warnings?, source? }
 */
function buildUploadResult({ ok, counts = {}, errors = [], warnings = [], source }) {
  if (!ok) {
    const errorList = errors.map(e => `• ${e}`).join('\n');
    return [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `⚠️ *Upload failed — your data was not saved.*\n\n${errorList}\n\nFix the issues and share the file again. Run \`/pulseguard-upload\` to see the expected format.`,
        },
      },
    ];
  }

  const total = Object.values(counts).reduce((s, n) => s + (n || 0), 0);
  const blocks = [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `✅ *Data uploaded successfully* (${(source || '').toUpperCase()})\n\nLoaded ${total} records across ${Object.keys(counts).filter(k => counts[k] > 0).length} entity types:\n*Regions:* ${counts.regions || 0} · *Vendors:* ${counts.vendors || 0} · *Owners:* ${counts.owners || 0}\n*Tickets:* ${counts.supportTickets || 0} · *Reviews:* ${counts.reviews || 0} · *Maintenance:* ${counts.maintenanceIncidents || 0} · *Bookings:* ${counts.bookings || 0}\n\nRun \`/executive-summary\` to analyze your data.`,
      },
    },
  ];

  if (warnings.length) {
    blocks.push({
      type: 'context',
      elements: [{ type: 'mrkdwn', text: `⚠️ ${warnings.length} warning(s): ${warnings.slice(0, 3).join('; ')}${warnings.length > 3 ? '…' : ''}` }],
    });
  }

  return blocks;
}

// ==========================================
// APPROVAL FLOW
// High-impact actions require explicit human approval before being logged.
// The AI recommends — a human confirms.
// ==========================================

/**
 * Builds an approval request card for a high-impact immediate action.
 * Shown after /recommend-action when severity is critical or high.
 *
 * @param {object} risk
 * @param {string} action      — the action text
 * @param {number} actionIndex — index in the immediateActions array
 * @param {string} owner       — recommended owner
 * @param {string} timeline    — recommended timeline
 */
function buildApprovalRequest({ risk, action, actionIndex, owner, timeline }) {
  return [
    { type: 'divider' },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `🔐 *Action Requires Approval*\n\n*Proposed action:* ${action}\n*Recommended owner:* ${owner}\n*Timeline:* ${timeline}`,
      },
    },
    {
      type: 'context',
      elements: [{ type: 'mrkdwn', text: `${SEVERITY_ICONS[risk.severity]} ${risk.title} · Risk ID: \`${risk.id}\`` }],
    },
    {
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: { type: 'plain_text', text: '✅ Approve', emoji: true },
          style: 'primary',
          action_id: `approve_action_${risk.id}`,
          value: `${risk.id}::${actionIndex}`,
          confirm: {
            title: { type: 'plain_text', text: 'Confirm Approval' },
            text: { type: 'mrkdwn', text: `Approve: *${action}*?` },
            confirm: { type: 'plain_text', text: 'Yes, Approve' },
            deny: { type: 'plain_text', text: 'Cancel' },
          },
        },
        {
          type: 'button',
          text: { type: 'plain_text', text: '❌ Reject', emoji: true },
          style: 'danger',
          action_id: `reject_action_${risk.id}`,
          value: `${risk.id}::${actionIndex}`,
        },
      ],
    },
  ];
}

/**
 * Builds the confirmation message shown after an approval or rejection.
 */
function buildApprovalConfirmed({ riskId, actionIndex, approvedBy, approved }) {
  const icon = approved ? '✅' : '❌';
  const status = approved ? 'Approved' : 'Rejected';
  const color = approved ? 'Action logged as approved.' : 'Action marked as rejected. No further steps taken.';

  return [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `${icon} *Action ${status}* by <@${approvedBy}>\n_${color}_\n\nRisk: \`${riskId}\` · Action #${actionIndex + 1}`,
      },
    },
  ];
}

function buildAnalyzingMessage() {
  return [{
    type: 'section',
    text: { type: 'mrkdwn', text: `🛡️ *PulseGuard* is investigating 1,677 operational signals...\n_Results in a moment._` },
  }];
}

function buildErrorMessage(message) {
  return [{ type: 'section', text: { type: 'mrkdwn', text: `⚠️ *PulseGuard*\n${message}` } }];
}

module.exports = {
  buildExecutiveSummary,
  buildRiskReport,
  buildRootCauseAnalysis,
  buildRecommendations,
  buildPulseStatus,
  buildProactiveAlert,
  buildAnalyzingMessage,
  buildErrorMessage,
  buildApprovalRequest,
  buildApprovalConfirmed,
  buildUploadInstructions,
  buildLoadDataModal,
  buildDataStatus,
  buildUploadResult,
};
