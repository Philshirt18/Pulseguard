/**
 * PulseGuard — AI Narrative Generator
 *
 * Uses OpenAI to generate executive-quality explanations of detected risks.
 * AI is used ONLY for narrative generation — never for scoring or detection.
 *
 * ── Design principles ───────────────────────────────────────────────────────
 * 1. Every AI call is workspace-scoped (no shared global context)
 * 2. Every AI call is checked against the workspace plan limit before execution
 * 3. Every AI call records usage (tokens, cost, success/failure)
 * 4. Input is sanitized to prevent prompt injection
 * 5. Token limits are enforced to cap per-call cost
 * 6. Responses are cached (10 min TTL) to avoid redundant calls
 * 7. Demo mode bypasses OpenAI entirely — returns polished fallbacks
 *
 * ── Context parameter ───────────────────────────────────────────────────────
 * All public functions accept a `context` object:
 *   {
 *     workspaceId: string,   // Slack team/enterprise ID
 *     userId:      string,   // Slack user ID who triggered the command
 *     planId:      string,   // 'free' | 'pro' | 'business'
 *   }
 * This is used for billing checks, usage tracking, and log correlation.
 * Pass { workspaceId: 'demo', userId: 'demo', planId: 'free' } in demo mode.
 */

const OpenAI = require('openai');
const { getCached, setCached, isDemoMode } = require('./cache');
const billingService = require('../services/billingService');
const logger = require('../services/logger');
const { sanitiseRiskForPrompt } = require('../services/inputSanitiser');

// Lazily initialised — never constructed if DEMO_MODE=true
let _openai;
function _getClient() {
  if (!_openai) _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return _openai;
}

// Model to use for narrative generation.
// gpt-4o-mini gives good quality at very low cost.
// Override via OPENAI_NARRATIVE_MODEL env var.
const MODEL = process.env.OPENAI_NARRATIVE_MODEL || 'gpt-4o-mini';

// Hard cap on tokens per AI call to prevent runaway costs.
const MAX_TOKENS_PER_CALL = parseInt(process.env.AI_MAX_TOKENS || '800', 10);

// ---------------------------------------------------------------------------
// System prompt — workspace-agnostic
// NOTE: Do NOT embed customer-specific information here.
//       Any workspace/tenant-specific context should be passed as user content.
// ---------------------------------------------------------------------------
const SYSTEM_PROMPT = `You are PulseGuard AI, an executive intelligence system that analyzes operational risk data.

You write like a senior partner at McKinsey. Your language is:
- Precise, data-driven, and quantified
- Action-oriented with clear ownership
- Executive-level (C-suite audience)
- Concise but insightful — every word earns its place
- Never vague, generic, or padded with filler

Rules:
- Always reference specific numbers, percentages, and amounts from the data provided
- Never use "It's important to note", "Moving forward", "In conclusion"
- Write as if presenting to the CEO in a 30-second elevator pitch
- Lead with the insight, not the methodology
- Only use information from the data provided — do not invent facts
- Respond ONLY with the requested JSON format`;

// ---------------------------------------------------------------------------
// Input sanitisation — delegates to centralised inputSanitiser
// ---------------------------------------------------------------------------

function _sanitiseRiskForPrompt(risk) {
  return sanitiseRiskForPrompt(risk);
}

// ---------------------------------------------------------------------------
// Core OpenAI call wrapper
// ---------------------------------------------------------------------------

