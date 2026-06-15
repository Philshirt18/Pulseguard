/**
 * PulseGuard AI V2 - Agent Intelligence Engine
 * 
 * Generates agentic behavior data:
 * - Investigation Timelines
 * - Forecast Predictions
 * - Autonomous Actions Taken
 * - Agent Memory
 * - Hidden Correlation Discovery
 * - Executive Assessment
 * - Business Impact Dashboard
 * 
 * All deterministic. Makes PulseGuard feel like an AI COO.
 */

// ==========================================
// INVESTIGATION TIMELINE
// ==========================================

function getInvestigationTimeline(risk) {
  if (risk.type === 'operational' && risk.evidence?.vendor === 'Atlas Services') {
    return [
      { date: 'May 12', event: 'Complaint volume begins increasing in Southern Spain', confidence: 42, status: 'detected' },
      { date: 'May 15', event: 'Maintenance response times exceed 48h threshold', confidence: 51, status: 'detected' },
      { date: 'May 18', event: 'Refund requests exceed regional baseline by 80%', confidence: 58, status: 'investigating' },
      { date: 'May 22', event: 'Pattern correlation: complaints cluster around maintenance delays', confidence: 71, status: 'investigating' },
      { date: 'May 25', event: 'Vendor Atlas Services identified as common factor in 78% of delays', confidence: 82, status: 'identified' },
      { date: 'May 28', event: 'Cascading impact confirmed: reviews, cancellations, owner satisfaction', confidence: 89, status: 'confirmed' },
      { date: 'Jun 1', event: 'Root cause confirmed: systematic vendor performance collapse', confidence: 96, status: 'confirmed' },
    ];
  }

  if (risk.type === 'customer_satisfaction' && risk.region === 'Southern Spain') {
    return [
      { date: 'May 14', event: 'Negative review rate rises above 25% threshold', confidence: 38, status: 'detected' },
      { date: 'May 19', event: 'Complaint volume exceeds 2x baseline', confidence: 55, status: 'investigating' },
      { date: 'May 23', event: 'Guest feedback pattern: "maintenance" keyword appears in 67% of complaints', confidence: 68, status: 'investigating' },
      { date: 'May 27', event: 'Rating decline accelerates — 0.3 point drop in 7 days', confidence: 79, status: 'identified' },
      { date: 'May 31', event: 'Correlation confirmed: maintenance delays → guest dissatisfaction', confidence: 91, status: 'confirmed' },
      { date: 'Jun 2', event: 'Crisis-level threshold breached: 42% negative review rate', confidence: 95, status: 'confirmed' },
    ];
  }

  if (risk.type === 'owner_churn') {
    return [
      { date: 'May 10', event: 'Owner satisfaction score drops below 3.0 threshold', confidence: 45, status: 'detected' },
      { date: 'May 16', event: 'Escalation frequency doubles compared to historical average', confidence: 58, status: 'investigating' },
      { date: 'May 21', event: 'Owner properties show declining guest ratings', confidence: 69, status: 'investigating' },
      { date: 'May 26', event: 'Churn risk model triggers: satisfaction + escalations + tenure pattern', confidence: 82, status: 'identified' },
      { date: 'May 30', event: 'Owner flagged as imminent churn risk — matches 78% historical churn profile', confidence: 90, status: 'confirmed' },
    ];
  }

  if (risk.type === 'revenue') {
    return [
      { date: 'May 13', event: 'Cancellation rate exceeds 10% in region', confidence: 40, status: 'detected' },
      { date: 'May 18', event: 'Refund volume crosses €100,000 monthly threshold', confidence: 55, status: 'investigating' },
      { date: 'May 24', event: 'Booking conversion rate declining — negative reviews impacting demand', confidence: 72, status: 'investigating' },
      { date: 'May 29', event: 'Revenue trajectory confirms: accelerating loss pattern', confidence: 82, status: 'confirmed' },
    ];
  }

  // Generic
  return [
    { date: 'May 15', event: 'Initial anomaly detected in operational metrics', confidence: 40, status: 'detected' },
    { date: 'May 22', event: 'Pattern confirmed across multiple data sources', confidence: 65, status: 'investigating' },
    { date: 'May 29', event: 'Root cause identified and risk quantified', confidence: 85, status: 'confirmed' },
  ];
}

// ==========================================
// FORECAST ENGINE
// ==========================================

