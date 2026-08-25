/**
 * PulseGuard MCP Server — Vercel Serverless Function
 *
 * Stateless MCP over HTTP using the Streamable HTTP transport.
 * Each request creates a fresh McpServer + transport instance.
 * No in-memory session state — compatible with Vercel's serverless model.
 *
 * Endpoint: POST /mcp  — MCP requests
 *           GET  /mcp  — health check
 */

require('dotenv').config();

const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { StreamableHTTPServerTransport } = require('@modelcontextprotocol/sdk/server/streamableHttp.js');
const { registerTools } = require('../src/mcp/tools');
const logger = require('../src/services/logger');

function createMcpServer() {
  const server = new McpServer({
    name: 'pulseguard',
    version: '1.0.0',
    description: 'PulseGuard — The Organizational Early Warning System.',
  });
  registerTools(server);
  return server;
}

async function handler(req, res) {
  // Parse JSON body manually — Vercel does not pre-parse for raw handlers
  async function readBody() {
    return new Promise((resolve) => {
      let data = '';
      req.on('data', (chunk) => { data += chunk; });
      req.on('end', () => {
        try { resolve(data ? JSON.parse(data) : undefined); }
        catch { resolve(undefined); }
      });
      req.on('error', () => resolve(undefined));
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

  req.body = await readBody();

  try {
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined, // stateless
    });
    const mcpServer = createMcpServer();
    await mcpServer.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (err) {
    logger.error('MCP serverless handler error', { error: err.message });
    if (!res.headersSent) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Internal server error' }));
    }
  }
}

module.exports = handler;