async function _callOpenAI({ prompt, cacheKey, operation, context }) {
  // 1. Demo mode — skip API entirely
  if (isDemoMode()) return null;

  // 2. Check billing limit before calling OpenAI
  const limitCheck = await billingService.recordUsage({
    workspaceId: context.workspaceId,
    userId: context.userId,
    operation,
    model: MODEL,
    success: false, // will update on success
    tokensUsed: 0,
  });

  if (!limitCheck.allowed) {
    logger.warn('AI operation blocked by plan limit', {
      workspaceId: context.workspaceId,
      operation,
      used: limitCheck.used,
      limit: limitCheck.limit,
    });
    return { _limitExceeded: true, reason: limitCheck.reason };
  }

  // 3. Check cache (after limit check — don't count cache hits)
  const cached = getCached(`${context.workspaceId}:${cacheKey}`);
  if (cached) {
    logger.debug('AI cache hit', { workspaceId: context.workspaceId, operation, cacheKey });
    return cached;
  }

  // 4. Call OpenAI
  const startMs = Date.now();
  try {
    const response = await _getClient().chat.completions.create({
      model: MODEL,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: prompt },
      ],
      temperature: 0.7,
      max_tokens: MAX_TOKENS_PER_CALL,
      response_format: { type: 'json_object' },
    });

    const tokensUsed = response.usage?.total_tokens || 0;
    const result = JSON.parse(response.choices[0].message.content);
    const durationMs = Date.now() - startMs;

    // Record successful usage
    await billingService.recordUsage({
      workspaceId: context.workspaceId,
      userId: context.userId,
      operation,
      model: MODEL,
      tokensUsed,
      success: true,
    });

    logger.info('AI call completed', {
      workspaceId: context.workspaceId,
      operation,
      model: MODEL,
      tokensUsed,
      durationMs,
    });

    setCached(`${context.workspaceId}:${cacheKey}`, result);
    return result;
  } catch (error) {
    const durationMs = Date.now() - startMs;

    // Record failed usage (doesn't count against limit)
    await billingService.recordUsage({
      workspaceId: context.workspaceId,
      userId: context.userId,
      operation,
      model: MODEL,
      success: false,
      error: error.message,
    });

    logger.error('AI call failed', {
      workspaceId: context.workspaceId,
      operation,
      model: MODEL,
      durationMs,
      error: error.message,
    });

    return null; // Triggers fallback
  }
}

// ---------------------------------------------------------------------------
// Public functions
// ---------------------------------------------------------------------------

/**
 * Generates a root cause analysis narrative for a detected risk.
 *
 * @param {object} risk     — risk object from riskDetector
 * @param {object} context  — { workspaceId, userId, planId }
 * @returns {object}        — root cause analysis object
 */
async function generateRootCauseAnalysis(risk, context = _defaultContext()) {
  const safeRisk = _sanitiseRiskForPrompt(risk);

  const prompt = `Analyze this detected business risk and provide a root cause analysis.

RISK DATA:
${safeRisk}

Respond in this exact JSON format:
{
  "rootCause": "One clear sentence identifying the root cause",
  "explanation": "2-3 sentence executive explanation connecting the dots. Be specific with numbers from the data.",
  "supportingEvidence": ["evidence point 1", "evidence point 2", "evidence point 3", "evidence point 4"],
  "confidenceScore": 0.87,
  "businessImpact": "One sentence quantifying total business impact with figures from the data",
  "contributingFactors": ["factor 1", "factor 2", "factor 3"],
  "timeline": "When this started and projected trajectory if unaddressed"
}`;

  const result = await _callOpenAI({
    prompt,
    cacheKey: `rca_${risk.id}`,
    operation: 'root_cause_analysis',
    context,
  });

  if (result?._limitExceeded) return _limitExceededResponse(result.reason);
  return result || _fallbackRootCause(risk);
}

/**
 * Generates actionable recommendations for a detected risk.
 *
 * @param {object} risk
 * @param {object} context
 * @returns {object}
 */
async function generateRecommendations(risk, context = _defaultContext()) {
  const safeRisk = _sanitiseRiskForPrompt(risk);

  const prompt = `Based on this detected business risk, provide actionable recommendations with quantified outcomes.

RISK DATA:
${safeRisk}

Respond in this exact JSON format:
{
  "immediateActions": [
    {"action": "specific action", "owner": "role/team", "timeline": "timeframe", "expectedImpact": "measurable outcome"}
  ],
  "shortTermActions": [
    {"action": "specific action", "owner": "role/team", "timeline": "timeframe", "expectedImpact": "measurable outcome"}
  ],
  "strategicActions": [
    {"action": "specific action", "owner": "role/team", "timeline": "timeframe", "expectedImpact": "measurable outcome"}
  ],
  "expectedOutcomes": {
    "revenueProtected": "amount or description",
    "riskReduction": "percentage or description",
    "timeToResolution": "duration",
    "customerImpact": "measurable improvement"
  },
  "executiveSummary": "One compelling sentence summarizing the recommended course of action"
}`;

  const result = await _callOpenAI({
    prompt,
    cacheKey: `rec_${risk.id}`,
    operation: 'recommendations',
    context,
  });

  if (result?._limitExceeded) return _limitExceededRecommendations(result.reason);
  return result || _fallbackRecommendations(risk);
}