function getForecast(risk) {
  if (risk.type === 'operational' && risk.evidence?.vendor === 'Atlas Services') {
    return {
      sevenDay: [
        { metric: 'Refund volume', change: '+18%', direction: 'up' },
        { metric: 'Complaint volume', change: '+24%', direction: 'up' },
        { metric: 'Maintenance backlog', change: '+31%', direction: 'up' },
        { metric: 'Guest satisfaction', change: '-0.2 points', direction: 'down' },
      ],
      thirtyDay: [
        { metric: 'Negative reviews', change: '+22%', direction: 'up' },
        { metric: 'Revenue impact', change: '€46,000 additional loss', direction: 'up' },
        { metric: 'Cancellation rate', change: '→ 21.3% (from 17.5%)', direction: 'up' },
        { metric: 'Owner satisfaction', change: '-0.5 points across region', direction: 'down' },
      ],
      sixtyDay: [
        { metric: 'Owner churn probability', change: '64% (from 38%)', direction: 'up' },
        { metric: 'Estimated revenue exposure', change: '€412,000', direction: 'up' },
        { metric: 'Properties at risk', change: '3,200 → degraded reputation', direction: 'up' },
        { metric: 'Recovery timeline', change: '16+ weeks (compounding)', direction: 'up' },
      ],
      confidence: 87,
      model: 'Based on 30-day trend extrapolation and historical pattern matching',
    };
  }

  if (risk.type === 'customer_satisfaction') {
    return {
      sevenDay: [
        { metric: 'Complaint volume', change: '+15%', direction: 'up' },
        { metric: 'Average rating', change: '-0.15 points', direction: 'down' },
        { metric: 'Refund requests', change: '+12%', direction: 'up' },
      ],
      thirtyDay: [
        { metric: 'Booking conversion', change: '-8% from reputation damage', direction: 'down' },
        { metric: 'Revenue impact', change: '€38,000 in lost bookings', direction: 'up' },
        { metric: 'Rating trajectory', change: '→ 2.5 (crisis threshold)', direction: 'down' },
      ],
      sixtyDay: [
        { metric: 'Market position', change: 'Competitors gain 12% share', direction: 'up' },
        { metric: 'Recovery timeline', change: '12+ weeks to restore ratings', direction: 'up' },
        { metric: 'Total revenue exposure', change: '€180,000', direction: 'up' },
      ],
      confidence: 82,
      model: 'Based on review velocity trends and booking conversion correlation',
    };
  }

  if (risk.type === 'owner_churn') {
    return {
      sevenDay: [
        { metric: 'Escalation probability', change: '+2 additional escalations', direction: 'up' },
        { metric: 'Owner engagement', change: 'Declining response rate', direction: 'down' },
      ],
      thirtyDay: [
        { metric: 'Churn probability', change: '→ 78% (from current 64%)', direction: 'up' },
        { metric: 'Contract renewal', change: 'Non-renewal likely', direction: 'down' },
        { metric: 'Signal effect', change: '3 neighboring owners watching', direction: 'up' },
      ],
      sixtyDay: [
        { metric: 'Portfolio loss', change: '12 properties (€890,000/year)', direction: 'up' },
        { metric: 'Cascade risk', change: '4-6 additional owners may follow', direction: 'up' },
        { metric: 'Total exposure', change: '€2.1M annual revenue', direction: 'up' },
      ],
      confidence: 79,
      model: 'Based on owner behavior patterns and historical churn data',
    };
  }

  // Revenue / generic
  return {
    sevenDay: [
      { metric: 'Cancellation rate', change: '+3 percentage points', direction: 'up' },
      { metric: 'Refund volume', change: '+€18,000', direction: 'up' },
    ],
    thirtyDay: [
      { metric: 'Revenue loss', change: '€72,000 cumulative', direction: 'up' },
      { metric: 'Occupancy rate', change: '-6%', direction: 'down' },
    ],
    sixtyDay: [
      { metric: 'Total exposure', change: '€195,000', direction: 'up' },
      { metric: 'Market recovery', change: '8-10 weeks after fix', direction: 'up' },
    ],
    confidence: 75,
    model: 'Based on cancellation velocity and seasonal demand patterns',
  };
}

// ==========================================
// AUTONOMOUS ACTIONS
// ==========================================

function getAutonomousActions(risk) {
  if (risk.type === 'operational' && risk.evidence?.vendor === 'Atlas Services') {
    return [
      { action: 'Created Incident Channel', detail: '#atlas-services-crisis', status: 'completed', icon: '📢' },
      { action: 'Assigned Executive Owner', detail: 'VP Operations — Carlos Mendez', status: 'completed', icon: '👤' },
      { action: 'Escalated Risk Priority', detail: 'Medium → Critical', status: 'completed', icon: '🔴' },
      { action: 'Generated Remediation Plan', detail: '6-point action plan ready for review', status: 'completed', icon: '📋' },
      { action: 'Notified Affected Owners', detail: '17 property owners in impact zone', status: 'completed', icon: '📧' },
      { action: 'Scheduled Follow-Up Review', detail: 'In 48 hours — auto-reassess risk score', status: 'scheduled', icon: '⏰' },
      { action: 'Flagged Vendor Contract', detail: 'SLA breach clause activated', status: 'completed', icon: '⚖️' },
    ];
  }

  if (risk.type === 'customer_satisfaction') {
    return [
      { action: 'Created Response Team', detail: '#southern-spain-recovery', status: 'completed', icon: '👥' },
      { action: 'Escalated to CS Director', detail: 'Priority override applied', status: 'completed', icon: '🔴' },
      { action: 'Drafted Guest Communications', detail: 'Apology + service credit templates', status: 'completed', icon: '✉️' },
      { action: 'Flagged Review Responses', detail: '23 negative reviews queued for response', status: 'completed', icon: '⭐' },
      { action: 'Scheduled Daily Monitoring', detail: 'Auto-report until resolution', status: 'scheduled', icon: '📊' },
    ];
  }

  if (risk.type === 'owner_churn') {
    return [
      { action: 'Priority Owner Alert', detail: 'VP Owner Relations notified', status: 'completed', icon: '🚨' },
      { action: 'Generated Retention Package', detail: 'Fee reduction + priority service offer', status: 'completed', icon: '💼' },
      { action: 'Scheduled Executive Call', detail: 'Regional VP → Owner, within 24h', status: 'scheduled', icon: '📞' },
      { action: 'Assigned Dedicated Manager', detail: 'Single point of contact activated', status: 'completed', icon: '👤' },
      { action: 'Performance Report Generated', detail: 'Transparent property performance data', status: 'completed', icon: '📈' },
    ];
  }

  return [
    { action: 'Created Incident Tracker', detail: `#risk-${risk.id}`, status: 'completed', icon: '📢' },
    { action: 'Assigned Risk Owner', detail: 'Regional Manager notified', status: 'completed', icon: '👤' },
    { action: 'Escalated Priority', detail: `→ ${risk.severity.toUpperCase()}`, status: 'completed', icon: '🔴' },
    { action: 'Scheduled Review', detail: '72-hour reassessment', status: 'scheduled', icon: '⏰' },
  ];
}

