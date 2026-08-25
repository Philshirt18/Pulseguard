# PulseGuard AI — Engineering Case Study

## 1. Problem

Most business monitoring tools are reactive. They alert you when a metric crosses a threshold you already knew to watch. They require someone to ask the right question at the right time.

PulseGuard was built to answer a different question: **what problems exist that nobody is looking for yet?**

The target scenario: a vacation rental company with 15,000 properties across 7 regions and hundreds of operational vendors. Support tickets come in. Reviews get posted. Maintenance requests are filed. Each signal is visible in isolation — but the connection between a single vendor's performance collapse and a downstream owner churn crisis three weeks later is invisible unless you correlate dozens of data streams simultaneously.

The engineering challenge: build a system that detects those connections deterministically, then uses AI to explain, investigate, and recommend — without creating uncontrolled AI costs or mixing one customer's data with another's.

---

## 2. Architecture

```
Raw operational data (support tickets, reviews, bookings, vendors, owners)
    ↓
Deterministic Risk Engine (riskDetector.js)
    - Spike detection, trend analysis, threshold comparison
    - Correlation analysis across data sources
    - Outputs: typed Risk objects with severity scores and evidence
    ↓
Risk objects
    ↓
AI Narrative Layer (aiNarrative.js)            AI Investigation Agent (investigationAgent.js)
    - gpt-4o-mini for prose generation              - Tool-using OpenAI agent
    - Workspace-scoped, billing-gated               - Calls data tools to gather evidence
    - Cached, fallback-safe                         - Synthesises structured investigation report
    ↓                                               ↓
Slack presentation (blocks.js, commands.js)
    - Slash commands + interactive buttons
    - Human approval flow for high-impact actions
    ↓
MCP Server (tools.js → api/mcp.js)
    - Exposes risk intelligence to external AI agents
    - Validated, documented, whitelist-only tools
```

---

## 3. Why Deterministic Detection + LLM Reasoning

The split between deterministic detection and AI explanation was a deliberate architectural decision.

**Why not use an LLM for detection?**

- LLMs hallucinate numbers. A deterministic engine never claims a 256% complaint spike unless the data actually shows it.
- LLMs are expensive. Running GPT-4 against 1,677 operational signals on every request would cost ~$0.50/call.
- LLMs are slow. Threshold analysis runs in milliseconds. LLM calls take 1-3 seconds — too slow for Slack's 3-second response window.
- Deterministic scores are auditable. You can point to exactly which data caused the risk score.

**Why use an LLM at all?**

- Humans don't read JSON. Converting evidence arrays into an executive narrative requires language, and language is what LLMs do well.
- Correlation explanation is non-trivial. "Vendor A's performance correlates at r=0.87 with complaint spikes" is a data point. "This is why your €234K refund problem exists" is an insight.
- AI investigation can follow threads. The `investigationAgent` uses function calling to query whichever data sources are relevant to a specific risk type — it doesn't follow a hardcoded script.

The key constraint: **AI is used only for presentation and investigation, never for scoring**. This keeps costs linear with user actions rather than per-request.

---

## 4. MCP Implementation

PulseGuard exposes its risk intelligence via the Model Context Protocol (MCP), making it accessible as a data source to any MCP-compatible AI agent.

The implementation uses `@modelcontextprotocol/sdk` with the Streamable HTTP transport (MCP spec 2025-03-26).

**Design decisions:**

- **Shared tool registry** (`src/mcp/tools.js`): Both the local Express server and the Vercel serverless function import from the same file. No duplication.
- **Stateless on Vercel**: Serverless functions have no persistent state. The Vercel function operates in stateless mode (no session ID), which is valid per the MCP spec.
- **Stateful locally**: The local development server supports stateful sessions with in-memory session tracking.
- **Input validation**: Every tool validates its arguments with Zod before executing. Invalid inputs return structured error responses, not thrown exceptions.
- **Structured errors**: Tools never throw — they return `{ error: "...", isError: true }` responses.

**Tools exposed:**

`get_executive_summary`, `list_risks`, `get_risk`, `investigate_risk`, `calculate_business_impact`, `get_risk_history`, `get_related_events`, `generate_recommendations`, `get_forecast`

---

## 5. Slack Integration

The Slack integration uses `@slack/bolt` with `ExpressReceiver` deployed as a Vercel serverless function.

**Multi-workspace OAuth:** `ExpressReceiver` handles the install flow automatically when `clientId`, `clientSecret`, and `installationStore` are provided. The token for each workspace is resolved on every incoming request via `fetchInstallation()`.

**Serverless challenge:** Vercel cold-starts lose in-memory state. The `installationStore` mitigates this by re-seeding the primary workspace token from environment variables on every `fetchInstallation()` call.