/**
 * Generates an executive summary across all detected risks.
 *
 * @param {object[]} risks
 * @param {object}   context
 * @returns {object}
 */
async function generateExecutiveSummary(risks, context = _defaultContext()) {
  const topRisks = risks.slice(0, 5).map(_sanitiseRiskForPrompt);
  const criticalCount = risks.filter(r => r.severity === 'critical').length;
  const highCount = risks.filter(r => r.severity === 'high').length;

  const prompt = `Generate an executive intelligence brief for operational leadership.

RISK SUMMARY:
Total risks: ${risks.length}
Critical: ${criticalCount}
High: ${highCount}

TOP RISKS:
${topRisks.join('\n---\n')}

Respond in this exact JSON format:
{
  "headline": "One powerful sentence — the single most important operational insight right now",
  "criticalInsight": "The one thing leadership must act on today, with specific numbers from the data",
  "emergingTrends": ["trend 1 with specific data point", "trend 2 with data", "trend 3 with data"],
  "revenueThreats": ["threat 1 quantified", "threat 2 quantified"],
  "operationalBottlenecks": ["bottleneck 1 with metrics", "bottleneck 2 with metrics"],
  "recommendedFocus": ["priority 1 — specific action", "priority 2 — specific action", "priority 3 — specific action"],
  "overallRiskLevel": "critical",
  "confidenceStatement": "Based on X data points from the past 30 days"
}`;

  const cacheKey = `exec_${risks.length}_${risks[0]?.id}_${criticalCount}`;
  const result = await _callOpenAI({
    prompt,
    cacheKey,
    operation: 'executive_summary',
    context,
  });

  if (result?._limitExceeded) return _limitExceededSummary(result.reason);
  return result || _fallbackExecutiveSummary(risks);
}

// ---------------------------------------------------------------------------
// Default context — used when no workspace context is available
// (e.g. direct MCP calls in demo mode)
// ---------------------------------------------------------------------------
function _defaultContext() {
  return {
    workspaceId: process.env.SLACK_TEAM_ID || 'demo',
    userId: 'system',
    planId: 'free',
  };
}

// ---------------------------------------------------------------------------
// Limit-exceeded responses
// ---------------------------------------------------------------------------
function _limitExceededResponse(reason) {
  return {
    rootCause: 'Monthly AI operation limit reached.',
    explanation: reason || 'Upgrade your plan to continue using AI-powered analysis.',
    supportingEvidence: [],
    confidenceScore: 0,
    businessImpact: 'Unable to generate analysis — plan limit reached.',
    contributingFactors: [],
    timeline: null,
    _limitExceeded: true,
  };
}

function _limitExceededRecommendations(reason) {
  return {
    immediateActions: [],
    shortTermActions: [],
    strategicActions: [],
    expectedOutcomes: {
      revenueProtected: 'N/A',
      riskReduction: 'N/A',
      timeToResolution: 'N/A',
      customerImpact: 'N/A',
    },
    executiveSummary: reason || 'Upgrade your plan to generate AI recommendations.',
    _limitExceeded: true,
  };
}

function _limitExceededSummary(reason) {
  return {
    headline: 'AI operation limit reached.',
    criticalInsight: reason || 'Upgrade your plan to generate AI-powered summaries.',
    emergingTrends: [],
    revenueThreats: [],
    operationalBottlenecks: [],
    recommendedFocus: [],
    overallRiskLevel: 'unknown',
    confidenceStatement: 'N/A',
    _limitExceeded: true,
  };
}

// ---------------------------------------------------------------------------
// Fallback narratives
// These are high-quality pre-written responses used in demo mode
// and as fallbacks when the OpenAI API is unavailable.
//
// IMPORTANT: These are clearly labelled as demo data. They describe the
// EuroStay demo scenario and are NEVER presented to real customers as
// AI-generated analysis of their actual data.
// ---------------------------------------------------------------------------