// ==========================================
// AGENT MEMORY
// ==========================================

function getAgentMemory(risk) {
  if (risk.type === 'operational' && risk.evidence?.vendor === 'Atlas Services') {
    return {
      firstFlagged: '21 days ago',
      previousScores: [
        { date: 'May 12', score: 45, severity: 'medium' },
        { date: 'May 19', score: 71, severity: 'high' },
        { date: 'May 26', score: 112, severity: 'critical' },
        { date: 'Today', score: 177, severity: 'critical' },
      ],
      previousRecommendations: [
        { recommendation: 'Increase vendor oversight', status: 'not_implemented', daysAgo: 14 },
        { recommendation: 'Deploy backup vendor', status: 'not_implemented', daysAgo: 14 },
        { recommendation: 'Issue SLA warning', status: 'not_implemented', daysAgo: 7 },
      ],
      observations: [
        'Risk score increased 294% over 21 days',
        'Previous recommendations were not actioned',
        'Issue has now cascaded into 3 additional risk categories',
        'Delay cost: estimated €156,000 in preventable losses',
      ],
    };
  }

  if (risk.type === 'customer_satisfaction') {
    return {
      firstFlagged: '18 days ago',
      previousScores: [
        { date: 'May 15', score: 52, severity: 'medium' },
        { date: 'May 22', score: 89, severity: 'high' },
        { date: 'Today', score: 165, severity: 'critical' },
      ],
      previousRecommendations: [
        { recommendation: 'Launch review response campaign', status: 'partial', daysAgo: 10 },
        { recommendation: 'Investigate maintenance correlation', status: 'not_implemented', daysAgo: 10 },
      ],
      observations: [
        'Risk score increased 217% over 18 days',
        'Root cause (vendor failure) was not addressed at source',
        'Satisfaction issue is a symptom, not the disease',
      ],
    };
  }

  if (risk.type === 'owner_churn') {
    return {
      firstFlagged: '12 days ago',
      previousScores: [
        { date: 'May 21', score: 68, severity: 'high' },
        { date: 'May 28', score: 96, severity: 'critical' },
        { date: 'Today', score: 126, severity: 'critical' },
      ],
      previousRecommendations: [
        { recommendation: 'Proactive owner outreach', status: 'not_implemented', daysAgo: 12 },
      ],
      observations: [
        'Owner has filed 3 additional escalations since first flag',
        'No proactive communication from EuroStay to owner',
        'Every day of inaction increases churn probability by ~2%',
      ],
    };
  }

  return {
    firstFlagged: '14 days ago',
    previousScores: [
      { date: '2 weeks ago', score: Math.round(risk.severityScore * 0.5), severity: 'medium' },
      { date: 'Today', score: Math.round(risk.severityScore), severity: risk.severity },
    ],
    previousRecommendations: [],
    observations: ['Risk has been escalating steadily since detection'],
  };
}

// ==========================================
// HIDDEN CORRELATION DISCOVERY
// ==========================================

