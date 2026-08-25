# PulseGuard — Security

## Overview

This document describes the security controls implemented in PulseGuard, known limitations, and recommended improvements before accepting real paying customers.

---

## Slack Request Verification

Every incoming request from Slack is verified using HMAC-SHA256 signature validation.

**Implementation:** Handled automatically by `@slack/bolt`'s `ExpressReceiver`.

- Bolt verifies the `X-Slack-Signature` header against `SLACK_SIGNING_SECRET`
- Requests with invalid or missing signatures are rejected with 403
- Timestamp validation prevents replay attacks (requests older than 5 minutes are rejected)

**Required:** `SLACK_SIGNING_SECRET` environment variable must be set. If missing, Bolt will reject all requests.

---

## OAuth Security

- **CSRF protection:** OAuth state parameter is generated per-session and verified on callback (`stateVerification: true` in `ExpressReceiver`)
- **State secret:** Controlled by `SLACK_STATE_SECRET` — use a long random string, rotate periodically
- **Token scope:** Only the minimum required scopes are requested (`commands`, `chat:write`, `chat:write.public`)
- **Token storage:** Tokens are stored by workspace ID — one workspace cannot retrieve another's token

---

## Secrets Management

| Secret | Storage | Notes |
|--------|---------|-------|
| `SLACK_SIGNING_SECRET` | Environment variable | Never log, never expose to client |
| `SLACK_CLIENT_SECRET` | Environment variable | Never log, never expose to client |
| `SLACK_STATE_SECRET` | Environment variable | Rotate if compromised |
| `OPENAI_API_KEY` | Environment variable | Never expose to clients |
| Workspace bot tokens | `installationStore` | Never logged (only workspace IDs logged) |

**What is never logged:**
- Access tokens (`xoxb-...`)
- Client secrets
- API keys
- Raw installation objects

**What is safe to log:**
- Workspace IDs (e.g. `T01234567`) — non-sensitive identifiers
- User IDs (e.g. `U01234567`) — non-sensitive identifiers
- Operation names, durations, token counts

---

## Prompt Injection Protection

PulseGuard sends risk data to OpenAI. This data originates from our deterministic engine (trusted), but defence-in-depth is applied.

**Implementation:** `src/services/inputSanitiser.js`

Protections:
1. **Field whitelist:** Only known-safe fields from risk objects are serialised into prompts
2. **Truncation:** All external content is capped at configurable character limits before reaching OpenAI
3. **Pattern stripping:** 10 regex patterns covering common injection attempts (e.g. "ignore all previous instructions") are removed and replaced with `[content removed]`
4. **Structural separation:** System instructions, user content, and external data are in separate message roles — the model is instructed to ignore instructions in data

**Scope:** Currently only risk data (from our own engine) passes through the AI. When real customer data is introduced (e.g. actual support tickets, reviews), it must be sanitised with the same pipeline before any AI call.

---

## Multi-Tenant Isolation

Each workspace's data is scoped to its workspace ID. The current implementation provides logical isolation:

- Installation tokens are stored by `team:{teamId}` or `enterprise:{enterpriseId}` keys
- Billing and usage are tracked per `workspaceId`
- Risk detection currently runs on shared demo data — **this must be changed before accepting real customers** (see Production Blockers below)

**There is no cryptographic isolation** — a bug in the lookup logic could theoretically allow cross-tenant access. For full isolation, each workspace should have its own database row/namespace.

---

## MCP Tool Security

MCP tools exposed at `/mcp` are accessible to any MCP-compatible client.

Controls:
- Tools are a fixed whitelist — no arbitrary code execution is possible
- All tool inputs are validated with Zod before execution
- Tool results are truncated before being fed back to the model (3,000 char limit)
- The agent system prompt explicitly instructs the model not to follow instructions embedded in tool results

**Note:** The MCP endpoint is currently unauthenticated. Any client that knows the URL can query it. For production, add API key authentication to the `/mcp` endpoint.

---

## API Authentication

| Endpoint | Authentication | Notes |
|----------|---------------|-------|
| `POST /api/slack` | Slack signature verification | ✅ Implemented |
| `GET /slack/install` | None (public) | ✅ Correct |
| `GET /slack/oauth_redirect` | State parameter CSRF check | ✅ Implemented |
| `POST /mcp` | None | ⚠️ Should add API key for production |
| `GET /health` | None (public) | ✅ Does not expose secrets |

---

## Input Validation

| Input source | Validation |
|-------------|------------|
| Slash command text | Sanitised via `sanitiseSlashCommandInput()`, max 500 chars |
| MCP tool arguments | Validated with Zod schemas, max 100-200 chars per field |
| Risk data sent to OpenAI | Field-whitelisted, truncated, injection-stripped |
| OAuth callback parameters | Handled by Bolt (state verification) |

---

## Rate Limiting

**Current status:** No application-level rate limiting is implemented.

Vercel provides some protection via its infrastructure, but there is no per-workspace or per-IP rate limit at the application layer.

**Recommended before production:**
- Add per-workspace rate limiting on slash commands (e.g. max 20 requests/minute)
- Add rate limiting on the MCP endpoint
- Consider using a middleware like `express-rate-limit` or Vercel's Edge Config

---

## Known Security Limitations

These are known issues that must be addressed before accepting real paying customers:

1. **Token persistence:** Installation tokens are stored in-memory and lost on cold start. A compromised or restarted process loses all workspace tokens. Use Vercel KV or equivalent.

2. **MCP endpoint unauthenticated:** `POST /mcp` has no authentication. Add an API key header requirement.

3. **No rate limiting:** Slash commands and MCP endpoints have no rate limiting at the application layer.

4. **Single-tenant data model:** Risk data is currently demo data shared across all workspaces. Real customer data must be strictly isolated per workspace with no shared state.

5. **No audit log:** Approval actions (approve/reject) are logged to stdout but not persisted. A proper audit trail should be stored in a database.

6. **State secret default:** `SLACK_STATE_SECRET` falls back to a hardcoded string if not set. Always set this in production.

---

## Environment Variable Security Checklist

- [ ] `SLACK_SIGNING_SECRET` — set, kept secret, not in source code
- [ ] `SLACK_CLIENT_SECRET` — set, kept secret
- [ ] `SLACK_STATE_SECRET` — set to a random 32+ character string
- [ ] `OPENAI_API_KEY` — set, usage limits configured in OpenAI dashboard
- [ ] `.env` — in `.gitignore` (confirmed: it is)
- [ ] No secrets in `vercel.json` or `manifest.json`
- [ ] Vercel environment variables set via dashboard, not committed
