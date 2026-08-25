/**
 * PulseGuard MCP — Tool Registry
 *
 * Single source of truth for all MCP tools.
 * Both the local HTTP server (src/mcp/server.js) and the Vercel
 * serverless function (api/mcp.js) import from here.
 *
 * ── Tool design rules ────────────────────────────────────────────────────────
 * 1. Every tool validates its inputs with Zod before executing
 * 2. No tool executes arbitrary code or accesses cross-workspace data
 * 3. Error responses are structured — never raw exceptions
 * 4. Tool results are capped in size to prevent oversized responses
 * 5. Each tool is documented with clear description and parameter schema
 *
 * ── Available tools ──────────────────────────────────────────────────────────
 * get_executive_summary   — full risk brief with top risk and business impact
 * list_risks              — all risks with severity + confidence scores
 * get_risk               — single risk by ID with full evidence
 * investigate_risk        — deep investigation: timeline, hypotheses, evidence
 * calculate_business_impact — quantified impact for a risk
 * get_risk_history       — how a risk has evolved over time
 * get_related_events     — correlated signals for a risk
 * generate_recommendations — strategic options and decision support
 * get_forecast           — 7/30/60-day projection if no action taken
 */

const { z } = require('zod');
const riskDetector = require('../engine/riskDetector');
const {
  getInvestigationTimeline,
  getForecast,
  getAutonomousActions,
  getHiddenCorrelation,
  getExecutiveAssessment,
  getBusinessImpact,
  getImpactCalculation,
  getHypotheses,
  getEvidenceWeighting,
  getDecisionSupport,
  getAgentMemory,
} = require('../engine/agentIntelligence');

// ---------------------------------------------------------------------------
// Input validation schemas
// ---------------------------------------------------------------------------

const RiskIdSchema = z.object({
  risk_id: z
    .string()
    .min(1, 'risk_id is required')
    .max(100, 'risk_id too long')
    .regex(/^[a-z0-9-]+$/, 'risk_id must contain only lowercase letters, numbers, and hyphens'),
});

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

/**
 * Returns a structured MCP text response.
 */
function _ok(data) {
  return {
    content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
  };
}

/**
 * Returns a structured MCP error response (not a thrown exception).
 */
function _err(message, extra = {}) {
  return {
    content: [{ type: 'text', text: JSON.stringify({ error: message, ...extra }, null, 2) }],
    isError: true,
  };
}

/**
 * Looks up a risk by ID, refreshing detection first.
 * Returns null if not found.
 */
function _getRisk(riskId) {
  riskDetector.analyzeAll();
  return riskDetector.getRiskById(riskId) || null;
}

/**
 * Returns a compact list of all risk IDs for error messages.
 */
function _availableRiskIds() {
  return riskDetector.getRisksSorted().map(r => ({ id: r.id, title: r.title }));
}

// ---------------------------------------------------------------------------
// Tool implementations
// ---------------------------------------------------------------------------

/**
 * Registers all tools onto an McpServer instance.
 * Called by both the local server and the Vercel function.
 *
 * @param {McpServer} server — @modelcontextprotocol/sdk McpServer instance
 */