function getHiddenCorrelation(risk) {
  if (risk.type === 'operational' && risk.evidence?.vendor === 'Atlas Services') {
    return {
      title: 'Previously Unknown Relationship Discovered',
      insight: 'PulseGuard identified a previously unknown correlation between maintenance response times and *owner churn probability*.',
      detail: 'Properties experiencing maintenance delays greater than 48 hours show a *3.2x higher probability* of owner dissatisfaction within 30 days. This relationship was not tracked by any existing team or system.',
      dataPoints: 'Correlation strength: r=0.87 across 201 maintenance incidents and 6 owner satisfaction profiles',
      implication: 'This means the Atlas Services failure is not just a guest problem — it is actively driving owner churn at a rate that will become visible in contract renewals within 60 days.',
      confidence: 91,
      novelty: 'No team had previously identified this maintenance → owner churn pathway',
    };
  }

  if (risk.type === 'customer_satisfaction') {
    return {
      title: 'Hidden Pattern Detected',
      insight: 'PulseGuard discovered that negative reviews posted between *Friday-Sunday* have a *2.4x greater impact* on subsequent booking cancellations than weekday reviews.',
      detail: 'Weekend travelers are 2.4x more likely to cancel upcoming bookings after reading negative reviews, likely due to having more time to research alternatives.',
      dataPoints: 'Analysis of 1,095 reviews cross-referenced with 156 cancellation events',
      implication: 'Prioritizing review responses on Friday mornings could prevent 30% of weekend-triggered cancellations.',
      confidence: 84,
      novelty: 'This temporal pattern was not previously known to the marketing or CS teams',
    };
  }

  if (risk.type === 'owner_churn') {
    return {
      title: 'Early Warning Signal Discovered',
      insight: 'PulseGuard identified that owners who receive *3+ guest complaints in a 7-day window* have a *78% probability* of filing an escalation within 48 hours.',
      detail: 'This creates a predictive window: monitoring guest complaint clustering per owner enables 48-hour advance warning of owner escalations.',
      dataPoints: 'Pattern validated across 6 owners and 381 support tickets over 30 days',
      implication: 'Proactive outreach triggered by complaint clustering could prevent 60% of owner escalations before they occur.',
      confidence: 88,
      novelty: 'This predictive signal was not part of any existing owner health monitoring',
    };
  }

  return {
    title: 'Cross-Signal Correlation Found',
    insight: `PulseGuard identified a previously untracked relationship between operational metrics in the ${risk.region} region.`,
    detail: 'Multiple independent signals are converging in a pattern that historically precedes significant operational incidents.',
    dataPoints: `Analysis of ${Object.keys(risk.evidence || {}).length}+ data points across multiple operational systems`,
    implication: 'Early intervention on the identified root cause can prevent cascade effects across related risk categories.',
    confidence: 79,
    novelty: 'This cross-category correlation was not previously monitored',
  };
}

// ==========================================
// EXECUTIVE ASSESSMENT
// ==========================================

function getExecutiveAssessment(risk) {
  if (risk.type === 'operational' && risk.evidence?.vendor === 'Atlas Services') {
    return {
      recommendation: 'Immediate executive intervention is recommended.',
      assessment: 'Current trajectory indicates *accelerating operational degradation* across Southern Spain. A single vendor failure has cascaded into customer satisfaction, revenue, and owner retention simultaneously. This is no longer an operational issue — it is a strategic threat to the Mediterranean portfolio.',
      exposure: '€294,000 annualized',
      riskLevel: 'Critical — Escalating',
      urgency: 'Every day of inaction adds approximately €8,000 in losses and extends recovery timeline by 2+ days.',
    };
  }

  if (risk.type === 'customer_satisfaction') {
    return {
      recommendation: 'Immediate guest recovery program required.',
      assessment: 'Guest satisfaction in Southern Spain has crossed the *crisis threshold*. The current 42% negative review rate is actively destroying demand for future bookings. This is a compounding problem: each negative review reduces future booking probability, creating a downward spiral that accelerates without intervention.',
      exposure: '€180,000 monthly revenue at risk',
      riskLevel: 'Critical — Compounding',
      urgency: 'Reputation damage compounds daily. Each week of inaction adds approximately 2 weeks to the recovery timeline.',
    };
  }

  if (risk.type === 'owner_churn') {
    return {
      recommendation: 'Personal executive outreach within 24 hours.',
      assessment: 'A top-10 revenue owner is signaling imminent departure. The escalation pattern, satisfaction decline, and silence pattern match *78% of historical churn cases*. This owner represents €890,000 in annual revenue and influences 3+ neighboring owners who are watching how EuroStay responds.',
      exposure: '€712,000 direct + €1.2M cascade risk',
      riskLevel: 'Critical — Time-sensitive',
      urgency: 'Based on historical patterns, the intervention window is approximately 7-10 days before the decision becomes irreversible.',
    };
  }

  if (risk.type === 'revenue') {
    return {
      recommendation: 'Revenue protection measures needed this week.',
      assessment: 'Cancellation rates have reached *2.7x baseline* and are accelerating. The primary driver is reputation damage from unresolved operational issues. Revenue recovery will lag operational fix by 6-8 weeks due to booking lead times.',
      exposure: `€${Math.round(risk.severityScore * 2500).toLocaleString()} projected`,
      riskLevel: 'Critical — Accelerating',
      urgency: 'Peak season amplifies both the loss rate and the recovery difficulty. Immediate action required.',
    };
  }

  return {
    recommendation: 'Management attention recommended.',
    assessment: `Operational metrics in ${risk.region} have crossed alert thresholds. Without intervention, the issue is projected to escalate within 2-3 weeks.`,
    exposure: `€${Math.round(risk.severityScore * 300).toLocaleString()}`,
    riskLevel: risk.severity.charAt(0).toUpperCase() + risk.severity.slice(1),
    urgency: 'Action within 1-2 weeks recommended to prevent further deterioration.',
  };
}

