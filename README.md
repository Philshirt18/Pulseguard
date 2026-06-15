# 🛡️ PulseGuard AI

**Detect business risks before they become business problems.**

> PulseGuard proactively discovers problems before humans notice them. Instead of "What happened?" — PulseGuard answers: "What is likely to happen next?"

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────┐
│                  Slack (UI Layer)                │
│  /executive-summary  /risk-report  /why-risk    │
│                /recommend-action                 │
└────────────────────────┬────────────────────────┘
                         │
┌────────────────────────▼────────────────────────┐
│           Risk Detection Engine                  │
│  (Deterministic: trends, spikes, correlations)  │
└────────────────────────┬────────────────────────┘
                         │
┌────────────────────────▼────────────────────────┐
│          AI Narrative Engine (OpenAI)            │
│  (Explanations, summaries, recommendations)     │
└────────────────────────┬────────────────────────┘
                         │
┌────────────────────────▼────────────────────────┐
│              Mock Data Layer                     │
│  (EuroStay Rentals: 15K properties, 7 regions)  │
└─────────────────────────────────────────────────┘
```

---

## 🚀 Quick Setup

### 1. Create Slack App

1. Go to [api.slack.com/apps](https://api.slack.com/apps)
2. Click **"Create New App"** → **"From a manifest"**
3. Select your workspace
4. Paste the contents of `manifest.json`
5. Click **Create**

### 2. Get Credentials

From your Slack app settings:
- **Bot Token**: Settings → Install App → Bot User OAuth Token (`xoxb-...`)
- **Signing Secret**: Settings → Basic Information → Signing Secret
- **App Token**: Settings → Basic Information → App-Level Tokens → Generate Token (add `connections:write` scope) (`xapp-...`)

### 3. Get OpenAI Key

Get an API key from [platform.openai.com](https://platform.openai.com/api-keys)

### 4. Configure Environment

```bash
cp .env.example .env
# Fill in your values in .env
```

### 5. Install & Run

```bash
npm install
npm start
```

---

## 📋 Commands

| Command | Description |
|---------|-------------|
| `/executive-summary` | Executive Intelligence Brief — the hero feature |
| `/risk-report` | All detected risks ranked by severity |
| `/why-risk [risk-id]` | Deep root cause analysis |
| `/recommend-action [risk-id]` | Action plan + business impact |

---

## 🎬 Demo Script (3 Minutes)

### Opening (30 seconds)
> "Most AI tools answer questions. PulseGuard is different. It proactively discovers problems before humans notice them."

### Step 1: Executive Summary (45 seconds)
```
/executive-summary
```
- Show the beautiful Executive Intelligence Brief
- Point out: "This appeared automatically. No one asked for it."
- Highlight the critical risk in Southern Spain

### Step 2: Risk Report (30 seconds)
```
/risk-report
```
- Show the ranked risk list
- Point out: "Southern Spain has the highest risk score across all categories"
- Note the correlations between different risk types

### Step 3: Root Cause — The Wow Moment (45 seconds)
```
/why-risk risk-ops-ven-001
```
- Show the root cause analysis
- **This is the key moment**: "PulseGuard connected the dots automatically"
- "78% of complaints trace back to ONE vendor: Atlas Services"
- "No human asked this question. PulseGuard discovered it."

### Step 4: Recommendations (30 seconds)
```
/recommend-action risk-ops-ven-001
```
- Show actionable recommendations with owners and timelines
- Highlight: "Revenue protected: €24,500/month"
- Close with: "From detection to action plan — all inside Slack."

### Closing (15 seconds)
> "PulseGuard doesn't wait for questions. It finds problems you didn't know you had, explains why they're happening, and tells you exactly what to do. This is the future of operational intelligence."

---

## 🎯 The Hero Story

PulseGuard discovers that **Vendor Atlas Services** — a maintenance contractor in Southern Spain — is the root cause of a cascading operational crisis:

- 72-hour average response time (baseline: 14h)
- 45% task completion rate (baseline: 90%)
- Causing 256% increase in guest complaints
- Driving 17.5% cancellation rate (baseline: 6.5%)
- €234,000 in refunds in one month

**No human connected these dots. PulseGuard did.**

---

## 🧪 Demo Company

**EuroStay Rentals** — European vacation rental company
- 15,000 properties
- 7 regions (Spain, Portugal, France, Italy, Greece, Croatia)
- 750 employees
- All data is fictional

---

## License

Built for the Slack Agent Builder Challenge.
