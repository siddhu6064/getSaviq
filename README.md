# SAVIQ

[![Backend: FastAPI](https://img.shields.io/badge/backend-FastAPI-009688?logo=fastapi&logoColor=white)](backend/)
[![Web: React + Vite](https://img.shields.io/badge/web-React%20%2B%20Vite-61DAFB?logo=react&logoColor=111)](web/)
[![Mobile: Expo](https://img.shields.io/badge/mobile-Expo-000020?logo=expo&logoColor=white)](frontend/)
[![Database: MongoDB Atlas](https://img.shields.io/badge/database-MongoDB%20Atlas-47A248?logo=mongodb&logoColor=white)](backend/)
[![Tests: Pytest + Playwright](https://img.shields.io/badge/tests-pytest%20%7C%20node:test%20%7C%20Playwright-6E40C9)](tests/)

**Financial intelligence for modern households and solo operators.**  
SAVIQ combines transaction tracking, forecasting, savings planning, and AI guidance across web and mobile in one profile-aware platform.

> **Current posture:** feature-complete for internal beta, with remaining runtime/device validation and observability work before broader rollout.

---

## Table of Contents

- [Why SAVIQ](#why-saviq)
- [Core Differentiators](#core-differentiators)
- [Feature Highlights](#feature-highlights)
- [Profile Model (Current Scope)](#profile-model-current-scope)
- [Architecture Overview](#architecture-overview)
- [AI Stack and Degradation Behavior](#ai-stack-and-degradation-behavior)
- [Environment Setup](#environment-setup)
- [Local Development](#local-development)
- [Testing](#testing)
- [Mobile & Runtime Notes](#mobile--runtime-notes)
- [Release Readiness](#release-readiness)
- [Roadmap (Near-Term)](#roadmap-near-term)

---

## Why SAVIQ

Most expense apps answer **"what happened?"**. SAVIQ is designed to answer:

- **What is happening now?** (real-time spend visibility)
- **What is likely next?** (forecasting + budget risk)
- **What should I do?** (AI recommendations and guided savings)

SAVIQ exists to help users make confident financial decisions, not just log transactions.

## Core Differentiators

- **AI-native financial UX:** conversational and card-based insights integrated directly into product flows.
- **Forecast + action loop:** projections, confidence scoring, and recommendation layers tied to savings goals and budget posture.
- **Cross-platform continuity:** web and Expo mobile surfaces cover the same core financial workflows.
- **Profile-aware data boundaries:** personal/business/shared profile contexts with explicit scoped rendering and data access.

---

## Feature Highlights

### 1) Financial Dashboard & Smart Metrics
- Net balance, income, spend, month-over-month movement, top goal summary.
- Smart metrics including savings score, spend velocity, financial health, budget confidence, and projected savings.
- Loading/empty/error state handling across dashboard cards and widgets.

### 2) Goals, Budgets, and Planning
- Savings goals CRUD with progress, milestones, projected completion dates, and monthly recommendation support.
- Budget tracking with risk-oriented visibility and profile-aware filtering.
- Priority goal surfacing from dashboard context.

### 3) Forecasting & Risk Intelligence
- 7-day and 30-day projection windows.
- Month-end spend forecasting and velocity modeling.
- Budget exceed risk and confidence scoring with plain-language explanation layers.

### 4) AI-Powered Intelligence
- Smart insights and recommendations on dashboard surfaces powered by Gemini 2.5 Flash.
- AI receipt scanning endpoint support (vision-capable model).
- AI chat insights (`/ai/chat-insights`) with prompt suggestions, retry/failure handling, and profile-isolated conversation context.

### 5) Weekly Digest & Recurring Spend Detection
- Weekly financial digest with narrative summary, income/expense delta, and profile switching support.
- Recurring spend detection with subscription candidates and monthly recurring totals.

### 6) Exports
- Data export endpoints for CSV and JSON scoped by profile/date windows.

### 7) Mobile Coverage
- Route-level coverage across dashboard, transactions, budgets, goals, analytics, and AI chat flows.
- Mobile-first interaction patterns, dark mode support for primary flows, and profile switching restore behavior.

---

## Profile Model (Current Scope)

SAVIQ supports profile switching with explicit `profile_type` values:

- `personal`
- `business`
- `shared`

Important scope boundary:

- `business` currently represents profile context and data partitioning, **not** a full multi-user organization account model.
- Ownership remains single-user scoped per authenticated account.
- Team memberships, invitations, shared ownership, and role-based org collaboration are not implemented yet.

---

## Architecture Overview

| Layer | Stack | Notes |
|---|---|---|
| Backend API | Python, FastAPI, Pydantic, Motor/PyMongo | Session/auth flows, profile-scoped data model, analytics/forecast/AI endpoints |
| Database | MongoDB Atlas (cloud-hosted) | 10 collections + startup index initialization (including TTL on sessions). All indexes auto-created on startup. |
| Web App | React + Vite, Tailwind, Recharts | Runs on port 3000 in dev. Product UI, dashboards, goals, analytics, exports, AI chat |
| Mobile App | React Native (Expo) | Cross-platform mobile experience with backend auth integration |
| Shared Logic | `shared/` TypeScript package | Shared constants/types/utils across app surfaces |
| AI | Google Gemini 2.5 Flash (receipts) + Flash-Lite (insights/chat) | Via `google-genai` SDK + `litellm` routing |
| Email | Resend | Transactional emails — 3,000/month free tier |
| Analytics | PostHog | Product analytics + error tracking — 1M events/month free tier |
| Storage | Cloudflare R2 | Receipt image storage — 10GB free, zero egress fees |
| Cache | Upstash Redis | Rate limiting persistence — 500K commands/month free tier |
| Testing | `pytest`, `node:test`, Playwright | Backend coverage + web logic/E2E + mobile helper/orchestration tests |

---

## AI Stack and Degradation Behavior

### Primary provider
- **Google Gemini** via `google-genai` SDK (replaces OpenAI for all AI features).
- Receipt scanning: `gemini-2.5-flash` (vision-capable, $0.30/$2.50 per 1M tokens).
- Insights + chat: `gemini-2.5-flash-lite` (text-only, $0.10/$0.40 per 1M tokens).
- Free dev tier: 1,500 requests/day via Google AI Studio — covers full beta traffic at $0.

### Optionality
- AI-specific configuration is optional for core CRUD and analytics flows.
- If AI is unavailable or disabled, core expense tracking, budgets, goals, and non-AI analytics remain fully available.

### Feature control
- `ENABLE_AI_FEATURES` can be used to gate AI behavior by environment.
- Model values are configured via `OPENAI_RECEIPT_MODEL` and `OPENAI_INSIGHTS_MODEL` env vars (these var names are preserved for backward compatibility — just point them at Gemini model strings).

---

## Environment Setup

> ⚠️ **Important:** Backend runtime loads env from `backend/.env`. Copy from `backend/.env.example` and fill in values. See full variable reference in `SAVIQ_Environment_Variables.docx`.

### Minimum required variables

```env
# Database (MongoDB Atlas)
MONGO_URL=mongodb+srv://saviq:PASSWORD@saviq.v9ypdo7.mongodb.net/?retryWrites=true&w=majority&appName=Saviq
DB_NAME=saviq

# Auth
JWT_SECRET=<generate with: openssl rand -base64 32>
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173,http://localhost:8081

# Google OAuth
GOOGLE_CLIENT_IDS=web-client-id.apps.googleusercontent.com,ios-client-id.apps.googleusercontent.com
```

### AI (Gemini — recommended)

```env
GOOGLE_API_KEY=AIza...
OPENAI_RECEIPT_MODEL=gemini-2.5-flash
OPENAI_INSIGHTS_MODEL=gemini-2.5-flash-lite
```

### Optional integrations (all configured, all free tier)

```env
# Email
RESEND_API_KEY=re_...

# Analytics + error tracking
POSTHOG_API_KEY=phc_...

# Receipt image storage
CLOUDFLARE_R2_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
CLOUDFLARE_R2_BUCKET_NAME=saviq-receipts
CLOUDFLARE_R2_ACCESS_KEY_ID=...
CLOUDFLARE_R2_SECRET_ACCESS_KEY=...

# Rate limiting cache
REDIS_URL=rediss://...
```

### Frontend env files

**`web/.env`:**
```env
VITE_BACKEND_URL=http://localhost:8001
VITE_GOOGLE_CLIENT_ID=your-web-client-id.apps.googleusercontent.com
```

**`frontend/.env`:**
```env
EXPO_PUBLIC_BACKEND_URL=http://localhost:8001
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=your-web-client-id.apps.googleusercontent.com
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=your-ios-client-id.apps.googleusercontent.com
```

> **Note for physical device testing:** replace `localhost` in `EXPO_PUBLIC_BACKEND_URL` with your Mac's LAN IP (`ipconfig getifaddr en0`).

---

## Local Development

### 1) Backend

```bash
cd backend
pip install -r requirements.txt
cp .env.example .env   # then fill in your values
python -m uvicorn main:app --reload --port 8001
```

MongoDB collections and indexes are created automatically on first startup — no manual schema setup needed.

Backend API docs available at: `http://127.0.0.1:8001/docs`

### 2) Web

```bash
cd web
npm install
npm run dev
# runs on http://localhost:3000
```

### 3) Mobile (Expo)

```bash
cd frontend
npm install
npx expo start
```

Set `EXPO_PUBLIC_BACKEND_URL` to a backend URL reachable from your emulator or physical device.

---

## Testing

### Backend
```bash
pytest
```

### Web logic tests
```bash
node --test web/src/lib/*.test.mjs
```

### Web E2E (smoke/core flows)
```bash
npx playwright test
```

### Build checks
```bash
cd web && npm run build
```

---

## Mobile & Runtime Notes

- Automated mobile coverage currently emphasizes high-signal helper/state/orchestration logic.
- Full mobile UI E2E/device-matrix validation is intentionally not yet exhaustive.
- Additional runtime validation remains necessary for:
  - gesture behavior
  - lifecycle handling
  - deep links
  - notifications

This is the primary remaining validation gap between internal beta and wider rollout confidence.

---

## Release Readiness

| Area | Status |
|---|---|
| Feature scope (V2) | ✅ Complete |
| Web + mobile route parity | ✅ Complete |
| Backend/API implementation | ✅ Complete for core flows |
| Automated tests | ✅ Strong (backend + web + targeted mobile logic) |
| Environment & API keys | ✅ All services configured (MongoDB Atlas, Gemini, Resend, PostHog, Cloudflare R2, Upstash) |
| Analytics & error tracking | ✅ PostHog connected (free tier) |
| Device/runtime validation | ⛔ Pending final pass |
| Observability hardening | ⚠️ PostHog connected — instrumentation in progress |

**Current release posture:** ready for **internal beta** and controlled usage; not yet positioned as broad production rollout.

---

## Roadmap (Near-Term)

1. **Wire up Gemini in AI service layer**
   - Replace OpenAI client calls with `google-genai` SDK in `openai_client.py`.
   - Test receipt scanning with real receipt images.
2. **Resend email integration**
   - Implement password reset and welcome email flows using `RESEND_API_KEY`.
3. **PostHog instrumentation**
   - Add event tracking to key user flows (signup, transaction add, AI insights).
4. **Cloudflare R2 migration**
   - Move receipt images from MongoDB base64 storage to R2 to reduce Atlas storage pressure.
5. **Android client ID**
   - Install Java (`brew install --cask zulu@17`), generate SHA-1, add Android OAuth client.
6. **Device/runtime confidence**
   - Broader on-device validation across lifecycle/deep-link/notification scenarios.
7. **Export expansion**
   - PDF export support to complement CSV/JSON.
8. **Collaboration & business profile evolution**
   - Team/org primitives (roles, memberships, invitations, shared ownership).

---

## Known Issues Fixed (Beta Setup)

The following bugs were patched during initial beta setup:

- `insights_v2_service.py` — MongoDB collection truth-value comparison fixed (`or` → `is not None`)
- `forecast_service.py`, `dashboard_metrics.py`, `insights.py`, `analytics.py` — timezone-naive vs timezone-aware datetime comparison fixed across all date filter expressions (`.replace(tzinfo=timezone.utc)`)

---

SAVIQ is already a strong internal-beta product baseline: feature-complete, cross-platform, and AI-augmented. The remaining work is operational hardening and runtime validation for larger-scale rollout.