// ==========================================
// BUSINESS IMPACT DASHBOARD
// ==========================================

function getBusinessImpact(risk, allRisks) {
  if (risk.type === 'operational' && risk.evidence?.vendor === 'Atlas Services') {
    return {
      revenueAtRisk: '€294,000',
      revenueAtRiskPeriod: 'annually',
      propertiesAffected: '3,200',
      ownersAtRisk: '17',
      reputationImpact: '1.4 point rating decrease (4.2 → 2.8)',
      escalationWindow: '14 days until irreversible owner churn',
      guestsImpacted: '~890 this month',
      employeesInvolved: '45 across 3 departments',
    };
  }

  if (risk.type === 'customer_satisfaction') {
    return {
      revenueAtRisk: '€180,000',
      revenueAtRiskPeriod: 'monthly',
      propertiesAffected: '3,200',
      ownersAtRisk: '12',
      reputationImpact: '42% negative review rate (baseline: 15%)',
      escalationWindow: '7 days until rating drops below 2.5',
      guestsImpacted: '~650 affected stays',
      employeesInvolved: '28 in Customer Success',
    };
  }

  if (risk.type === 'owner_churn') {
    return {
      revenueAtRisk: '€890,000',
      revenueAtRiskPeriod: 'annual (single owner)',
      propertiesAffected: '12',
      ownersAtRisk: '1 critical + 4 watching',
      reputationImpact: 'Signal effect to neighboring owners',
      escalationWindow: '7-10 days until decision point',
      guestsImpacted: '~180 future bookings',
      employeesInvolved: '6 in Owner Relations',
    };
  }

  return {
    revenueAtRisk: `€${Math.round(risk.severityScore * 2000).toLocaleString()}`,
    revenueAtRiskPeriod: 'projected',
    propertiesAffected: String(Math.round(risk.severityScore * 15)),
    ownersAtRisk: String(Math.round(risk.severityScore / 20)),
    reputationImpact: 'Moderate — trending negative',
    escalationWindow: '2-3 weeks',
    guestsImpacted: String(Math.round(risk.severityScore * 5)),
    employeesInvolved: '~10',
  };
}

// ==========================================
// V3: EXPLAINABLE IMPACT CALCULATION
// ==========================================

function getImpactCalculation(risk) {
  if (risk.type === 'operational' && risk.evidence?.vendor === 'Atlas Services') {
    return {
      title: 'Revenue Exposure Calculation',
      steps: [
        { label: 'Active complaints (30 days)', value: '89' },
        { label: 'Average booking value', value: '€1,120' },
        { label: 'Cancellation probability increase', value: '+31%' },
        { label: 'Affected future bookings', value: '752' },
        { label: 'Average refund per cancellation', value: '€1,500' },
      ],
      formula: '752 bookings × 31% cancel probability × €1,500 avg refund',
      result: '€294,000',
      resultLabel: 'Estimated Annual Revenue Exposure',
      confidence: 89,
      additionalNote: 'Daily accrual rate: €8,000 (based on 5.3 new cancellations/day × €1,500)',
    };
  }

  if (risk.type === 'customer_satisfaction') {
    return {
      title: 'Satisfaction Impact Calculation',
      steps: [
        { label: 'Current negative review rate', value: '42%' },
        { label: 'Baseline negative review rate', value: '15%' },
        { label: 'Booking conversion impact per 1% negative', value: '-0.4%' },
        { label: 'Monthly booking volume (region)', value: '890' },
        { label: 'Average booking value', value: '€1,120' },
      ],
      formula: '(42% - 15%) × 0.4% conversion loss × 890 bookings × €1,120',
      result: '€180,000',
      resultLabel: 'Estimated Monthly Revenue Impact',
      confidence: 82,
      additionalNote: 'Each additional week of decline adds €12,000/month to the baseline loss rate.',
    };
  }

  if (risk.type === 'owner_churn') {
    return {
      title: 'Owner Churn Impact Calculation',
      steps: [
        { label: 'Owner annual revenue', value: '€890,000' },
        { label: 'Portfolio utilization rate', value: '89%' },
        { label: 'Current satisfaction score', value: '2.3 / 5.0' },
        { label: 'Historical churn at this score', value: '64%' },
        { label: 'Revenue recovery if churned', value: '~20% (new owner ramp)' },
      ],
      formula: '€890,000 × 80% loss probability × (1 - 20% recovery)',
      result: '€712,000',
      resultLabel: 'Net Revenue At Risk',
      confidence: 79,
      additionalNote: 'Cascade risk: 3 neighboring owners represent additional €1.2M annual revenue exposure.',
    };
  }

  if (risk.type === 'revenue') {
    return {
      title: 'Revenue Loss Calculation',
      steps: [
        { label: 'Current cancellation rate', value: '17.5%' },
        { label: 'Baseline cancellation rate', value: '6.5%' },
        { label: 'Excess cancellations (monthly)', value: '98' },
        { label: 'Average refund value', value: '€1,500' },
        { label: 'Growth trajectory', value: '+18% month-over-month' },
      ],
      formula: '98 excess cancellations × €1,500 × (1 + 18% monthly growth) × 12',
      result: '€234,000',
      resultLabel: 'Current Monthly Loss (Annualized: €2.8M trajectory)',
      confidence: 82,
      additionalNote: 'At current trajectory, monthly losses will reach €304,000 within 30 days.',
    };
  }

  return {
    title: 'Impact Calculation',
    steps: [
      { label: 'Severity score', value: String(Math.round(risk.severityScore)) },
      { label: 'Affected operations', value: risk.region },
      { label: 'Confidence level', value: `${Math.round(risk.confidence * 100)}%` },
    ],
    formula: 'Risk score × regional revenue factor × confidence',
    result: `€${Math.round(risk.severityScore * 300).toLocaleString()}`,
    resultLabel: 'Estimated Impact',
    confidence: Math.round(risk.confidence * 100),
    additionalNote: null,
  };
}

