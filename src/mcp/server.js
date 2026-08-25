/**
 * PulseGuard MCP Server — Local HTTP Transport
 *
 * Runs as a persistent Express server for local development and
 * non-serverless deployments. Uses the Streamable HTTP transport
 * (MCP spec 2025-03-26) with optional stateful sessions.
 *
 * Endpoint: POST /mcp   — stateless or session-based MCP requests
 *           GET  /mcp   — SSE stream (stateful sessions)
 *           DELETE /mcp — terminate a session
 *           GET  /health — liveness check
 *
 * Start: node src/mcp/server.js
 * Port:  MCP_PORT env var (default: 3001)
 */

require('dotenv').config();

const express = require('express');
const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { StreamableHTTPServerTransport } = require('@modelcontextprotocol/sdk/server/streamableHttp.js');
const { registerTools } = require('./tools');
const logger = require('../services/logger');

// ---------------------------------------------------------------------------
// MCP server factory — one instance per session (stateful) or per request (stateless)
// ---------------------------------------------------------------------------

function createMcpServer() {
  const server = new McpServer({
    name: 'pulseguard',
    version: '1.0.0',
    description: 'PulseGuard — The Organizational Early Warning System. Discovers operational crises before humans recognize them.',
  });

  registerTools(server);
  return server;
}

// ---------------------------------------------------------------------------
// Express app
// ---------------------------------------------------------------------------

const app = express();
app.use(express.json());

// Session store for stateful connections (sessionId → transport)
const sessions = new Map();

app.all('/mcp', async (req, res) => {
  const sessionId = req.headers['mcp-session-id'];

  try {
    if (req.method === 'POST') {
      if (sessionId && sessions.has(sessionId)) {
        const { transport } = sessions.get(sessionId);
        await transport.handleRequest(req, res, req.body);
        return;
      }

      const isInitialize = req.body?.method === 'initialize' || Array.isArray(req.body);

      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: isInitialize ? () => require('crypto').randomUUID() : undefined,
        onsessioninitialized: (id) => {
          sessions.set(id, { transport, server: mcpServer });
          logger.info('MCP session opened', { sessionId: id });
        },
      });

      const mcpServer = createMcpServer();

      transport.onclose = () => {
        if (transport.sessionId) {
          sessions.delete(transport.sessionId);
          logger.info('MCP session closed', { sessionId: transport.sessionId });
        }
      };

      await mcpServer.connect(transport);
      await transport.handleRequest(req, res, req.body);
      return;
    }

    if (req.method === 'GET') {
      if (!sessionId || !sessions.has(sessionId)) {
        res.status(400).json({ error: 'Missing or unknown Mcp-Session-Id' });
        return;
      }
      const { transport } = sessions.get(sessionId);
      await transport.handleRequest(req, res);
      return;
    }

    if (req.method === 'DELETE') {
      if (!sessionId || !sessions.has(sessionId)) {
        res.status(404).json({ error: 'Session not found' });
        return;
      }
      const { transport } = sessions.get(sessionId);
      await transport.handleRequest(req, res);
      sessions.delete(sessionId);
      logger.info('MCP session deleted', { sessionId });
      return;
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    logger.error('MCP request error', { error: err.message });
    if (!res.headersSent) {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
});

app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'pulseguard-mcp',
    sessions: sessions.size,
    uptime: Math.round(process.uptime()),
  });
});

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

const PORT = process.env.MCP_PORT || 3001;

app.listen(PORT, () => {
  logger.info('PulseGuard MCP Server started', {
    port: PORT,
    endpoint: `http://localhost:${PORT}/mcp`,
    health: `http://localhost:${PORT}/health`,
  });
  console.log(`\n  🛡️  PulseGuard MCP Server\n  ✅ http://localhost:${PORT}/mcp\n  ✅ http://localhost:${PORT}/health\n`);
});