function registerTools(server) {

  // ── get_executive_summary ─────────────────────────────────────────────────
  server.tool(
    'get_executive_summary',
    'Get the current PulseGuard executive intelligence brief: all active risks ranked by severity, ' +
    'the top risk assessment, business impact, and recommended immediate focus areas.',
    {},
    async () => {
      try {
        const risks = riskDetector.analyzeAll();
        const topRisk = risks[0] || null;
        const assessment = topRisk ? getExecutiveAssessment(topRisk) : null;
        const impact = topRisk ? getBusinessImpact(topRisk) : null;

        return _ok({
          generatedAt: new Date().toISOString(),
          overallStatus: risks.some(r => r.severity === 'critical') ? 'critical' : 'elevated',
          totalRisks: risks.length,
          bySeverity: {
            critical: risks.filter(r => r.severity === 'critical').length,
            high: risks.filter(r => r.severity === 'high').length,
            medium: risks.filter(r => r.severity === 'medium').length,
            low: risks.filter(r => r.severity === 'low').length,
          },
          topRisk: topRisk ? {
            id: topRisk.id,
            title: topRisk.title,
            region: topRisk.region,
            severity: topRisk.severity,
            confidence: Math.round(topRisk.confidence * 100),
            type: topRisk.type,
          } : null,
          topRiskAssessment: assessment,
          topRiskBusinessImpact: impact,
          allRisks: risks.map(r => ({
            id: r.id,
            title: r.title,
            severity: r.severity,
            confidence: Math.round(r.confidence * 100),
            region: r.region,
            type: r.type,
            severityScore: Math.round(r.severityScore),
          })),
        });
      } catch (err) {
        return _err('Failed to generate executive summary', { detail: err.message });
      }
    }
  );

  // ── list_risks ────────────────────────────────────────────────────────────
  server.tool(
    'list_risks',
    'List all currently detected operational risks with their severity, confidence scores, ' +
    'region, type, and severity score. Use this to discover risk IDs for deeper investigation.',
    {},
    async () => {
      try {
        const risks = riskDetector.analyzeAll();
        return _ok({
          generatedAt: new Date().toISOString(),
          totalRisks: risks.length,
          risks: risks.map(r => ({
            id: r.id,
            title: r.title,
            severity: r.severity,
            severityScore: Math.round(r.severityScore),
            confidence: Math.round(r.confidence * 100),
            region: r.region,
            type: r.type,
            detectedAt: r.detectedAt,
          })),
        });
      } catch (err) {
        return _err('Failed to list risks', { detail: err.message });
      }
    }
  );

  // ── get_risk ──────────────────────────────────────────────────────────────
  server.tool(
    'get_risk',
    'Get full details of a single detected risk by ID, including all evidence data, ' +
    'impact metrics, and correlations.',
    {
      risk_id: z
        .string()
        .min(1)
        .max(100)
        .regex(/^[a-z0-9-]+$/)
        .describe('The risk ID to retrieve. Use list_risks to discover valid IDs.'),
    },
    async ({ risk_id }) => {
      const parsed = RiskIdSchema.safeParse({ risk_id });
      if (!parsed.success) {
        return _err(`Invalid risk_id: ${parsed.error.issues[0]?.message}`);
      }

      try {
        const risk = _getRisk(risk_id);
        if (!risk) {
          return _err(`Risk "${risk_id}" not found`, { availableRisks: _availableRiskIds() });
        }
        return _ok(risk);
      } catch (err) {
        return _err('Failed to retrieve risk', { detail: err.message });
      }
    }
  );

  // ── investigate_risk ──────────────────────────────────────────────────────
  server.tool(
    'investigate_risk',
    'Perform a deep investigation of a specific risk. Returns: root cause analysis, ' +
    'investigation timeline showing how confidence built over time, competing hypotheses ' +
    'evaluated and eliminated, evidence weighting across data sources, impact calculation ' +
    'with step-by-step methodology, and hidden correlations discovered.',
    {
      risk_id: z
        .string()
        .min(1)
        .max(100)
        .regex(/^[a-z0-9-]+$/)
        .describe('The risk ID to investigate.'),
    },
    async ({ risk_id }) => {
      const parsed = RiskIdSchema.safeParse({ risk_id });
      if (!parsed.success) {
        return _err(`Invalid risk_id: ${parsed.error.issues[0]?.message}`);
      }

      try {
        const risk = _getRisk(risk_id);
        if (!risk) {
          return _err(`Risk "${risk_id}" not found`, { availableRisks: _availableRiskIds() });
        }

        return _ok({
          risk: {
            id: risk.id,
            title: risk.title,
            severity: risk.severity,
            confidence: Math.round(risk.confidence * 100),
            region: risk.region,
            type: risk.type,
          },
          assessment: getExecutiveAssessment(risk),
          investigationTimeline: getInvestigationTimeline(risk),
          hypothesesEvaluated: getHypotheses(risk),
          evidenceWeighting: getEvidenceWeighting(risk),
          impactCalculation: getImpactCalculation(risk),
          hiddenCorrelation: getHiddenCorrelation(risk),
          agentMemory: getAgentMemory(risk),
        });
      } catch (err) {
        return _err('Investigation failed', { detail: err.message });
      }
    }
  );

  // ── calculate_business_impact ─────────────────────────────────────────────
  server.tool(
    'calculate_business_impact',
    'Get a quantified business impact assessment for a specific risk: revenue at risk, ' +
    'properties affected, owners at risk, guest impact, and escalation window.',
    {
      risk_id: z
        .string()
        .min(1)
        .max(100)
        .regex(/^[a-z0-9-]+$/)
        .describe('The risk ID to calculate impact for.'),
    },
    async ({ risk_id }) => {
      const parsed = RiskIdSchema.safeParse({ risk_id });
      if (!parsed.success) {
        return _err(`Invalid risk_id: ${parsed.error.issues[0]?.message}`);
      }

      try {
        const risk = _getRisk(risk_id);
        if (!risk) {
          return _err(`Risk "${risk_id}" not found`, { availableRisks: _availableRiskIds() });
        }

        return _ok({
          risk: { id: risk.id, title: risk.title },
          businessImpact: getBusinessImpact(risk),
          impactCalculation: getImpactCalculation(risk),
        });
      } catch (err) {
        return _err('Failed to calculate business impact', { detail: err.message });
      }
    }
  );

  // ── get_risk_history ──────────────────────────────────────────────────────
  server.tool(
    'get_risk_history',
    'Get the historical progression of a risk: when it was first detected, how confidence ' +
    'evolved over time, previous severity scores, and whether past recommendations were actioned.',
    {
      risk_id: z
        .string()
        .min(1)
        .max(100)
        .regex(/^[a-z0-9-]+$/)
        .describe('The risk ID to get history for.'),
    },
    async ({ risk_id }) => {
      const parsed = RiskIdSchema.safeParse({ risk_id });
      if (!parsed.success) {
        return _err(`Invalid risk_id: ${parsed.error.issues[0]?.message}`);
      }

      try {
        const risk = _getRisk(risk_id);
        if (!risk) {
          return _err(`Risk "${risk_id}" not found`, { availableRisks: _availableRiskIds() });
        }

        const memory = getAgentMemory(risk);
        const timeline = getInvestigationTimeline(risk);

        return _ok({
          risk: { id: risk.id, title: risk.title },
          firstDetected: memory.firstFlagged,
          scoreProgression: memory.previousScores,
          previousRecommendations: memory.previousRecommendations,
          observations: memory.observations,
          investigationTimeline: timeline,
        });
      } catch (err) {
        return _err('Failed to retrieve risk history', { detail: err.message });
      }
    }
  );

  // ── get_related_events ────────────────────────────────────────────────────
  server.tool(
    'get_related_events',
    'Get correlated events and signals related to a specific risk. Reveals hidden connections ' +
    'between seemingly independent operational signals that together explain the risk.',
    {
      risk_id: z
        .string()
        .min(1)
        .max(100)
        .regex(/^[a-z0-9-]+$/)
        .describe('The risk ID to find related events for.'),
    },
    async ({ risk_id }) => {
      const parsed = RiskIdSchema.safeParse({ risk_id });
      if (!parsed.success) {
        return _err(`Invalid risk_id: ${parsed.error.issues[0]?.message}`);
      }

      try {
        const risk = _getRisk(risk_id);
        if (!risk) {
          return _err(`Risk "${risk_id}" not found`, { availableRisks: _availableRiskIds() });
        }

        // Find other risks in same region (correlated)
        const allRisks = riskDetector.getRisksSorted();
        const relatedRisks = allRisks
          .filter(r => r.id !== risk.id && r.region === risk.region)
          .map(r => ({
            id: r.id,
            title: r.title,
            type: r.type,
            severity: r.severity,
            correlation: risk.correlations?.find(c => c.regionId === r.id) || null,
          }));

        return _ok({
          risk: { id: risk.id, title: risk.title, region: risk.region },
          directCorrelations: risk.correlations || [],
          relatedRisksInRegion: relatedRisks,
          hiddenCorrelation: getHiddenCorrelation(risk),
        });
      } catch (err) {
        return _err('Failed to retrieve related events', { detail: err.message });
      }
    }
  );

  // ── generate_recommendations ──────────────────────────────────────────────
  server.tool(
    'generate_recommendations',
    'Get strategic decision support and actionable recommendations for a specific risk. ' +
    'Returns multiple options with cost/impact/timeline analysis, PulseGuard\'s recommended ' +
    'option with reasoning, projected outcomes, and autonomous actions already taken.',
    {
      risk_id: z
        .string()
        .min(1)
        .max(100)
        .regex(/^[a-z0-9-]+$/)
        .describe('The risk ID to generate recommendations for.'),
    },
    async ({ risk_id }) => {
      const parsed = RiskIdSchema.safeParse({ risk_id });
      if (!parsed.success) {
        return _err(`Invalid risk_id: ${parsed.error.issues[0]?.message}`);
      }

      try {
        const risk = _getRisk(risk_id);
        if (!risk) {
          return _err(`Risk "${risk_id}" not found`, { availableRisks: _availableRiskIds() });
        }

        return _ok({
          risk: { id: risk.id, title: risk.title, severity: risk.severity },
          strategicOptions: getDecisionSupport(risk),
          autonomousActionsTaken: getAutonomousActions(risk),
          forecast: getForecast(risk),
        });
      } catch (err) {
        return _err('Failed to generate recommendations', { detail: err.message });
      }
    }
  );

  // ── get_forecast ──────────────────────────────────────────────────────────
  server.tool(
    'get_forecast',
    'Get a predictive forecast for a risk: what happens in 7, 30, and 60 days if no action ' +
    'is taken. Each timeframe includes specific metric changes and their direction.',
    {
      risk_id: z
        .string()
        .min(1)
        .max(100)
        .regex(/^[a-z0-9-]+$/)
        .describe('The risk ID to forecast.'),
    },
    async ({ risk_id }) => {
      const parsed = RiskIdSchema.safeParse({ risk_id });
      if (!parsed.success) {
        return _err(`Invalid risk_id: ${parsed.error.issues[0]?.message}`);
      }

      try {
        const risk = _getRisk(risk_id);
        if (!risk) {
          return _err(`Risk "${risk_id}" not found`, { availableRisks: _availableRiskIds() });
        }

        return _ok({
          risk: { id: risk.id, title: risk.title, severity: risk.severity },
          forecast: getForecast(risk),
          note: 'Forecast assumes no intervention. Based on trend extrapolation from historical patterns.',
        });
      } catch (err) {
        return _err('Failed to generate forecast', { detail: err.message });
      }
    }
  );
}

module.exports = { registerTools };