**Interactive components:** The Block Kit UI uses buttons with action IDs that encode risk IDs. Handlers are registered with regex patterns (`/why_risk_(.+)/`) rather than exact strings, so any risk ID works without pre-registration.

**Human approval flow:** High-impact recommendations (critical/high severity) include an approval card with a Slack confirmation dialog. Approvals and rejections are logged with workspace ID, user ID, and timestamp.

---

## 6. AI Cost Management

Key decisions:

1. **gpt-4o-mini over gpt-4**: 97% cost reduction with acceptable quality loss for narrative generation.
2. **Plan limits enforced before the API call**: If a workspace is over its monthly limit, `checkLimit()` returns `false` and the OpenAI call never happens.
3. **Per-workspace caching**: Repeated requests within 10 minutes are served from cache. Cache hits don't count against the plan limit.
4. **Token cap per call**: `max_tokens` is set on every completion request. Runaway responses are impossible.
5. **Input truncation**: Risk JSON is capped at 2,000 characters before being included in prompts.
6. **Demo mode**: `DEMO_MODE=true` bypasses OpenAI entirely. Used for development, testing, and Slack review.

Usage is tracked per workspace per month with token counts and cost estimates, enabling billing decisions based on real consumption data.

---

## 7. Security

The main security concerns for a multi-tenant Slack app:

- **Request authenticity**: Every Slack request is verified via HMAC-SHA256 signature before any processing occurs.
- **Tenant isolation**: Each workspace's token is stored under a unique key. No workspace can retrieve another's token.
- **Prompt injection**: External content is field-whitelisted, truncated, and pattern-stripped before reaching OpenAI. System instructions are structurally separated from data.
- **Secret management**: All credentials are environment variables. The `.env` file is `.gitignore`d. Tokens are never logged.

Known gaps acknowledged: no application-level rate limiting, MCP endpoint unauthenticated, token persistence relies on in-memory store with env-var fallback rather than a true database.

---

## 8. Multi-Tenancy

Multi-tenancy in PulseGuard is currently **logical** rather than **physical**:

- Each workspace gets its own installation record (Slack token)
- Each workspace has its own usage tracking and billing subscription
- Risk data is currently shared demo data — there is no per-workspace data isolation

For a real deployment, the data model would need to change:

```
workspace_id → { installation, subscription, data_sources, risk_cache }
```

Each workspace's data would be stored separately and the `riskDetector` would be instantiated with workspace-specific data rather than the shared `mockData` module. The engine itself supports this — it just needs per-workspace data as input.

---

## 9. Challenges

**Slack's 3-second response window:** Slack slash commands require an acknowledgement within 3 seconds or they show an error. OpenAI calls take 1-3 seconds. Solution: `ack()` immediately, then use `respond()` (which uses the `response_url` for delayed responses) for the actual content. This is already how Bolt works with `processBeforeResponse: true`.

**Serverless state loss:** Vercel cold-starts lose all in-memory data. The installation store mitigation (env-var seeding on every fetch) covers the primary workspace but not newly-installed workspaces. Acknowledged limitation — requires a persistent store to fully solve.

**Express 5 + `path-to-regexp`:** Upgrading to Express 5 broke `app.all('*')` patterns used in middleware. The MCP serverless function was rewritten as a plain Node.js handler to avoid the Express router entirely.

**Demo data vs. production architecture:** The hackathon origin means the app has very specific demo data baked into its fallback responses. This was retained (clearly labelled `_demo: true`) but isolated from the production AI path, which now generates workspace-agnostic narratives.

---

## 10. What I Would Improve Next

In priority order:

1. **Persistent installation store** — swap the in-memory Map for Vercel KV or Upstash Redis. Single biggest production blocker.

2. **Per-workspace data model** — let each workspace connect their own data sources (e.g. Zendesk, Intercom, Stripe) rather than using demo data. The risk engine is already data-agnostic.

3. **MCP authentication** — add API key requirement to the `/mcp` endpoint. Currently unauthenticated.

4. **Rate limiting** — per-workspace and per-IP rate limits on slash commands and MCP endpoint.

5. **Audit log persistence** — store approval/rejection decisions in a database rather than just logging to stdout.

6. **Stripe integration** — the billing service abstraction (`billingService.js`) is designed for this. Connect `checkout.session.completed` and `customer.subscription.updated` webhooks.

7. **Real data connectors** — add adapters for common SaaS tools (Zendesk, Salesforce, HubSpot) so the risk engine processes real operational signals rather than demo data.

8. **Test coverage for Slack integration** — the hardest layer to test because it requires a live Slack environment or significant mocking. Use `@slack/bolt`'s test utilities.
