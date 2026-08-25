# PulseGuard — Slack Distribution Guide

## Overview

This document covers everything required to distribute PulseGuard as a public Slack application — from OAuth configuration to Marketplace preparation.

> **Current status:** OAuth is implemented. All Manage Distribution checks pass. Public distribution pending Slack platform approval.

---

## OAuth Flow

PulseGuard uses Slack OAuth v2 via `@slack/bolt`'s `ExpressReceiver` with `installationStore`.

### Flow

```
User visits /slack/install
    ↓
Slack redirects to authorization screen
    ↓
User approves scopes
    ↓
Slack redirects to /slack/oauth_redirect?code=...
    ↓
Bolt exchanges code for access token
    ↓
installationStore.storeInstallation() persists token
    ↓
User is redirected to success page
```

### Files involved

| File | Role |
|------|------|
| `api/slack.js` | ExpressReceiver with OAuth config |
| `src/slack/installationStore.js` | Token persistence (in-memory + env seed) |
| `vercel.json` | Routes `/slack/install` and `/slack/oauth_redirect` to `api/slack.js` |

---

## Required Environment Variables

| Variable | Description | Required for OAuth |
|----------|-------------|-------------------|
| `SLACK_SIGNING_SECRET` | Verifies incoming Slack requests | Always |
| `SLACK_CLIENT_ID` | OAuth app client ID | Yes |
| `SLACK_CLIENT_SECRET` | OAuth app client secret | Yes |
| `SLACK_STATE_SECRET` | CSRF protection for OAuth state | Yes |
| `SLACK_BOT_TOKEN` | Legacy single-workspace token (optional) | No (backward compat) |
| `SLACK_TEAM_ID` | Seeds legacy token on cold start | Only with BOT_TOKEN |

---

## Required OAuth Scopes

| Scope | Reason |
|-------|--------|
| `commands` | Receive slash command payloads |
| `chat:write` | Post messages to channels |
| `chat:write.public` | Post to channels the bot hasn't joined |

---

## Slash Commands

Each command must be configured in the Slack App Dashboard with a Request URL:

| Command | Description | Request URL |
|---------|-------------|-------------|
| `/executive-summary` | Full intelligence brief | `https://<domain>/api/slack` |
| `/risk-report` | All risks ranked by severity | `https://<domain>/api/slack` |
| `/why-risk [risk-id]` | Root cause analysis | `https://<domain>/api/slack` |
| `/recommend-action [risk-id]` | Strategic recommendations | `https://<domain>/api/slack` |
| `/pulse` | Quick status check | `https://<domain>/api/slack` |

---

## Redirect URLs

Configure in **OAuth & Permissions → Redirect URLs**:

```
https://<domain>/slack/oauth_redirect
```

---

## Event Subscriptions

| Setting | Value |
|---------|-------|
| Request URL | `https://<domain>/api/slack` |
| Bot Events | `app_home_opened` |

---

## Interactivity

| Setting | Value |
|---------|-------|
| Interactivity | Enabled |
| Request URL | `https://<domain>/api/slack` |

Required for interactive buttons (Investigate, Approve, Reject, etc.).

---

## Uninstall Handling

When a workspace uninstalls PulseGuard, Bolt fires `app_uninstalled`. The current implementation does not yet explicitly handle this event — the installation remains in the store but the token becomes invalid.

**Recommended improvement:** Listen for `app_uninstalled` and call `installationStore.deleteInstallation()`.

```js
app.event('app_uninstalled', async ({ context }) => {
  await installationStore.deleteInstallation({ teamId: context.teamId });
});
```

---

## Token Storage — Production Upgrade Required

**Current:** In-memory `Map`. Tokens lost on Vercel cold start. The `SLACK_BOT_TOKEN` + `SLACK_TEAM_ID` env vars seed the primary workspace on every fetch as a mitigation.

**Required for multi-workspace production:**

Replace the `_store` Map in `src/slack/installationStore.js` with a persistent backend. The `storeInstallation` / `fetchInstallation` / `deleteInstallation` interface is unchanged — no other code needs to change.

Options by infrastructure:

| Option | Package | Notes |
|--------|---------|-------|
| Vercel KV (Redis) | `@vercel/kv` | Easiest for Vercel deployments |
| Upstash Redis | `@upstash/redis` | Serverless-native, generous free tier |
| Neon Postgres | `@vercel/postgres` | If you already have a DB |
| DynamoDB | `@aws-sdk/client-dynamodb` | AWS-native |

---

## Marketplace Preparation Checklist

Before submitting to the Slack Marketplace:

- [ ] Privacy policy URL configured in Basic Information
- [ ] Support URL or email configured
- [ ] App icon uploaded (512×512 PNG)
- [ ] Short description (≤150 chars)
- [ ] Long description written
- [ ] All Request URLs verified (Slack sends a challenge)
- [ ] OAuth Redirect URL saved and verified
- [ ] Socket Mode disabled
- [ ] No hardcoded tokens in source code
- [ ] Public Distribution activated in Manage Distribution
- [ ] App reviewed by Slack (review process required for Marketplace listing)

---

## Security Considerations

- All incoming Slack requests are verified via HMAC-SHA256 signature (`SLACK_SIGNING_SECRET`)
- OAuth state parameter is validated to prevent CSRF
- Tokens are stored by workspace ID — one workspace cannot access another's token
- Tokens are never logged (only workspace IDs appear in logs)
- `SLACK_CLIENT_SECRET` must be kept secret and rotated if compromised
