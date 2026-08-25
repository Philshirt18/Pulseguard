# PulseGuard — AI Cost Control

## Overview

PulseGuard uses OpenAI for two distinct purposes, both tightly controlled:

1. **Narrative generation** (`src/engine/aiNarrative.js`) — prose explanations of detected risks
2. **Agent investigation** (`src/engine/investigationAgent.js`) — tool-using investigation loop

AI is explicitly **not** used for risk detection or scoring — that is handled by the deterministic `riskDetector.js` engine. This separation keeps detection costs zero and scoring consistent.

---

## Where AI Calls Happen

| Operation | File | Model | Max tokens | Triggered by |
|-----------|------|-------|------------|--------------|
| Root cause analysis | `aiNarrative.js` | `gpt-4o-mini` | 800 | `/why-risk`, Investigate button |
| Recommendations | `aiNarrative.js` | `gpt-4o-mini` | 800 | `/recommend-action`, Recommend button |
| Executive summary | `aiNarrative.js` | `gpt-4o-mini` | 800 | `/executive-summary` |
| Agent investigation | `investigationAgent.js` | `gpt-4o-mini` | 1000/round | Future: deep investigation flow |

All models are configurable via environment variables:
- `OPENAI_NARRATIVE_MODEL` (default: `gpt-4o-mini`)
- `OPENAI_AGENT_MODEL` (default: `gpt-4o-mini`)

---

## Per-Call Cost Estimates

Based on `gpt-4o-mini` pricing ($0.15/1M input, $0.60/1M output tokens, as of mid-2025):

| Operation | Approx tokens | Approx cost |
|-----------|--------------|-------------|
| Root cause analysis | ~600 | ~$0.00009 |
| Recommendations | ~800 | ~$0.00012 |
| Executive summary | ~800 | ~$0.00012 |
| Agent investigation (3 rounds) | ~3,000 | ~$0.00045 |

**Worst case per workspace per month (FREE plan — 10 ops):** ~$0.001  
**Worst case per workspace per month (PRO plan — 200 ops):** ~$0.024  
**Worst case per workspace per month (BUSINESS plan — 1,000 ops):** ~$0.12

These are significantly below plan pricing, giving healthy margin.

---

## Plan Limits

Enforced in `src/services/usageTracker.js` via `checkLimit()` before every API call.

| Plan | Monthly AI operations | Configurable via env |
|------|--------------------|---------------------|
| FREE | 10 | `PLAN_FREE_AI_OPS` |
| PRO | 200 | `PLAN_PRO_AI_OPS` |
| BUSINESS | 1,000 | `PLAN_BUSINESS_AI_OPS` |

If a workspace has reached its limit, `checkAndRecord()` returns `{ allowed: false }` and **the OpenAI call is never made**. The caller receives a structured limit-exceeded response with an upgrade prompt.

---

## Caching

Responses are cached in-memory with a 10-minute TTL (`src/engine/cache.js`).

Cache key: `${workspaceId}:${operation}_${riskId}`

This means:
- Repeated `/why-risk risk-ops-ven-001` within 10 minutes = **zero API cost**
- Cache hit does **not** count against the plan limit
- Cache is per-process — cleared on cold start (Vercel)

Cache behaviour is controlled in `aiNarrative.js` — cache hits skip the billing check entirely and return immediately.

---

## Token Limits

Hard cap per API call enforced via `max_tokens`:

- Narrative calls: `AI_MAX_TOKENS` env var (default: `800`)
- Agent rounds: `AI_MAX_TOKENS` env var (default: `1000`)

OpenAI will truncate responses at this limit. The `response_format: json_object` instruction ensures responses are still valid JSON even if truncated partway through.

---

## Input Size Limits

Before any risk data is sent to OpenAI, it is:

1. **Field-whitelisted** — only safe fields are serialised (no internal engine state)
2. **Truncated** — capped at `SANITISE_MAX_RISK_JSON` chars (default: 2,000)
3. **Injection-stripped** — patterns like "ignore all instructions" are removed

This prevents both prompt injection and oversized token consumption from large data payloads.

---

## Demo Mode

Set `DEMO_MODE=true` to bypass OpenAI entirely. All AI functions return pre-written fallback responses.

Used for:
- Local development (zero API cost)
- Portfolio demonstrations
- Slack app review submissions
- CI/CD testing

Demo responses are clearly labelled with `_demo: true` in the response object and are **never** mixed with real customer data.

---

## Fallback Behaviour

If the OpenAI API call fails (network error, rate limit, timeout):

1. Error is caught and logged (with workspace ID, operation, duration)
2. Usage is recorded as `success: false` (does **not** count against plan limit)
3. A high-quality fallback response is returned (same format as AI response)
4. The user sees a complete, useful response — they never see a raw error

---

## Rate Limit Handling

OpenAI rate limits are handled by the try/catch in `_callOpenAI()`. On failure, the fallback is returned immediately. No retry logic is currently implemented — this is intentional to keep latency predictable for Slack's 3-second response window.

For production scale, add exponential backoff with jitter:

```js
// Future improvement in aiNarrative.js
const response = await retry(
  () => client.chat.completions.create(...),
  { retries: 2, factor: 2, minTimeout: 300 }
);
```

---

## Monitoring Costs

Usage is tracked per workspace per month in `usageTracker._store`. Access via:

```js
const billing = require('./src/services/billingService');
const summary = billing.getBillingSummary(workspaceId);
// summary.usage.estimatedCostUsd
// summary.usage.operationsUsed
// summary.usage.operationsRemaining
```

The `/health` endpoint exposes aggregate risk data but not per-workspace billing data. A future `/admin/usage` endpoint should be added with appropriate authentication.

---

## Environment Variables Reference

| Variable | Default | Description |
|----------|---------|-------------|
| `OPENAI_API_KEY` | — | Required. Never expose to clients. |
| `OPENAI_NARRATIVE_MODEL` | `gpt-4o-mini` | Model for narrative generation |
| `OPENAI_AGENT_MODEL` | `gpt-4o-mini` | Model for agent investigation |
| `AI_MAX_TOKENS` | `800` | Max tokens per API call |
| `AGENT_MAX_TOOL_ROUNDS` | `5` | Max tool call rounds per investigation |
| `PLAN_FREE_AI_OPS` | `10` | FREE plan monthly operations |
| `PLAN_PRO_AI_OPS` | `200` | PRO plan monthly operations |
| `PLAN_BUSINESS_AI_OPS` | `1000` | BUSINESS plan monthly operations |
| `DEMO_MODE` | `false` | Skip OpenAI, use fallbacks |
| `SANITISE_MAX_RISK_JSON` | `2000` | Max chars of risk data sent to OpenAI |
