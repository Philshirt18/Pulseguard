/**
 * PulseGuard AI - AI Narrative Generator
 * 
 * Uses OpenAI to generate executive-quality explanations.
 * AI is used ONLY for narratives, not for detection or scoring.
 * 
 * Features:
 * - Response caching (instant repeated demos)
 * - Demo mode (zero API dependency, uses polished fallbacks)
 * - Graceful fallbacks when API is unavailable
 */

const OpenAI = require('openai');
const { getCached, setCached, isDemoMode } = require('./cache');

let openai;

function getClient() {
  if (!openai) {
    openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return openai;
}

const SYSTEM_PROMPT = `You are PulseGuard AI, an executive intelligence system for EuroStay Rentals, a European vacation rental company with 15,000 properties across 7 regions and 750 employees.

You write like a senior partner at McKinsey. Your language is:
- Precise, data-driven, and quantified
- Action-oriented with clear ownership
- Executive-level (C-suite audience)
- Concise but insightful — every word earns its place
- Never vague, generic, or padded with filler

Rules:
- Always reference specific numbers, percentages, and euro amounts
- Never use "It's important to note", "Moving forward", "In conclusion"
- Write as if presenting to the CEO in a 30-second elevator pitch
- Lead with the insight, not the methodology`;

async function generateRootCauseAnalysis(risk) {
  // Demo mode: instant polished fallbacks
  if (isDemoMode()) return getFallbackRootCause(risk);

  // Check cache
  const cacheKey = `rca_${risk.id}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const client = getClient();
  
  const prompt = `Analyze this detected business risk and provide a root cause analysis.

RISK DATA:
${JSON.stringify(risk, null, 2)}

Provide a root cause analysis in this exact JSON format:
{
  "rootCause": "One clear sentence identifying the root cause",
  "explanation": "2-3 sentence executive explanation connecting the dots. Be specific with numbers.",
  "supportingEvidence": ["evidence point 1", "evidence point 2", "evidence point 3", "evidence point 4"],
  "confidenceScore": 0.87,
  "businessImpact": "One sentence quantifying total business impact in euros",
  "contributingFactors": ["factor 1", "factor 2", "factor 3"],
  "timeline": "When this started and projected trajectory if unaddressed"
}

Be specific. Reference actual numbers from the data. Sound like a McKinsey senior partner briefing a CEO.`;

  try {
    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: prompt },
      ],
      temperature: 0.7,
      max_tokens: 800,
      response_format: { type: 'json_object' },
    });

    const result = JSON.parse(response.choices[0].message.content);
    setCached(cacheKey, result);
    return result;
  } catch (error) {
    console.error('AI Root Cause Error:', error.message);
    return getFallbackRootCause(risk);
  }
}

async function generateRecommendations(risk) {
  if (isDemoMode()) return getFallbackRecommendations(risk);

  const cacheKey = `rec_${risk.id}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const client = getClient();

  const prompt = `Based on this detected business risk, provide actionable recommendations with quantified outcomes.

RISK DATA:
${JSON.stringify(risk, null, 2)}

Provide recommendations in this exact JSON format:
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
    "revenueProtected": "€XX,XXX",
    "riskReduction": "XX%",
    "timeToResolution": "X weeks",
    "customerImpact": "measurable improvement"
  },
  "executiveSummary": "One compelling sentence summarizing the recommended course of action"
}

Every recommendation must have a measurable expected outcome. Be specific and actionable.`;

  try {
    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: prompt },
      ],
      temperature: 0.7,
      max_tokens: 1000,
      response_format: { type: 'json_object' },
    });

    const result = JSON.parse(response.choices[0].message.content);
    setCached(cacheKey, result);
    return result;
  } catch (error) {
    console.error('AI Recommendations Error:', error.message);
    return getFallbackRecommendations(risk);
  }
}

