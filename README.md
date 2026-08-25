# PulseGuard AI

An AI-powered operational risk intelligence system for Slack. Detects business risks before they become crises — by correlating signals across data sources that no human is connecting.

---

## What It Does

Most monitoring tools alert you to things you already knew to watch. PulseGuard finds the problems you didn't know to look for.

It runs a deterministic risk detection engine across operational data — support tickets, reviews, vendor performance, bookings, owner satisfaction — and surfaces patterns that span multiple systems. When it finds something, it uses AI to explain what's happening, investigate the root cause with real data queries, and recommend specific actions with quantified business impact.

Everything happens inside Slack. No dashboards to check. No questions to ask first.

**Slash commands:**

| Command | Description |
|---------|-------------|
| `/executive-summary` | Full intelligence brief with all active risks |
| `/risk-report` | All risks ranked by severity and confidence |
| `/why-risk [risk-id]` | Root cause analysis with investigation timeline |
| `/recommend-action [risk-id]` | Strategic options with approval flow |
| `/pulse` | Quick status check |

High-impact recommendations include an approval step — the AI suggests, a human confirms.

---

## Why It Exists

The problem: operational crises almost always leave a trail of connected signals before they become visible. A vendor's completion rate drops. Guest complaints cluster around maintenance keywords. Cancellation rates tick up. Owner satisfaction scores decline. Each signal is visible in its own system — but no human connects them until the crisis is obvious.

PulseGuard connects them programmatically, then uses AI to make the connection legible to executives.

---

## Architecture

```
Operational Data
    ↓
Deterministic Risk Engine         ← never uses AI, always consistent
    - Spike detection
    - Trend analysis
    - Threshold comparison
    - Cross-signal correlation
    ↓
Risk Objects (typed, scored, evidenced)
    ↓
┌──────────────────────┐    ┌─────────────────────────────┐
│ AI Narrative Layer   │    │ AI Investigation Agent       │
│ gpt-4o-mini          │    │ Tool-using, gpt-4o-mini       │
│ Prose generation     │    │ Queries data, synthesises    │
│ Billing-gated        │    │ findings autonomously        │
└──────────┬───────────┘    └──────────────┬──────────────┘
           │                               │
           └──────────────┬────────────────┘
                          ↓
              Slack (blocks.js, commands.js)
              MCP Server (tools.js)
```

**Key principle:** AI is used only for narrative generation and investigation — never for risk detection or scoring. Detection is deterministic, auditable, and free.

---

## AI Architecture

### Deterministic Risk Engine (`src/engine/riskDetector.js`)

Detects four risk types using statistical methods:

- **Customer satisfaction** — spike detection on complaint volume, trend analysis on review ratings
- **Revenue** — threshold analysis on cancellation rates vs. historical baselines
- **Operational** — vendor performance scoring across response time, completion rate, and escalations
- **Owner churn** — pattern matching against historical churn profiles

Each risk gets a severity score, confidence level, evidence object, and correlation list. No LLM involved.

### AI Narrative Layer (`src/engine/aiNarrative.js`)

Generates executive-quality prose from risk objects. Uses `gpt-4o-mini` with:
- Workspace-scoped context (billing enforced before every call)
- Input field whitelist + injection pattern stripping
- 800-token hard cap per call
- 10-minute response cache keyed by workspace + risk ID
- High-quality fallbacks if API is unavailable

### AI Investigation Agent (`src/engine/investigationAgent.js`)

A real tool-using agent that investigates risks by querying operational data:

```
Agent receives: risk summary
    ↓
Selects tools to call (function calling)
    ↓
Tools: get_risk_detail, get_vendor_metrics, get_region_complaints,
       get_region_reviews, get_booking_cancellations, get_owner_profile,
       compare_regions, get_baseline_comparison
    ↓
All inputs validated with Zod
Tool results truncated at 3,000 chars
Max 5 tool-call rounds
    ↓
Agent synthesises: root cause, key findings, evidence sources,
                   confidence, immediate actions, business impact
```

### MCP Server (`src/mcp/tools.js`, `api/mcp.js`)

Exposes risk intelligence to external AI agents via the Model Context Protocol. Tools: `get_executive_summary`, `list_risks`, `get_risk`, `investigate_risk`, `calculate_business_impact`, `get_risk_history`, `get_related_events`, `generate_recommendations`, `get_forecast`.

MCP endpoint: `POST https://<domain>/mcp`

---

## Security

- Slack requests verified via HMAC-SHA256 signature on every incoming request
- OAuth state parameter validated to prevent CSRF
- Workspace tokens stored by workspace ID — no cross-tenant access
- Prompt injection protection: field whitelist + truncation + pattern stripping on all AI inputs
- Tokens never logged — only workspace and user IDs appear in logs
- All AI inputs validated and size-limited before reaching OpenAI

See [`docs/SECURITY.md`](docs/SECURITY.md) for the full security model and known limitations.