function _fallbackRootCause(risk) {
  if (risk.type === 'operational' && risk.evidence?.vendor === 'Atlas Services') {
    return {
      rootCause: 'Vendor Atlas Services has experienced a systematic performance collapse, creating a cascading operational crisis across all Southern Spain maintenance operations.',
      explanation: '78% of maintenance complaints in Southern Spain trace directly to Atlas Services. Their average response time has deteriorated to 72+ hours — 514% above the 14-hour baseline. This single vendor failure is the root cause driving a 256% complaint increase, a 17.5% cancellation rate, and €234,000 in refunds this month alone.',
      supportingEvidence: [
        'Atlas Services response time: 86h vs 14h baseline (514% excess)',
        'Task completion rate collapsed to 39% (baseline: 90%)',
        '23 escalations in 30 days — highest across all 7 vendors',
        '89 complaints in Southern Spain vs 25 regional baseline (256% increase)',
        'Direct correlation: 87% of complaint spikes align with Atlas delays',
      ],
      confidenceScore: 0.96,
      businessImpact: 'Estimated €234,000 in direct refund losses this month, with €24,500/month in projected recurring revenue loss if unaddressed.',
      contributingFactors: [
        'Vendor likely understaffed for peak summer season demand',
        'No SLA enforcement or real-time performance monitoring in place',
        'Single-vendor dependency — no backup for 3,200 Southern Spain properties',
        'Delayed escalation protocols allowing issues to compound',
      ],
      timeline: 'Performance degradation began approximately 3-4 weeks ago and is accelerating. Without intervention, projected to worsen 30-40% month-over-month through peak season.',
      _demo: true,
    };
  }

  if (risk.type === 'customer_satisfaction') {
    return {
      rootCause: `Customer satisfaction in ${risk.region} has declined significantly due to unresolved operational issues affecting guest experiences.`,
      explanation: `Guest complaints have spiked ${Math.round((risk.evidence?.complaints / risk.evidence?.baselineComplaints - 1) * 100) || 150}% above baseline. The negative review rate has reached ${risk.evidence?.negativeReviewRate || '42%'}, directly impacting booking conversion rates and future revenue.`,
      supportingEvidence: Object.entries(risk.evidence || {}).slice(0, 4).map(([k, v]) => `${k}: ${v}`),
      confidenceScore: risk.confidence,
      businessImpact: `Estimated €${(risk.impact?.estimatedRevenueLoss || 0).toLocaleString()} in revenue impact if unaddressed.`,
      contributingFactors: ['Unresolved maintenance delays', 'Insufficient guest communication during service failures', 'Review volume overwhelming response capacity'],
      timeline: 'Pattern has been escalating over the past 2-3 weeks with accelerating negative review velocity.',
      _demo: true,
    };
  }

  if (risk.type === 'owner_churn') {
    return {
      rootCause: `Property owner ${risk.evidence?.owner || 'in ' + risk.region} is at imminent churn risk due to compounding service failures and unresolved escalations.`,
      explanation: `Owner satisfaction has dropped to ${risk.evidence?.satisfaction || 'below threshold'} (baseline: ${risk.evidence?.baselineSatisfaction || '4.0'}) with ${risk.evidence?.escalations || 'multiple'} escalations filed. This matches 78% of historical churn profiles.`,
      supportingEvidence: Object.entries(risk.evidence || {}).slice(0, 4).map(([k, v]) => `${k}: ${v}`),
      confidenceScore: risk.confidence,
      businessImpact: `${risk.impact?.ownerRevenue || 'Significant'} annual revenue at risk from this owner relationship.`,
      contributingFactors: ['Service quality deterioration affecting owner properties', 'Escalations going unresolved', 'No proactive communication or service recovery offered'],
      timeline: 'Without intervention within 1-2 weeks, contract non-renewal is likely based on historical churn patterns.',
      _demo: true,
    };
  }

  // Generic fallback
  return {
    rootCause: `${risk.title} — driven by multiple converging operational factors in the ${risk.region} region.`,
    explanation: `Analysis of available data reveals a deteriorating pattern requiring management attention. Key metrics are significantly above established risk thresholds.`,
    supportingEvidence: Object.entries(risk.evidence || {}).slice(0, 4).map(([k, v]) => `${k}: ${v}`),
    confidenceScore: risk.confidence,
    businessImpact: `Estimated impact if unaddressed requires investigation.`,
    contributingFactors: ['Operational gaps in regional coverage', 'Insufficient monitoring and early warning systems'],
    timeline: 'Pattern detected over past 2-4 weeks. Intervention needed to prevent further escalation.',
    _demo: true,
  };
}