async function generateExecutiveSummary(risks) {
  if (isDemoMode()) return getFallbackExecutiveSummary(risks);

  const cacheKey = `exec_summary_${risks.length}_${risks[0]?.id}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const client = getClient();

  const criticalRisks = risks.filter(r => r.severity === 'critical');
  const highRisks = risks.filter(r => r.severity === 'high');

  const prompt = `Generate an executive intelligence brief for EuroStay Rentals leadership.

DETECTED RISKS (${risks.length} total):
Critical: ${criticalRisks.length}
High: ${highRisks.length}

TOP RISKS:
${JSON.stringify(risks.slice(0, 5), null, 2)}

Generate a brief in this exact JSON format:
{
  "headline": "One powerful sentence — the single most important operational insight right now",
  "criticalInsight": "The one thing the CEO must act on today, with specific numbers",
  "emergingTrends": ["trend 1 with specific data point", "trend 2 with data", "trend 3 with data"],
  "revenueThreats": ["threat 1 quantified in euros", "threat 2 quantified in euros"],
  "operationalBottlenecks": ["bottleneck 1 with metrics", "bottleneck 2 with metrics"],
  "recommendedFocus": ["priority 1 — specific action", "priority 2 — specific action", "priority 3 — specific action"],
  "overallRiskLevel": "critical",
  "confidenceStatement": "Based on X data points from the past 30 days"
}

Write as if you have 30 seconds of the CEO's attention. Lead with what matters most.`;

  try {
    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: prompt },
      ],
      temperature: 0.7,
      max_tokens: 1000,
      response_format: { type: 'json_object' },
    });

    const result = JSON.parse(response.choices[0].message.content);
    setCached(cacheKey, result);
    return result;
  } catch (error) {
    console.error('AI Executive Summary Error:', error.message);
    return getFallbackExecutiveSummary(risks);
  }
}

// ==========================================
// POLISHED FALLBACK NARRATIVES
// These are carefully written for demo quality
// ==========================================