// ==========================================
// V3: MULTI-HYPOTHESIS REASONING
// ==========================================

function getHypotheses(risk) {
  if (risk.type === 'operational' && risk.evidence?.vendor === 'Atlas Services') {
    return {
      hypotheses: [
        {
          title: 'Vendor Atlas Services Performance Collapse',
          confidence: 96,
          evidenceStrength: 'Very High',
          evidencePoints: ['78% of delays trace to this vendor', 'Response time 514% above baseline', '39% completion rate vs 90% standard'],
          selected: true,
          explains: '84% of observed anomalies',
        },
        {
          title: 'Regional Staffing Shortage',
          confidence: 31,
          evidenceStrength: 'Low',
          evidencePoints: ['Some overlap with school holiday period', 'No evidence from other vendors in same region'],
          selected: false,
          explains: '12% of anomalies (non-maintenance complaints)',
        },
        {
          title: 'Check-In Process Degradation',
          confidence: 18,
          evidenceStrength: 'Very Low',
          evidencePoints: ['Minor increase in check-in complaints', 'Not correlated with maintenance delays'],
          selected: false,
          explains: '6% of anomalies',
        },
        {
          title: 'Seasonal Demand Surge',
          confidence: 12,
          evidenceStrength: 'Very Low',
          evidencePoints: ['Demand is within normal seasonal range', 'Other regions with similar demand show no issues'],
          selected: false,
          explains: '<5% — does not explain vendor-specific pattern',
        },
      ],
      conclusion: 'Atlas Services vendor failure is the only hypothesis that explains the convergence of maintenance delays, complaint spikes, review declines, and owner dissatisfaction simultaneously.',
      methodology: 'PulseGuard evaluated 4 competing hypotheses by measuring each against 8 independent data signals. The selected root cause explains 84% of all observed anomalies.',
    };
  }

  if (risk.type === 'customer_satisfaction') {
    return {
      hypotheses: [
        {
          title: 'Maintenance-Driven Guest Dissatisfaction',
          confidence: 91,
          evidenceStrength: 'Very High',
          evidencePoints: ['67% of complaints mention maintenance', 'Rating decline correlates with vendor delays', 'Non-maintenance complaints are at baseline'],
          selected: true,
          explains: '78% of satisfaction decline',
        },
        {
          title: 'Pricing Dissatisfaction',
          confidence: 24,
          evidenceStrength: 'Low',
          evidencePoints: ['No significant pricing changes in period', 'Competitors at similar price points'],
          selected: false,
          explains: '<10% — price-related complaints not elevated',
        },
        {
          title: 'Communication/Service Gaps',
          confidence: 35,
          evidenceStrength: 'Medium',
          evidencePoints: ['Some evidence of delayed responses', 'Likely a secondary effect of overwhelmed CS team'],
          selected: false,
          explains: '18% — contributing factor, not root cause',
        },
      ],
      conclusion: 'Guest dissatisfaction is primarily driven by unresolved maintenance issues, which trace upstream to the Atlas Services vendor failure.',
      methodology: 'Sentiment analysis of 1,095 reviews combined with complaint category mapping confirms maintenance as the dominant dissatisfaction driver.',
    };
  }

  if (risk.type === 'owner_churn') {
    return {
      hypotheses: [
        {
          title: 'Service Quality Deterioration',
          confidence: 88,
          evidenceStrength: 'High',
          evidencePoints: ['Owner properties directly impacted by maintenance failures', 'Guest complaints on owner properties up 340%', 'Owner sees declining ratings on their listings'],
          selected: true,
          explains: '82% of owner dissatisfaction signals',
        },
        {
          title: 'Revenue Underperformance',
          confidence: 42,
          evidenceStrength: 'Medium',
          evidencePoints: ['Occupancy rates slightly below YoY', 'However, rates are within seasonal norms'],
          selected: false,
          explains: '15% — contributing concern but not primary driver',
        },
        {
          title: 'Competitor Poaching',
          confidence: 15,
          evidenceStrength: 'Low',
          evidencePoints: ['No direct evidence of competitor outreach', 'Owner has not mentioned alternatives'],
          selected: false,
          explains: '<5% — speculative',
        },
      ],
      conclusion: 'Owner churn risk is directly caused by service quality deterioration on their properties, which traces to the upstream vendor failure affecting the entire Southern Spain region.',
      methodology: 'Owner behavior pattern matching against historical churn cases (n=47) shows 78% similarity to confirmed churn profiles.',
    };
  }

  return {
    hypotheses: [
      {
        title: 'Primary operational factor',
        confidence: Math.round(risk.confidence * 100),
        evidenceStrength: 'High',
        evidencePoints: Object.entries(risk.evidence || {}).slice(0, 3).map(([k, v]) => `${k}: ${v}`),
        selected: true,
        explains: `${Math.round(risk.confidence * 85)}% of anomalies`,
      },
      {
        title: 'Alternative explanation',
        confidence: 25,
        evidenceStrength: 'Low',
        evidencePoints: ['Limited supporting data'],
        selected: false,
        explains: '<15%',
      },
    ],
    conclusion: `The selected hypothesis best explains the observed pattern across ${Object.keys(risk.evidence || {}).length} data points.`,
    methodology: 'Cross-signal analysis with competing hypothesis evaluation.',
  };
}

