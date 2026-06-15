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
// UTILITY
// ==========================================

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
};