function getFallbackRootCause(risk) {
  // Hero story: Atlas Services
  if (risk.type === 'operational' && risk.evidence?.vendor === 'Atlas Services') {
    return {
      rootCause: "Vendor Atlas Services has experienced a systematic performance collapse, creating a cascading operational crisis across all Southern Spain maintenance operations.",
      explanation: "78% of maintenance complaints in Southern Spain trace directly to Atlas Services. Their average response time has deteriorated to 72+ hours — 514% above the 14-hour baseline. This single vendor failure is the root cause driving a 256% complaint increase, a 17.5% cancellation rate, and €234,000 in refunds this month alone.",
      supportingEvidence: [
        "Atlas Services response time: 86h vs 14h baseline (514% excess)",
        "Task completion rate collapsed to 39% (baseline: 90%)",
        "23 escalations in 30 days — highest across all 7 vendors",
        "89 complaints in Southern Spain vs 25 regional baseline (256% increase)",
        "Direct correlation: 87% of complaint spikes align with Atlas delays"
      ],
      confidenceScore: 0.96,
      businessImpact: "Estimated €234,000 in direct refund losses this month, with €24,500/month in projected recurring revenue loss if unaddressed. Total annual exposure: €528,000.",
      contributingFactors: [
        "Vendor likely understaffed for peak summer season demand",
        "No SLA enforcement or real-time performance monitoring in place",
        "Single-vendor dependency — no backup for 3,200 Southern Spain properties",
        "Delayed escalation protocols allowing issues to compound"
      ],
      timeline: "Performance degradation began approximately 3-4 weeks ago and is accelerating. Without intervention, projected to worsen 30-40% month-over-month through peak season."
    };
  }

  // Customer satisfaction - Southern Spain
  if (risk.type === 'customer_satisfaction' && risk.region === 'Southern Spain') {
    return {
      rootCause: "Maintenance vendor failure is cascading into a full-scale customer satisfaction crisis across Southern Spain's 3,200 properties.",
      explanation: "Guest complaints have spiked 256% above baseline, driven primarily by unresolved maintenance issues. Average review scores dropped from 4.2 to 2.8 in the past 30 days. The negative review rate has reached 42%, directly linked to Atlas Services' 72-hour response delays leaving guests in unacceptable property conditions.",
      supportingEvidence: [
        "89 complaints vs 25 baseline (256% increase in 30 days)",
        "Average review rating: 2.8 (down from 4.2 baseline)",
        "Negative review rate: 42% of all reviews",
        "34 refund requests in the region (highest across all regions)",
        "67% of complaints reference 'maintenance' or 'repair' issues"
      ],
      confidenceScore: 0.95,
      businessImpact: "Current trajectory projects €180,000 in lost bookings next month from reputation damage alone. Each 0.1 drop in average rating correlates with 3% booking decline.",
      contributingFactors: [
        "Atlas Services maintenance failures leaving properties in poor condition",
        "No proactive guest communication during maintenance delays",
        "Review response team overwhelmed by volume",
        "Seasonal demand amplifying impact of each negative experience"
      ],
      timeline: "Deterioration accelerated 2-3 weeks ago. Review scores on a continued downward trajectory. Reputation damage compounds over time — each week of inaction increases recovery time by approximately 2 weeks."
    };
  }

  // Owner churn - Miguel Fernandez
  if (risk.type === 'owner_churn' && risk.evidence?.owner === 'Miguel Fernandez') {
    return {
      rootCause: "High-value property owner Miguel Fernandez is at imminent churn risk due to compounding service failures in the Southern Spain region.",
      explanation: "Fernandez manages 12 properties generating €890,000 annual revenue. His satisfaction score has dropped to 2.3 (baseline: 4.0) with 8 escalations filed — the highest of any owner. His properties are directly impacted by the Atlas Services maintenance failures, creating a direct line from vendor failure to potential loss of a top-10 revenue owner.",
      supportingEvidence: [
        "Owner satisfaction: 2.3 vs 4.0 baseline (42% below acceptable)",
        "8 escalations in recent period (highest across all owners)",
        "6-year tenure — long-term relationship at risk",
        "€890,000 annual revenue at stake (top-10 owner)",
        "12 properties affected by regional maintenance failures"
      ],
      confidenceScore: 0.90,
      businessImpact: "€712,000 annual revenue at risk (80% of portfolio value). Owner departure would also signal broader confidence issues to other Southern Spain property owners.",
      contributingFactors: [
        "Properties directly in Atlas Services coverage zone",
        "Multiple guest complaints reflected on his property ratings",
        "Escalations going unresolved due to vendor bottleneck",
        "No proactive owner communication or service recovery offered"
      ],
      timeline: "Escalation pattern began 4 weeks ago and is intensifying. Without intervention within 1-2 weeks, contract non-renewal is likely. Industry data shows owners who reach 3+ unresolved escalations have 78% churn probability."
    };
  }

  // Revenue risk - Southern Spain
  if (risk.type === 'revenue' && risk.region === 'Southern Spain') {
    return {
      rootCause: "Southern Spain cancellation rate has reached 17.5% — nearly triple the 6.5% baseline — driven by negative reviews and maintenance reputation damage.",
      explanation: "€234,000 in refunds processed this month from 156 cancellations across 890 bookings. The cancellation increase directly correlates (r=0.72) with the complaint spike and review score decline. Guests are cancelling after reading recent negative reviews mentioning maintenance issues.",
      supportingEvidence: [
        "Cancellation rate: 17.5% vs 6.5% baseline (169% excess)",
        "156 cancellations out of 890 bookings this month",
        "€234,000 in refunds — highest single-region total",
        "Trend: increasing (projected to worsen without intervention)",
        "72% correlation with complaint spike timing"
      ],
      confidenceScore: 0.82,
      businessImpact: "€234,000 current month losses. At current trajectory, projected €304,000 next month. Cumulative quarterly exposure: €780,000+.",
      contributingFactors: [
        "Negative reviews visible to prospective guests before booking",
        "Word-of-mouth damage in travel communities",
        "No cancellation prevention or retention program active",
        "Competing properties in region gaining from EuroStay's reputation loss"
      ],
      timeline: "Cancellation spike began 3 weeks ago, accelerating weekly. Reputation damage has a 6-8 week lag in recovery even after operational fix."
    };
  }

  // Generic fallback
  return {
    rootCause: `${risk.title} — driven by multiple converging operational factors in the ${risk.region} region.`,
    explanation: `Analysis of ${Object.keys(risk.evidence || {}).length} data points reveals a deteriorating pattern requiring immediate attention. Key metrics are ${Math.round(risk.severityScore)}% above risk thresholds.`,
    supportingEvidence: Object.entries(risk.evidence || {}).slice(0, 4).map(([k, v]) => `${formatEvidenceKey(k)}: ${v}`),
    confidenceScore: risk.confidence,
    businessImpact: `Estimated impact of €${Math.round(risk.severityScore * 300).toLocaleString()} per month if unaddressed.`,
    contributingFactors: ["Operational gaps in regional coverage", "Insufficient monitoring and early warning systems", "Resource constraints during peak demand period"],
    timeline: "Pattern detected over past 2-4 weeks with accelerating trajectory. Intervention needed within 1-2 weeks to prevent further escalation."
  };
}