// ==========================================
// V3: CONFIDENCE EVOLUTION
// ==========================================

function getConfidenceEvolution(risk) {
  const timeline = getInvestigationTimeline(risk);
  return timeline.map(t => ({
    date: t.date,
    confidence: t.confidence,
    bar: buildConfBar(t.confidence),
  }));
}

function buildConfBar(confidence) {
  const filled = Math.round(confidence / 10);
  const empty = 10 - filled;
  return '█'.repeat(filled) + '░'.repeat(empty);
}

// ==========================================
// V3: DECISION SUPPORT
// ==========================================

function getDecisionSupport(risk) {
  if (risk.type === 'operational' && risk.evidence?.vendor === 'Atlas Services') {
    return {
      options: [
        {
          label: 'Option A',
          title: 'Terminate & Replace Atlas Services',
          impact: 'Highest',
          cost: 'High (€85,000 transition)',
          risk: 'Low',
          timeline: '3-4 weeks',
          outcome: 'Full resolution. Eliminates root cause permanently.',
        },
        {
          label: 'Option B',
          title: 'Deploy Supplemental Vendor + Enforce SLAs',
          impact: 'High',
          cost: 'Medium (€45,000)',
          risk: 'Low',
          timeline: '2 weeks',
          outcome: 'Immediate relief. Maintains pressure on Atlas Services for improvement.',
        },
        {
          label: 'Option C',
          title: 'Expand Internal Maintenance Team',
          impact: 'Medium',
          cost: 'Very High (€180,000/year)',
          risk: 'Medium',
          timeline: '6-8 weeks',
          outcome: 'Long-term control. But slow to deploy and high fixed cost.',
        },
      ],
      recommendation: {
        selected: 'Option B',
        reason: 'Highest projected risk reduction with lowest execution complexity and fastest time-to-impact. Provides immediate relief while preserving optionality to escalate to Option A if Atlas Services fails to improve within 30 days.',
        projectedOutcome: '65% risk reduction within 2 weeks. Revenue protection: €24,500/month. Preserves ability to terminate vendor if needed.',
      },
    };
  }

  if (risk.type === 'customer_satisfaction') {
    return {
      options: [
        {
          label: 'Option A',
          title: 'Full Guest Recovery Program + Root Cause Fix',
          impact: 'Highest',
          cost: 'High (€120,000)',
          risk: 'Low',
          timeline: '4-6 weeks to full recovery',
          outcome: 'Addresses both symptoms (guest satisfaction) and cause (maintenance).',
        },
        {
          label: 'Option B',
          title: 'Targeted Review Management + Service Credits',
          impact: 'Medium',
          cost: 'Medium (€55,000)',
          risk: 'Medium',
          timeline: '2-3 weeks for stabilization',
          outcome: 'Mitigates reputation damage. Does not fix root cause.',
        },
        {
          label: 'Option C',
          title: 'Marketing/Promotion Offset Strategy',
          impact: 'Low',
          cost: 'Medium (€60,000)',
          risk: 'High',
          timeline: '1 week to deploy',
          outcome: 'Masks problem with discounts. Risk of further brand damage.',
        },
      ],
      recommendation: {
        selected: 'Option A',
        reason: 'The only option that addresses root cause. Options B and C treat symptoms while the underlying maintenance problem continues generating new dissatisfied guests daily.',
        projectedOutcome: 'Return to 4.0+ rating within 60 days. Prevents €180,000/month revenue erosion. Stops negative review compounding.',
      },
    };
  }

  if (risk.type === 'owner_churn') {
    return {
      options: [
        {
          label: 'Option A',
          title: 'Executive Intervention + Retention Package',
          impact: 'Highest',
          cost: 'Medium (€35,000 in concessions)',
          risk: 'Low',
          timeline: 'Immediate',
          outcome: 'Directly addresses owner concerns. High success rate for retention.',
        },
        {
          label: 'Option B',
          title: 'Service Improvement Plan (no concessions)',
          impact: 'Medium',
          cost: 'Low',
          risk: 'High',
          timeline: '2-4 weeks',
          outcome: 'Demonstrates commitment but no immediate relief for owner.',
        },
        {
          label: 'Option C',
          title: 'Accept Churn + Backfill Portfolio',
          impact: 'Low',
          cost: 'Very High (€712K revenue loss + acquisition costs)',
          risk: 'High',
          timeline: '3-6 months',
          outcome: 'Loss of premium owner. Signal effect may trigger additional departures.',
        },
      ],
      recommendation: {
        selected: 'Option A',
        reason: 'Retention cost (€35,000) is <5% of at-risk revenue (€712,000). Executive attention signals organizational commitment and matches the escalation level the owner expects.',
        projectedOutcome: '70% retention probability with immediate intervention. Prevents cascade to neighboring owners. ROI: 20:1.',
      },
    };
  }

  return {
    options: [
      {
        label: 'Option A',
        title: 'Immediate intervention',
        impact: 'Highest',
        cost: 'Medium',
        risk: 'Low',
        timeline: '1-2 weeks',
        outcome: 'Direct resolution of identified risk.',
      },
      {
        label: 'Option B',
        title: 'Monitor and reassess',
        impact: 'Low',
        cost: 'Low',
        risk: 'High',
        timeline: 'Ongoing',
        outcome: 'Risk may escalate. Cost of delay increases.',
      },
    ],
    recommendation: {
      selected: 'Option A',
      reason: 'Risk trajectory is accelerating. Delay increases both cost and complexity of resolution.',
      projectedOutcome: 'Projected stabilization within 2-3 weeks of action.',
    },
  };
}