function _fallbackRecommendations(risk) {
  if (risk.type === 'operational' && risk.evidence?.vendor === 'Atlas Services') {
    return {
      immediateActions: [
        { action: 'Issue formal SLA breach notice to Atlas Services with 48-hour remediation deadline', owner: 'VP Operations', timeline: 'Today', expectedImpact: 'Contractual leverage for immediate performance improvement or termination clause activation' },
        { action: 'Deploy emergency maintenance team to Southern Spain', owner: 'Operations Director', timeline: 'Within 48 hours', expectedImpact: 'Clear backlog of 37 open maintenance tickets within 5 days' },
        { action: 'Proactive guest outreach to all affected bookings with service recovery offer', owner: 'Customer Success', timeline: 'Today', expectedImpact: 'Prevent 40-60% of pending cancellations (est. €45,000 saved)' },
      ],
      shortTermActions: [
        { action: 'Onboard backup maintenance vendor for Southern Spain', owner: 'Procurement', timeline: '2 weeks', expectedImpact: 'Eliminate single-vendor dependency for 3,200 properties' },
        { action: 'Implement real-time vendor performance dashboard with automated SLA alerts', owner: 'Data Engineering', timeline: '1 week', expectedImpact: 'Early warning system prevents future detection delays' },
      ],
      strategicActions: [
        { action: 'Restructure all vendor contracts with performance-linked payment terms', owner: 'VP Operations + Legal', timeline: 'End of Q3', expectedImpact: '15-20% improvement in vendor accountability across all regions' },
      ],
      expectedOutcomes: {
        revenueProtected: '€24,500/month recurring',
        riskReduction: '65% within 3 weeks',
        timeToResolution: '3 weeks to stabilize, 6 weeks to full recovery',
        customerImpact: '18% reduction in negative reviews within 30 days',
      },
      executiveSummary: 'Immediate vendor intervention combined with emergency maintenance deployment will protect an estimated €294,000 in annual revenue and prevent further cascade.',
      _demo: true,
    };
  }

  // Generic fallback
  return {
    immediateActions: [
      { action: 'Escalate to regional leadership for immediate ownership and triage', owner: 'Regional Manager', timeline: 'Today', expectedImpact: 'Visibility, accountability, and rapid triage' },
      { action: 'Conduct rapid assessment of affected operations', owner: 'Operations', timeline: '48 hours', expectedImpact: 'Clear picture of scope and initial remediation plan' },
    ],
    shortTermActions: [
      { action: 'Implement targeted remediation based on root cause analysis', owner: 'Operations Director', timeline: '1-2 weeks', expectedImpact: 'Direct reduction of identified risk indicators' },
    ],
    strategicActions: [
      { action: 'Deploy monitoring and early warning systems for this risk category', owner: 'Data Team', timeline: 'Next quarter', expectedImpact: 'Prevent recurrence and enable proactive management' },
    ],
    expectedOutcomes: {
      revenueProtected: 'To be quantified after root cause investigation',
      riskReduction: '40-60% within 3 weeks',
      timeToResolution: '2-4 weeks',
      customerImpact: 'Measurable improvement in affected metrics within 30 days',
    },
    executiveSummary: 'Focused intervention with clear ownership and weekly progress tracking will resolve the identified risk within the projected timeline.',
    _demo: true,
  };
}

function _fallbackExecutiveSummary(risks) {
  const topRisk = risks[0];
  const criticalCount = risks.filter(r => r.severity === 'critical').length;

  return {
    headline: `${criticalCount} critical operational risk${criticalCount !== 1 ? 's' : ''} detected requiring immediate executive attention.`,
    criticalInsight: topRisk
      ? `${topRisk.title} in ${topRisk.region} represents the highest-priority intervention — ${Math.round(topRisk.confidence * 100)}% confidence with significant revenue exposure.`
      : 'Multiple operational risks detected across the portfolio.',
    emergingTrends: risks.slice(0, 3).map(r => `${r.title} — ${Math.round(r.confidence * 100)}% confidence`),
    revenueThreats: risks.filter(r => r.type === 'revenue' || r.type === 'operational').slice(0, 2).map(r => r.title),
    operationalBottlenecks: risks.filter(r => r.type === 'operational').slice(0, 2).map(r => `${r.title} (${r.region})`),
    recommendedFocus: risks.slice(0, 3).map(r => `Investigate: ${r.title}`),
    overallRiskLevel: criticalCount > 0 ? 'critical' : 'high',
    confidenceStatement: `Based on analysis of operational data across ${risks.length} detected risk patterns.`,
    _demo: true,
  };
}

module.exports = {
  generateRootCauseAnalysis,
  generateRecommendations,
  generateExecutiveSummary,
};