function getFallbackRecommendations(risk) {
  // Hero story: Atlas Services
  if (risk.type === 'operational' && risk.evidence?.vendor === 'Atlas Services') {
    return {
      immediateActions: [
        { action: "Issue formal SLA breach notice to Atlas Services with 48-hour remediation deadline", owner: "VP Operations", timeline: "Today", expectedImpact: "Contractual leverage for immediate performance improvement or termination clause activation" },
        { action: "Deploy emergency maintenance team (8 technicians) to Southern Spain", owner: "Operations Director", timeline: "Within 48 hours", expectedImpact: "Clear backlog of 37 open maintenance tickets within 5 days" },
        { action: "Proactive guest outreach to all affected bookings with service recovery offer", owner: "Customer Success", timeline: "Today", expectedImpact: "Prevent 40-60% of pending cancellations (est. €45,000 saved)" },
      ],
      shortTermActions: [
        { action: "Onboard backup maintenance vendor for Southern Spain (shortlist: MedFix Pro, CostaRepair)", owner: "Procurement", timeline: "2 weeks", expectedImpact: "Eliminate single-vendor dependency for 3,200 properties" },
        { action: "Implement real-time vendor performance dashboard with automated SLA alerts", owner: "Data Engineering", timeline: "1 week", expectedImpact: "Early warning system prevents future 3-week detection delays" },
        { action: "Launch owner retention program for affected Southern Spain owners", owner: "Owner Relations", timeline: "1 week", expectedImpact: "Retain €890,000 revenue from Miguel Fernandez + other at-risk owners" },
      ],
      strategicActions: [
        { action: "Restructure all vendor contracts with performance-linked payment terms (70/30 split)", owner: "VP Operations + Legal", timeline: "End of Q3", expectedImpact: "15-20% improvement in vendor accountability across all regions" },
        { action: "Establish multi-vendor strategy: minimum 2 qualified vendors per critical region", owner: "Procurement Director", timeline: "End of Q3", expectedImpact: "Zero single-point-of-failure risk across property portfolio" },
      ],
      expectedOutcomes: {
        revenueProtected: "€24,500/month recurring",
        riskReduction: "65% within 3 weeks",
        timeToResolution: "3 weeks to stabilize, 6 weeks to full recovery",
        customerImpact: "18% reduction in negative reviews within 30 days"
      },
      executiveSummary: "Immediate vendor intervention combined with emergency maintenance deployment and redundancy planning will protect an estimated €294,000 in annual revenue and prevent further cascade into owner churn."
    };
  }

  // Customer satisfaction
  if (risk.type === 'customer_satisfaction') {
    return {
      immediateActions: [
        { action: "Deploy dedicated support team for Southern Spain guest escalations", owner: "Customer Success Director", timeline: "Today", expectedImpact: "Reduce complaint resolution time from 72h to 8h" },
        { action: "Issue €50 service credit to all guests with open complaints", owner: "Customer Success", timeline: "Today", expectedImpact: "Convert 30% of negative reviews to neutral/positive" },
      ],
      shortTermActions: [
        { action: "Launch review response campaign — respond to all negative reviews within 4 hours", owner: "Marketing + CS", timeline: "This week", expectedImpact: "Mitigate reputation damage for prospective guests" },
        { action: "Implement pre-arrival property inspection for all Southern Spain check-ins", owner: "Operations", timeline: "1 week", expectedImpact: "Prevent maintenance issues from reaching guests" },
      ],
      strategicActions: [
        { action: "Build predictive maintenance system using IoT sensors in high-risk properties", owner: "Technology + Operations", timeline: "Q4", expectedImpact: "Reduce reactive maintenance incidents by 60%" },
      ],
      expectedOutcomes: {
        revenueProtected: "€180,000/month from prevented cancellations",
        riskReduction: "50% within 2 weeks",
        timeToResolution: "2 weeks to stabilize complaints, 6-8 weeks for rating recovery",
        customerImpact: "Target: return to 4.0+ average rating within 60 days"
      },
      executiveSummary: "Immediate guest recovery combined with proactive property inspections will halt the satisfaction decline and protect €180,000 in monthly revenue."
    };
  }

  // Owner churn
  if (risk.type === 'owner_churn') {
    return {
      immediateActions: [
        { action: "Schedule personal call with owner from Regional VP within 24 hours", owner: "VP Owner Relations", timeline: "Today", expectedImpact: "Signal executive attention and commitment to resolution" },
        { action: "Assign dedicated account manager for affected properties", owner: "Owner Relations", timeline: "Today", expectedImpact: "Single point of contact for all escalations" },
      ],
      shortTermActions: [
        { action: "Present service recovery package: fee reduction + priority maintenance guarantee", owner: "Owner Relations + Finance", timeline: "This week", expectedImpact: "Financial incentive to maintain partnership through resolution period" },
        { action: "Provide weekly property performance report directly to owner", owner: "Data Team", timeline: "This week", expectedImpact: "Transparency builds trust during recovery" },
      ],
      strategicActions: [
        { action: "Implement owner satisfaction early warning system with automated outreach triggers", owner: "Product + Owner Relations", timeline: "Q3", expectedImpact: "Detect churn risk 4-6 weeks earlier across all owners" },
      ],
      expectedOutcomes: {
        revenueProtected: "€712,000 annual revenue (owner portfolio)",
        riskReduction: "70% churn probability reduction with immediate intervention",
        timeToResolution: "4 weeks to stabilize relationship",
        customerImpact: "Retain 12 properties and prevent signal effect to other owners"
      },
      executiveSummary: "Executive-level personal intervention combined with financial incentives and transparency will retain this €890,000 revenue owner and prevent broader confidence erosion."
    };
  }

  // Revenue risk
  if (risk.type === 'revenue') {
    return {
      immediateActions: [
        { action: "Activate cancellation prevention flow: offer date flexibility + upgrade for at-risk bookings", owner: "Revenue Management", timeline: "Today", expectedImpact: "Save 25-35% of pending cancellations (est. €58,000)" },
        { action: "Suppress negative review visibility with verified positive review campaign", owner: "Marketing", timeline: "This week", expectedImpact: "Improve booking conversion for new visitors by 12%" },
      ],
      shortTermActions: [
        { action: "Launch regional promotion with 15% discount + maintenance guarantee", owner: "Revenue + Marketing", timeline: "1 week", expectedImpact: "Replace lost bookings and rebuild demand pipeline" },
        { action: "Implement dynamic pricing adjustment for affected properties", owner: "Revenue Management", timeline: "1 week", expectedImpact: "Optimize occupancy during recovery period" },
      ],
      strategicActions: [
        { action: "Build cancellation prediction model to enable pre-emptive retention", owner: "Data Science", timeline: "Q3", expectedImpact: "Reduce cancellation rate by 30% across all regions" },
      ],
      expectedOutcomes: {
        revenueProtected: "€234,000 this month, €780,000 quarterly",
        riskReduction: "45% within 2 weeks",
        timeToResolution: "3 weeks to stabilize, 8 weeks for full revenue recovery",
        customerImpact: "Cancellation rate target: return to <8% within 45 days"
      },
      executiveSummary: "Immediate cancellation prevention combined with regional demand rebuilding will recover an estimated €234,000 this month and €780,000 over the quarter."
    };
  }

  // Generic
  return {
    immediateActions: [
      { action: "Escalate to regional leadership for immediate review and ownership", owner: "Regional Manager", timeline: "Today", expectedImpact: "Visibility, accountability, and rapid triage" },
    ],
    shortTermActions: [
      { action: "Conduct root cause investigation with cross-functional team", owner: "Operations", timeline: "1 week", expectedImpact: "Clear remediation plan with measurable milestones" },
    ],
    strategicActions: [
      { action: "Implement monitoring and early warning systems for this risk category", owner: "Data Team", timeline: "Q3", expectedImpact: "Prevent recurrence and enable proactive management" },
    ],
    expectedOutcomes: {
      revenueProtected: `€${Math.round(risk.severityScore * 300).toLocaleString()}`,
      riskReduction: "40-60% within 3 weeks",
      timeToResolution: "2-4 weeks",
      customerImpact: "Measurable improvement in affected metrics within 30 days"
    },
    executiveSummary: "Focused intervention with clear ownership and weekly progress tracking will resolve identified risk within the projected timeline."
  };
}