// ==========================================
// V4: EVIDENCE WEIGHTING
// ==========================================

function getEvidenceWeighting(risk) {
  if (risk.type === 'operational' && risk.evidence?.vendor === 'Atlas Services') {
    return {
      weights: [
        { signal: 'Maintenance SLA Violations', weight: 38, dataPoints: 67 },
        { signal: 'Refund Volume Growth', weight: 24, dataPoints: 156 },
        { signal: 'Guest Complaint Clustering', weight: 19, dataPoints: 89 },
        { signal: 'Owner Dissatisfaction Signals', weight: 12, dataPoints: 8 },
        { signal: 'Negative Review Acceleration', weight: 7, dataPoints: 210 },
      ],
      finalConfidence: 96,
      totalDataPoints: 530,
      methodology: 'Bayesian weighting across 5 independent signal categories with temporal correlation adjustment',
    };
  }

  if (risk.type === 'customer_satisfaction') {
    return {
      weights: [
        { signal: 'Negative Review Rate', weight: 34, dataPoints: 1095 },
        { signal: 'Complaint Volume Spike', weight: 28, dataPoints: 89 },
        { signal: 'Refund Request Growth', weight: 20, dataPoints: 34 },
        { signal: 'Rating Decline Velocity', weight: 12, dataPoints: 210 },
        { signal: 'Repeat Complaint Pattern', weight: 6, dataPoints: 23 },
      ],
      finalConfidence: 95,
      totalDataPoints: 1451,
      methodology: 'Sentiment-weighted signal analysis with review velocity normalization',
    };
  }

  if (risk.type === 'owner_churn') {
    return {
      weights: [
        { signal: 'Satisfaction Score Decline', weight: 35, dataPoints: 12 },
        { signal: 'Escalation Frequency', weight: 30, dataPoints: 8 },
        { signal: 'Property Performance Drop', weight: 18, dataPoints: 36 },
        { signal: 'Communication Pattern Change', weight: 10, dataPoints: 15 },
        { signal: 'Historical Churn Match', weight: 7, dataPoints: 47 },
      ],
      finalConfidence: 90,
      totalDataPoints: 118,
      methodology: 'Owner behavior pattern matching against historical churn dataset (n=47 confirmed churns)',
    };
  }

  if (risk.type === 'revenue') {
    return {
      weights: [
        { signal: 'Cancellation Rate Excess', weight: 40, dataPoints: 156 },
        { signal: 'Refund Volume', weight: 25, dataPoints: 98 },
        { signal: 'Booking Conversion Decline', weight: 20, dataPoints: 890 },
        { signal: 'Review-Driven Demand Loss', weight: 15, dataPoints: 210 },
      ],
      finalConfidence: 82,
      totalDataPoints: 1354,
      methodology: 'Revenue attribution model with cancellation-review correlation weighting',
    };
  }

  return {
    weights: [
      { signal: 'Primary indicator', weight: 50, dataPoints: 20 },
      { signal: 'Secondary indicator', weight: 30, dataPoints: 15 },
      { signal: 'Supporting signal', weight: 20, dataPoints: 10 },
    ],
    finalConfidence: Math.round(risk.confidence * 100),
    totalDataPoints: 45,
    methodology: 'Multi-signal threshold analysis',
  };
}

module.exports = {
  getInvestigationTimeline,
  getForecast,
  getAutonomousActions,
  getAgentMemory,
  getHiddenCorrelation,
  getExecutiveAssessment,
  getBusinessImpact,
  // V3
  getImpactCalculation,
  getHypotheses,
  getConfidenceEvolution,
  getDecisionSupport,
  // V4
  getEvidenceWeighting,
};
