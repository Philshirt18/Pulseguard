/**
 * PulseGuard MCP Server
 * 
 * Exposes PulseGuard's risk intelligence as MCP tools.
 * Any MCP-compatible AI agent (Claude, Cursor, custom agents) can:
 * - Query active risks
 * - Investigate specific risks
 * - Get root cause analysis
 * - Get strategic recommendations
 * - Access forecast predictions
 * 
 * This makes PulseGuard a data source for the broader AI ecosystem.
 */

const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const { z } = require('zod');

const riskDetector = require('../engine/riskDetector');
const { getInvestigationTimeline, getForecast, getAutonomousActions, getHiddenCorrelation, getExecutiveAssessment, getBusinessImpact, getImpactCalculation, getHypotheses, getEvidenceWeighting, getDecisionSupport } = require('../engine/agentIntelligence');

// Create MCP server
const server = new McpServer({
  name: 'pulseguard',
  version: '1.0.0',
  description: 'PulseGuard — The Organizational Early Warning System. Discovers operational crises before humans recognize them.',
});

// ==========================================
// TOOL: Get Executive Summary
// ==========================================
server.tool(
  'get_executive_summary',
  'Get the current PulseGuard executive intelligence brief with all active risks, severity levels, and business impact.',
  {},
  async () => {
    const risks = riskDetector.analyzeAll();
    const topRisk = risks[0];
    const assessment = topRisk ? getExecutiveAssessment(topRisk) : null;
    const impact = topRisk ? getBusinessImpact(topRisk) : null;

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          status: 'critical',
          totalRisks: risks.length,
          criticalRisks: risks.filter(r => r.severity === 'critical').length,
          topRisk: topRisk ? {
            id: topRisk.id,
            title: topRisk.title,
            region: topRisk.region,
            confidence: Math.round(topRisk.confidence * 100),
            type: topRisk.type,
          } : null,
          assessment: assessment,
          businessImpact: impact,
          allRisks: risks.map(r => ({
            id: r.id,
            title: r.title,
            severity: r.severity,
            confidence: Math.round(r.confidence * 100),
            region: r.region,
            type: r.type,
          })),
        }, null, 2),
      }],
    };
  }
);

// ==========================================
// TOOL: Investigate Risk
// ==========================================
server.tool(
  'investigate_risk',
  'Perform a deep investigation on a specific risk. Returns root cause, investigation timeline, hypotheses evaluated, evidence weighting, impact calculation, and hidden correlations.',
  {
    risk_id: z.string().describe('The risk ID to investigate (e.g., risk-ops-ven-001)'),
  },
  async ({ risk_id }) => {
    riskDetector.analyzeAll();
    const risk = riskDetector.getRiskById(risk_id);

    if (!risk) {
      const allRisks = riskDetector.getRisksSorted();
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            error: `Risk "${risk_id}" not found`,
            availableRisks: allRisks.map(r => ({ id: r.id, title: r.title })),
          }, null, 2),
        }],
      };
    }

    const timeline = getInvestigationTimeline(risk);
    const hypotheses = getHypotheses(risk);
    const evidence = getEvidenceWeighting(risk);
    const impactCalc = getImpactCalculation(risk);
    const correlation = getHiddenCorrelation(risk);
    const assessment = getExecutiveAssessment(risk);

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          risk: {
            id: risk.id,
            title: risk.title,
            severity: risk.severity,
            confidence: Math.round(risk.confidence * 100),
            region: risk.region,
          },
          assessment,
          investigationTimeline: timeline,
          hypothesesEvaluated: hypotheses,
          evidenceWeighting: evidence,
          impactCalculation: impactCalc,
          hiddenCorrelation: correlation,
        }, null, 2),
      }],
    };
  }
);

// ==========================================
// TOOL: Get Recommendations
// ==========================================
server.tool(
  'get_recommendations',
  'Get strategic decision support and recommendations for a specific risk, including options analysis and forecast.',
  {
    risk_id: z.string().describe('The risk ID to get recommendations for'),
  },
  async ({ risk_id }) => {
    riskDetector.analyzeAll();
    const risk = riskDetector.getRiskById(risk_id);

    if (!risk) {
      return {
        content: [{ type: 'text', text: JSON.stringify({ error: `Risk "${risk_id}" not found` }) }],
      };
    }

    const decision = getDecisionSupport(risk);
    const forecast = getForecast(risk);
    const actions = getAutonomousActions(risk);

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          risk: { id: risk.id, title: risk.title, severity: risk.severity },
          strategicOptions: decision,
          forecast,
          autonomousActionsTaken: actions,
        }, null, 2),
      }],
    };
  }
);

// ==========================================
// TOOL: Get Risk Forecast
// ==========================================
server.tool(
  'get_forecast',
  'Get predictive forecast for a risk — what happens in 7, 30, and 60 days if no action is taken.',
  {
    risk_id: z.string().describe('The risk ID to forecast'),
  },
  async ({ risk_id }) => {
    riskDetector.analyzeAll();
    const risk = riskDetector.getRiskById(risk_id);

    if (!risk) {
      return {
        content: [{ type: 'text', text: JSON.stringify({ error: `Risk "${risk_id}" not found` }) }],
      };
    }

    const forecast = getForecast(risk);
    return {
      content: [{ type: 'text', text: JSON.stringify({ risk: { id: risk.id, title: risk.title }, forecast }, null, 2) }],
    };
  }
);

// ==========================================
// TOOL: List All Risks
// ==========================================
server.tool(
  'list_risks',
  'List all currently detected operational risks with severity and confidence scores.',
  {},
  async () => {
    const risks = riskDetector.analyzeAll();
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          totalRisks: risks.length,
          risks: risks.map(r => ({
            id: r.id,
            title: r.title,
            severity: r.severity,
            confidence: Math.round(r.confidence * 100),
            region: r.region,
            type: r.type,
            severityScore: Math.round(r.severityScore),
          })),
        }, null, 2),
      }],
    };
  }
);

// ==========================================
// START SERVER
// ==========================================

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('PulseGuard MCP Server running on stdio');
}

main().catch(console.error);