function getFallbackExecutiveSummary(risks) {
  return {
    headline: "Critical vendor failure in Southern Spain is cascading into a multi-dimensional operational crisis requiring immediate executive intervention.",
    criticalInsight: "A single maintenance vendor — Atlas Services — is the root cause behind €234,000 in refunds, a 256% complaint spike, and imminent churn of a €890,000 property owner. Every day of inaction adds approximately €8,000 in losses.",
    emergingTrends: [
      "Southern Spain complaints up 256% vs baseline — 89 complaints in 30 days vs 25 average",
      "Barcelona Metro showing early-stage deterioration: complaints +52%, reviews declining to 3.4",
      "Owner churn risk concentrated in vendor-affected regions — 3 owners below satisfaction threshold",
      "Cancellation rates climbing in 3 of 7 regions, with Southern Spain at 17.5% (baseline: 6.5%)"
    ],
    revenueThreats: [
      "€234,000 in Southern Spain refunds this month — trending to €304,000 next month",
      "€178,000 in Coastal Portugal refunds with increasing cancellation trajectory",
      "€890,000 annual revenue at risk from potential owner churn (Miguel Fernandez)"
    ],
    operationalBottlenecks: [
      "Atlas Services: 86h avg response (baseline 14h), 39% completion rate, 34% escalation rate",
      "Barcelona Home Care: declining to 72% completion, 24h response — early warning pattern",
      "No backup vendor coverage for 3,200 Southern Spain properties"
    ],
    recommendedFocus: [
      "TODAY: Issue SLA breach notice to Atlas Services + deploy emergency maintenance team",
      "THIS WEEK: Onboard backup vendor + launch guest/owner recovery programs",
      "THIS MONTH: Implement vendor performance monitoring + multi-vendor strategy"
    ],
    overallRiskLevel: "critical",
    confidenceStatement: "Analysis based on 381 support tickets, 1,095 reviews, 201 maintenance incidents, and 7 vendor performance profiles from the past 30 days."
  };
}

// Helper
function formatEvidenceKey(key) {
  return key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase()).replace(/_/g, ' ');
}

module.exports = {
  generateRootCauseAnalysis,
  generateRecommendations,
  generateExecutiveSummary,
};