---

## Multi-Tenancy

Each Slack workspace has isolated:
- Installation record (bot token)
- Usage tracking (AI operations per month)
- Billing subscription (FREE / PRO / BUSINESS)

Token isolation is logical (keyed by workspace ID). For full physical isolation, replace the in-memory `installationStore` with a persistent database — the interface is unchanged.

**Current limitation:** Risk data is shared demo data. Per-workspace data sources are on the roadmap.

---

## AI Cost Control

| Plan | Monthly AI operations | Model |
|------|--------------------|-------|
| FREE | 10 | gpt-4o-mini |
| PRO | 200 | gpt-4o-mini |
| BUSINESS | 1,000 | gpt-4o-mini |

Limits are enforced before every OpenAI call — over-limit workspaces never incur API charges. Plans are configurable via environment variables.

Estimated cost per operation: ~$0.00012 (gpt-4o-mini, 800 tokens).

See [`docs/AI_COST_CONTROL.md`](docs/AI_COST_CONTROL.md) for the full cost model.

---

## Slack Integration

OAuth v2 via `@slack/bolt` `ExpressReceiver`. Each workspace installs independently via `/slack/install`. Tokens are resolved per-request from the installation store.

See [`docs/SLACK_DISTRIBUTION.md`](docs/SLACK_DISTRIBUTION.md) for the full distribution guide.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Slack integration | `@slack/bolt` v3 |
| AI | OpenAI API (`gpt-4o-mini`) |
| MCP | `@modelcontextprotocol/sdk` |
| Input validation | `zod` |
| Deployment | Vercel (serverless) |
| Runtime | Node.js 18+ |
| Test runner | Node.js built-in `node:test` |

---

## Demo

The application ships with a synthetic demo dataset representing EuroStay Rentals, a fictional European vacation rental company. This data is clearly labelled as demo data and is never presented as real customer analysis.

Demo scenario: PulseGuard discovers that a single vendor's performance collapse in Southern Spain has triggered a cascade of guest complaints, cancellations (€234K in refunds), and imminent churn of a €890K property owner — 21 days before any human escalation.

Enable demo mode: `DEMO_MODE=true` — bypasses OpenAI entirely, uses pre-written fallback narratives.

---

## Local Development

```bash
# Clone and install
git clone https://github.com/Philshirt18/Pulseguard.git
cd Pulseguard
npm install

# Configure environment
cp .env.example .env
# Fill in: SLACK_SIGNING_SECRET, SLACK_BOT_TOKEN, SLACK_TEAM_ID
# Set DEMO_MODE=true to skip OpenAI

# Start Slack bot (Socket Mode for local dev)
npm run start

# Start MCP server (separate process)
npm run mcp
```

For Slack slash commands to work locally, use a tunnel (e.g. `ngrok http 3000`) and update the Request URLs in your Slack app settings.

---

## Deployment

Deployed to Vercel. Push to `main` triggers automatic deployment.

```bash
# Deploy manually
vercel --prod
```

Required environment variables in Vercel dashboard:

```
SLACK_SIGNING_SECRET
SLACK_CLIENT_ID
SLACK_CLIENT_SECRET
SLACK_STATE_SECRET
SLACK_BOT_TOKEN       # optional, for backward compat
SLACK_TEAM_ID         # optional, seeds primary workspace token
OPENAI_API_KEY
DEMO_MODE             # set to 'false' in production
```

---

## Testing

```bash
npm test
```

Tests cover: risk detection engine, usage tracking, billing service, input sanitisation, MCP tool validation, and multi-tenant isolation.

See [`tests/`](tests/) for the full suite.

---

## Roadmap

1. Persistent token storage (Vercel KV or Upstash Redis)
2. Per-workspace data sources (connect real tools: Zendesk, Intercom, Stripe)
3. MCP endpoint authentication (API key requirement)
4. Stripe subscription integration (billing service is ready, needs Stripe connection)
5. Rate limiting (per-workspace slash command throttling)
6. Real-time proactive alerts (scheduled risk scanning, push to Slack)

---

## Technical Decisions

**Why Node.js?** `@slack/bolt` is the official Slack SDK and is Node-native. Vercel serverless functions in Node.js have the fastest cold-start times among the available runtimes.

**Why gpt-4o-mini?** ~97% cost reduction vs GPT-4 with acceptable narrative quality. The deterministic engine handles accuracy — the AI only needs to write clearly, not reason precisely.

**Why not use an LLM for risk detection?** LLMs hallucinate numbers, are expensive per call, are slow, and are non-auditable. Threshold arithmetic and trend analysis are deterministic, instant, and free.

**Why MCP?** Exposes PulseGuard's intelligence to the broader AI ecosystem. Any agent with MCP support can query risk data programmatically without needing Slack.

**Why Vercel?** Zero-config deployment from GitHub, serverless scaling, built-in environment variable management, and the existing project was already configured for it.
