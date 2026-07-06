/**
 * PulseGuard MCP Server — Vercel Serverless Function
 *
 * Stateless MCP over HTTP using the Streamable HTTP transport.
 * Each request is handled independently (no in-memory session state),
 * which is compatible with Vercel's serverless execution model.
 *
 * Endpoint: POST /mcp
 */

require('dotenv').config();

const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { StreamableHTTPServerTransport } = require('@modelcontextprotocol/sdk/server/streamableHttp.js');
const { z } = require('zod');

const riskDetector = require('../src/engine/riskDetector');
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
} = require('../src/engine/agentIntelligence');

// ==========================================
// MCP SERVER FACTORY
// A fresh McpServer is created per request (stateless mode).
// ==========================================

function createMcpServer() {
  const server = new McpServer({
    name: 'pulseguard',
    version: '1.0.0',
    description:
      'PulseGuard — The Organizational Early Warning System. Discovers operational crises before humans recognize them.',
  });

  // ──────────────────────────────────────────
  // TOOL: Get Executive Summary
  // ──────────────────────────────────────────
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
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                status: 'critical',
                totalRisks: risks.length,
                criticalRisks: risks.filter((r) => r.severity === 'critical').length,
                topRisk: topRisk
                  ? {
                      id: topRisk.id,
                      title: topRisk.title,
                      region: topRisk.region,
                      confidence: Math.round(topRisk.confidence * 100),
                      type: topRisk.type,
                    }
                  : null,
                assessment,
                businessImpact: impact,
                allRisks: risks.map((r) => ({
                  id: r.id,
                  title: r.title,
                  severity: r.severity,
                  confidence: Math.round(r.confidence * 100),
                  region: r.region,
                  type: r.type,
                })),
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );

  // ──────────────────────────────────────────
  // TOOL: Investigate Risk
  // ──────────────────────────────────────────
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
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  error: `Risk "${risk_id}" not found`,
                  availableRisks: allRisks.map((r) => ({ id: r.id, title: r.title })),
                },
                null,
                2
              ),
            },
          ],
        };
      }

      const timeline = getInvestigationTimeline(risk);
      const hypotheses = getHypotheses(risk);
      const evidence = getEvidenceWeighting(risk);
      const impactCalc = getImpactCalculation(risk);
      const correlation = getHiddenCorrelation(risk);
      const assessment = getExecutiveAssessment(risk);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
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
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );

  // ──────────────────────────────────────────
  // TOOL: Get Recommendations
  // ──────────────────────────────────────────
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
          content: [
            { type: 'text', text: JSON.stringify({ error: `Risk "${risk_id}" not found` }) },
          ],
        };
      }

      const decision = getDecisionSupport(risk);
      const forecast = getForecast(risk);
      const actions = getAutonomousActions(risk);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                risk: { id: risk.id, title: risk.title, severity: risk.severity },
                strategicOptions: decision,
                forecast,
                autonomousActionsTaken: actions,
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );

  // ──────────────────────────────────────────
  // TOOL: Get Risk Forecast
  // ──────────────────────────────────────────
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
          content: [
            { type: 'text', text: JSON.stringify({ error: `Risk "${risk_id}" not found` }) },
          ],
        };
      }

      const forecast = getForecast(risk);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ risk: { id: risk.id, title: risk.title }, forecast }, null, 2),
          },
        ],
      };
    }
  );

  // ──────────────────────────────────────────
  // TOOL: List All Risks
  // ──────────────────────────────────────────
  server.tool(
    'list_risks',
    'List all currently detected operational risks with severity and confidence scores.',
    {},
    async () => {
      const risks = riskDetector.analyzeAll();
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                totalRisks: risks.length,
                risks: risks.map((r) => ({
                  id: r.id,
                  title: r.title,
                  severity: r.severity,
                  confidence: Math.round(r.confidence * 100),
                  region: r.region,
                  type: r.type,
                  severityScore: Math.round(r.severityScore),
                })),
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );

  return server;
}

// ==========================================
// REQUEST HANDLER (exported for Vercel)
// Plain Node.js handler — no Express, no path-to-regexp.
// ==========================================

async function handler(req, res) {
  // Parse JSON body manually (Vercel does not pre-parse it)
  async function readBody() {
    return new Promise((resolve, reject) => {
      let data = '';
      req.on('data', (chunk) => { data += chunk; });
      req.on('end', () => {
        try { resolve(data ? JSON.parse(data) : undefined); }
        catch { resolve(undefined); }
      });
      req.on('error', reject);
    });
  }

  // Health check
  if (req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', service: 'pulseguard-mcp' }));
    return;
  }

  if (req.method !== 'POST') {
    res.writeHead(405, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Method not allowed' }));
    return;
  }

  // Attach parsed body to req so StreamableHTTPServerTransport can use it
  req.body = await readBody();

  try {
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined, // stateless
    });
    const mcpServer = createMcpServer();
    await mcpServer.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (err) {
    console.error('MCP error:', err);
    if (!res.headersSent) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Internal server error' }));
    }
  }
}

module.exports = handler;
