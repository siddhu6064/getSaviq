# SAVIQ Security & Correctness Audit Report

**Date:** 2026-06-02  
**Auditor:** Claude Code (claude-sonnet-4-6)  
**Scope:** Full end-to-end audit — backend, web frontend, mobile frontend  
**Method:** Read every source file listed; no sampling

---

## Executive Summary

SAVIQ has a solid security foundation — session tokens live exclusively in HttpOnly cookies on web, rate limiting is applied to all sensitive endpoints, and most data queries are properly user-scoped. However, several significant issues were found:

1. **CRITICAL auth contract mismatch** between backend and mobile: The backend never returns `session_token` in the JSON response body, but the mobile `AuthContext.tsx` destructures `session_token` from every auth response and stores it in SecureStore. Mobile authentication is broken by design.
2. **Systematic Rule 2 violation** across 8+ routers: Local `_ensure_profile_owned` helpers check only ownership, not accepted shared-profile membership. Shared-profile members cannot access data they are entitled to see.
3. **Multiple missing `user_id` guards** in queries where `get_accessible_profile` is relied on as a sole IDOR mitigation, but the underlying queries lack scoping.
4. **Invite acceptance email bypass** for Apple Sign-In users with no stored email.
5. **Stale `session_token` read in ThemeContext.jsx** — reads a key from `localStorage` that is never written by the web auth flow.

---

## Hard-Rule Violations

### Rule 1 — user_id in every MongoDB query

**HIGH — `get_expenses` query missing `user_id`**  
File: `backend/routers/expenses.py`  
When `profile_id` is supplied, the query is `{"profile_id": profile_id}` with no `user_id` filter. `get_accessible_profile` is called first and provides a mitigation, but if a logic error ever bypasses that gate the underlying query is unscoped. Recommend adding `"user_id": current_user["user_id"]` to the query unconditionally.

**MEDIUM — `check_bill_due_reminders` scheduler job**  
File: `backend/routers/bills.py`  
`db.bills.find({"status": "active"})` — no `user_id` filter by design (system iterator). Acceptable, but each bill's `user_id` field is used only for push notification routing; it is not verified against a user record. Low operational risk but noted for completeness.

**PASS** — All other routers read by this audit include `user_id` in queries or delegate to `get_accessible_profile`.

---

### Rule 2 — get_accessible_profile gate for all profile-scoped routes

**HIGH (systematic) — Local `_ensure_profile_owned` helpers ignore shared-profile membership**

The following routers define their own `_ensure_profile_owned` that queries:

```python
profile = await db.profiles.find_one({"profile_id": profile_id, "user_id": user_id})
```

This does NOT check the `profile_members` collection and therefore denies access to accepted shared-profile members.

Affected routers:

- `backend/routers/insights.py` — `GET /insights/overview`, `GET /insights/recommendations`, `GET /insights/v2`
- `backend/routers/ai.py` — `POST /ai/chat-insights`
- `backend/routers/forecast.py` — `GET /forecast`
- `backend/routers/subscriptions.py` — `GET /subscriptions/summary`
- `backend/routers/dashboard_metrics.py` — `GET /dashboard/metrics`
- `backend/routers/weekly_digest.py` — `GET /weekly-digest`, `GET /weekly-digest/latest`, `POST /weekly-digest/latest/dismiss`
- `backend/routers/savings_goals.py` — uses `get_accessible_profile` in most routes but falls back to `_ensure_profile_owned` in the milestone-notification path
- `backend/routers/net_worth.py` — assets/liabilities endpoints

The canonical fix is to replace all local helpers with `get_accessible_profile = Depends(...)` from `deps.py`.

---

### Rule 3 — R2 object key storage (not public URLs)

**PASS** — `backend/services/r2_service.py` stores object keys, generates presigned URLs on demand with 900 s TTL. `key_from_url` handles legacy migration. Attachment upload in `expenses.py` correctly stores the key.

**LOW — Misleading comment in `models.py`**  
`Expense.attachments` field is annotated with the comment `# R2 public URLs` (line ~100). The comment is outdated and conflicts with Rule 3. No runtime impact, but misleading.

---

### Rule 4 — Session token in cookie only

**PASS (web)** — `_set_session_cookie` in `auth.py` sets `httponly=True, secure=True, samesite="strict"`. The backend JSON response body contains `{"user": ...}` only — no `session_token` field.

**CRITICAL (mobile) — Backend/mobile auth contract mismatch**  
File: `frontend/src/contexts/AuthContext.tsx`  
Every auth method (`signInWithGoogle`, `signInWithApple`, `signInWithEmail`, `registerWithEmail`) destructures `session_token` from the API response:

```typescript
const { user, session_token } = response.data;
await storage.setItem("session_token", session_token);
```

The backend returns `{"user": user}` — `session_token` is never in the response body. `session_token` will be `undefined`, and `storage.setItem("session_token", undefined)` will store the string `"undefined"`. Subsequent `checkAuth` reads this value and sends `Authorization: Bearer undefined` to the API, which results in 401 and an authentication loop. **Mobile auth is non-functional for all sign-in methods under the current backend.**

**HIGH — `localStorage.getItem("session_token")` in ThemeContext.jsx**  
File: `web/src/contexts/ThemeContext.jsx` (lines 32 and 50)

```js
const token = localStorage.getItem("session_token");
if (token) { await settingsAPI.update(...) }
```

The web auth flow (`AuthContext.jsx`) never writes `session_token` to localStorage. It writes `user` (the user object). So `localStorage.getItem("session_token")` always returns `null`, and dark mode settings are never persisted to the backend via this path. The settings API is never called from ThemeContext even though the user is authenticated. This is a functional regression, not a security issue.

**MEDIUM — User object mirrored in localStorage**  
File: `web/src/contexts/AuthContext.jsx` (lines 38, 50, 58, 79)  
`localStorage.setItem("user", JSON.stringify(user))` is called after every login/register/googleAuth. `localStorage` is accessible to any JavaScript running on the page (including XSS). The user object contains PII (name, email) and identifiers. The actual session secret is in the HttpOnly cookie, so auth cannot be hijacked via this data alone, but it represents a privacy risk and a foothold for social engineering. Recommend removing the localStorage mirror and relying solely on the HttpOnly cookie + `/api/auth/me` for user state.

---

### Rule 5 — Pydantic field length limits

**MEDIUM — Multiple fields missing `max_length` constraints**  
File: `backend/models.py`

Fields without `max_length`:

- `Category.icon` — unbounded string
- `Category.color` — unbounded string (should be hex, ~7 chars)
- `PaymentMethod.type` — unbounded string
- `Expense.time` — unbounded string
- `Expense.merchant` — unbounded string (no max observed)
- `SavingsGoal.category` — unbounded string
- `Notification.type` — unbounded string
- `Notification.title` — unbounded string
- `Notification.body` — unbounded string

These could accept arbitrarily large values that would be stored in MongoDB and returned to clients. Recommend adding appropriate `max_length` via `Field(max_length=N)` to all text fields that have natural limits.

---

### Rule 6 — re.escape() for regex patterns

File: `backend/routers/expenses.py`  
Search query parameter `q` is run through `re.escape()` before building the MongoDB regex filter:

```python
{"description": {"$regex": re.escape(search_term), "$options": "i"}}
```

**PASS** — Rule 6 is followed.

---

### Rule 7 — No print() in backend

**MEDIUM — `print()` in `backend/scripts/check_integrity.py`**  
File: `backend/scripts/check_integrity.py` (line 16):

```python
print(json.dumps(summary, default=str, indent=2))
```

This is a maintenance/admin script, not a request handler. Low severity, but violates the rule.

**PASS** — No `print()` calls found in any router, service, or application file.

---

### Rule 8 — No "v2" in user-facing content

**MEDIUM — `/insights/v2` endpoint URL**  
File: `backend/routers/insights.py` (line 342):

```python
@router.get("/v2")
```

This produces the user-facing API path `/api/insights/v2`. Violates Rule 8.

**MEDIUM — `"schema_version": "v2"` in insights response payload**  
File: `backend/services/insights_v2_service.py` (line 206 in `_build_insight_metadata`):

```python
return {"schema_version": "v2", ...}
```

This `schema_version` field is returned in the API response body. Violates Rule 8.

---

### Rule 9 — APScheduler registration

**PASS** — All three APScheduler jobs are registered inside `lifespan()` in `backend/main.py` with `replace_existing=True`:

- `net_worth_snapshot_job` (daily)
- `weekly_digest_push_job` (weekly, Sundays)
- `bill_due_reminder_job` (daily)

No duplicate registration observed.

---

### Rule 10 — No hardcoded API URLs in web frontend

**PASS** — `web/src/services/api.js`:

```js
const API_BASE_URL = rawBackendUrl || "http://localhost:8001";
```

`rawBackendUrl` is `import.meta.env.VITE_BACKEND_URL`. The fallback to localhost is for development only and is gated by `!isProdBuild || isLocalHost`.

**PASS** — `frontend/src/services/api.ts`:

```ts
const API_BASE_URL = process.env.EXPO_PUBLIC_BACKEND_URL || "http://localhost:8001";
```

Follows the env-var pattern.

---

### Rule 11 — Auth on every router

**MEDIUM — `GET /invite/accept` is unauthenticated with no rate limiting**  
File: `backend/routers/invites.py` (line 134)  
The endpoint is intentionally unauthenticated (invite landing page). However, there is no `@limiter.limit()` decorator. An attacker can enumerate short invite tokens by brute-forcing this endpoint. The token is `secrets.token_urlsafe(32)` (256-bit), so brute force is computationally infeasible, but rate-limiting is still best practice.

**MEDIUM — `GET /invite/accept` and `POST /invite/accept` missing rate limits**  
Same file. `POST /invite/accept` (accept_invite_authenticated) also has no rate limit decorator.

`POST /invite/decline` is unauthenticated but has `@limiter.limit("5/minute")` — compliant.

**PASS** — All other routers checked have authentication via `Depends(get_current_user)`.

---

## Additional Security Findings

### IDOR / Ownership Verification

**HIGH — Invite accept allows any authenticated user with no email to accept any invite**  
File: `backend/routers/invites.py` (line ~199)

```python
if caller_email and caller_email != member_doc["invited_email"]:
    raise HTTPException(status_code=403, detail="...")
```

If `caller_email` is falsy (Apple Sign-In users who chose to hide their email — common), the email check is skipped entirely. Any authenticated Apple user without a stored email can accept any valid invite token. This is an IDOR in the invite acceptance flow.

**Recommendation:** If `caller_email` is None/empty, fall through to a secondary check using `caller_user_id` against `member_doc["invited_user_id"]` (if already set), or block the accept with an appropriate error rather than silently bypassing the check.

### Mass-Assignment / Parameter Tampering

**MEDIUM — `SavingsGoalUpdate` allows `profile_id` to be updated**  
File: `backend/models.py` (`SavingsGoalUpdate`)  
The update model includes `profile_id: str | None = None`. A user can move a savings goal from one profile to another by supplying a different `profile_id`. If the savings_goals router does not validate that the target `profile_id` is also owned/accessible by the caller, this allows cross-profile data movement. Recommend removing `profile_id` from the update model or validating the new profile_id.

### MongoDB Operator Injection

**PASS** — All query parameters go through Pydantic validation before reaching queries. String IDs are never interpolated into raw `$where` or `$regex` without `re.escape()`. No operator injection vectors observed.

### File Upload Validation

**PASS** — `backend/routers/expenses.py` attachment upload:

- MIME type detected via `python-magic` (`magic.from_buffer`), not trusting Content-Type header
- File size limit enforced
- Attachment count limit enforced
- Object key stored (not URL)

### Logic Bugs

**MEDIUM — Savings goal title/name field mismatch causing silent notification failure**  
File: `backend/routers/savings_goals.py` (line ~218)  
The push notification for goal milestones reads:

```python
goal_title = updated.get("name", "Your goal")
```

But the `SavingsGoal` model defines the field as `title`, not `name`. `updated.get("name")` always returns `None`, so the notification always uses the fallback string `"Your goal"` instead of the actual goal name.

**Fix:** Change to `updated.get("title", "Your goal")`.

### Dependency Security

**LOW — `passlib==1.7.4` is unmaintained**  
`passlib` has not had a release since 2023 and the project is effectively abandoned. While no critical CVEs exist, the lack of maintenance means bcrypt vulnerabilities would not be patched. Consider migrating to `bcrypt` directly or `argon2-cffi`.

**PASS** — `PyJWT==2.11.0`, `fastapi>=0.115.0`, `motor==3.3.1`: no known critical CVEs at time of audit.

### Secrets in Source

**PASS** — No hardcoded API keys, secrets, or credentials observed in any source file reviewed. All secrets are loaded from environment variables.

### Password Policy

**LOW — Minimum password length is 6 characters**  
File: `backend/deps.py` (line 44):

```python
if len(password) < 6:
    return False, "Password must be at least 6 characters"
```

NIST SP 800-63B recommends a minimum of 8 characters. Recommend increasing to at least 8.

### Rate Limiting

**PASS** — Sensitive endpoints are rate-limited:

- `POST /auth/login` → 10/minute
- `POST /auth/register` → 5/minute
- `POST /auth/google` → 20/minute
- `POST /auth/apple/login` → 20/minute
- `DELETE /auth/account` → 5/minute
- `POST /auth/logout` → 30/minute
- `POST /ai/chat-insights` → 10/minute

**MEDIUM** — `GET /invite/accept`, `POST /invite/accept` — no rate limit (see Rule 11 above).

### Exception Detail Leakage

**PASS** — All caught exceptions return generic error messages to the client (`"Registration failed"`, `"Login failed"`, etc.). Internal errors are logged server-side with full context. No stack traces or internal paths exposed in responses.

### Async Correctness

**PASS** — All `db.*` calls use `await`. FastAPI routes with async operations are declared `async def`. No synchronous blocking DB calls observed in the FastAPI async context.

### Web↔Mobile↔Backend Contract Drift

**CRITICAL** — As described in Rule 4 above, the mobile `AuthContext.tsx` expects `session_token` in the auth response body. The backend does not return it. This is a complete auth contract break for mobile.

**LOW** — Web `AuthContext.jsx` and mobile `AuthContext.tsx` implement different auth mechanisms:

- Web: relies on `withCredentials: true` + HttpOnly cookie (correct)
- Mobile: relies on `Authorization: Bearer <token>` header with token from SecureStore (correct architecture, but broken by missing response field)

**LOW — `TransactionsPage.jsx` category filter label mismatch (UI bug)**  
File: `web/src/pages/TransactionsPage.jsx` (lines 376–388)  
The first `<select>` element controlling `categoryFilter` has a label "All Payment Methods" but is populating and filtering by `paymentMethods`, while the second `<select>` controlling `paymentFilter` also shows "All Payment Methods" and uses `paymentMethods`. The first `<select>` controls `categoryFilter` but renders payment method options — this means the category filter is broken and the UI shows two payment method filters. A category filter dropdown should exist using `categories` data.

---

## Dead Code & Duplication Analysis

**Date updated:** 2026-08-02  
**Method:** Automated cross-reference analysis across all backend, web, and mobile source files. Every symbol verified via grep across full project tree.

### Corrected False Positive

A prior audit session flagged 9 dashboard-related endpoints as "dead code" (forecast, subscriptions/summary, dashboard/metrics, insights/overview, insights/recommendations, insights/v2, weekly-digest, weekly-digest/latest, savings-goals). **This was incorrect.** All 9 are actively imported and wired in `web/src/pages/DashboardPage.jsx` (lines 23–33) with complete loader → state → useEffect → component rendering chains. Verified 2026-08-02 via:

- Network tab: all 9 return HTTP 200 with data
- UI scroll-through: every corresponding card component renders

---

### Dead Code — Pages

**HIGH — `SAVIQDashboard.jsx` is an unreferenced 1009-line demo page**  
File: `web/src/pages/SAVIQDashboard.jsx`  
Route: `/preview` (`web/src/App.jsx` line 158) — no authentication required

This is a self-contained design prototype with 100% hardcoded mock data and zero API calls. No navigation link anywhere in the app points to `/preview`. It duplicates ~60% of DashboardPage.jsx's card types (summary stats, spending chart, smart metrics, recent transactions, category breakdown, budget progress) using inline mock data instead of real endpoints.

Additional concerns:

- Pulls in Three.js, React Three Fiber, and React Three Drei (3D rendering libraries) used nowhere else — significant bundle weight
- Uses its own inline color system and styles, diverged from the app's Tailwind/theme-aware tokens
- No test coverage

**Recommendation:** Remove entirely. If a design preview is needed, use Storybook or a separate tool rather than a production route.

---

### Dead Code — Models

**MEDIUM — `UserSettings` model never used**  
File: `backend/models.py` (line 137)

```python
class UserSettings(BaseModel):
    ...
```

Never imported or referenced in any router, service, or test file. `UserSettingsUpdate` (line 585) does NOT inherit from it — extends `BaseModel` independently. Fully dead.

**LOW — `AuthResponse` model imported but never used**  
File: `backend/models.py` (line 151)  
Import: `backend/routers/auth.py` (line 29)

Imported but never used as a `response_model`, type hint, or instantiated. All auth endpoints return raw dicts. The `session_token: str` field contradicts Rule 4 (cookie-only auth). Both the model and the import are vestigial.

---

### Dead Code — Functions & Config

**MEDIUM — `key_from_url()` in r2_service.py never called**  
File: `backend/services/r2_service.py` (lines 99–117)

Legacy migration helper for extracting R2 object keys from public URLs. `grep -rn 'key_from_url' backend/ web/ frontend/` returns only the definition. Never imported or called from any file.

**MEDIUM — `JWT_SECRET` config field never used**  
File: `backend/config.py` (lines 44–46)

Defined and validated on startup, but never referenced outside `config.py`. The app uses opaque session tokens (comment on line 44 confirms), not JWTs. The `pyjwt` usage in `auth.py` is for verifying Apple identity tokens with Apple's public keys, not signing with `JWT_SECRET`.

---

### Dead Code — API Client Functions (Web)

Three API functions defined in `web/src/services/api.js` are never called from any component or page:

| Function                    | File:Line    | Evidence                                                                      |
| --------------------------- | ------------ | ----------------------------------------------------------------------------- |
| `expensesAPI.getOne`        | `api.js:84`  | 0 references in `web/src/` outside `api.js`                                   |
| `statsAPI.getWeeklySummary` | `api.js:114` | 0 references in `web/src/` outside `api.js`                                   |
| `budgetsAPI.getAll`         | `api.js:141` | 0 references — pages use `.getProgress`, `.create`, `.update`, `.delete` only |
| `savingsGoalsAPI.getOne`    | `api.js:174` | 0 references — pages use `.getAll` only                                       |
| `billsAPI.fromSubscription` | `api.js:222` | 0 references in `web/src/` outside `api.js`                                   |

Mobile (`frontend/src/services/api.ts`) also has 2 dead methods: `billsAPI.fromSubscription` and `budgetsAPI.getAll`.

---

### Dead Code — Mobile Components (259 lines removable)

| Component       | File                                        | Lines | Evidence                               |
| --------------- | ------------------------------------------- | ----- | -------------------------------------- |
| `ExpenseCard`   | `frontend/src/components/ExpenseCard.tsx`   | 180   | 0 imports from any screen or component |
| `ProfileToggle` | `frontend/src/components/ProfileToggle.tsx` | 79    | 0 imports anywhere                     |

Both files are completely orphaned — no screen references them.

---

### Dead Code — Frontend Utility Exports

**9 dead exports in `web/src/lib/utils.js`:** `formatTime`, `calculatePercentage`, `getInitials`, `groupByDate`, `SHARED_CATEGORY_ICON_MAP`, `CATEGORY_COLORS`, `PAYMENT_TYPES`, `TRANSACTION_COLORS`, `THEME` — all have 0 references outside utils.js.

**7 dead exports in `shared/utils/index.ts`:** `formatTimeFromNumbers`, `getDateRangeForPeriod`, `getMonthStart`, `getWeekStart`, `clamp`, `debounce`, `isValidEmail`.

**3 dead exports in `shared/constants/index.ts`:** `BUDGET_PERIODS`, `RECURRING_FREQUENCIES`, `APP_CONFIG`.

**2 dead exports in mobile `ThemeContext.tsx`:** `lightColors`, `darkColors` — exported but never imported.

**1 dead utility file:** `frontend/src/utils/format.ts` (10 lines) — re-exports from shared, only consumer was dead `ExpenseCard.tsx`.

---

### Dead Code — Unused Frontend Imports (12 total)

| File                        | Import                                          | Notes                                  |
| --------------------------- | ----------------------------------------------- | -------------------------------------- |
| `AnalyticsPage.jsx:8-9`     | `AreaChart`, `Area` from recharts               | Only `PieChart`/`BarChart` used        |
| `BillsPage.jsx:2`           | `useNavigate` from react-router-dom             | Assigned but `navigate()` never called |
| `BillsPage.jsx:5`           | `ChevronRight` from lucide-react                | Never in JSX                           |
| `BudgetsPage.jsx:4`         | `AlertCircle`, `CheckCircle2` from lucide-react | Never in JSX                           |
| `LoginPage.jsx:4`           | `Input`, `Card` from components/ui              | Raw `<input>` and no `<Card>` used     |
| `AddTransactionModal.jsx:2` | `Input`, `Select` from ./ui                     | Raw elements used instead              |
| `Layout.jsx:12`             | `X` from lucide-react                           | Never in JSX                           |
| `more.tsx:32` (mobile)      | `invitesAPI` from services/api                  | Never called                           |

---

### Dead Code — CSS

**LOW — `.animate-slide-up` in `web/src/index.css` (line 74)** — 0 references in any JSX/JS file.

**Recommendation:** Remove dead components, exports, and imports. Estimated ~300 lines of dead code removable from frontends.

---

### Dead Code — Backend Routes (3 endpoints)

Three backend endpoints are fully implemented but never called from any frontend (web or mobile):

| Endpoint                                               | Router File:Line       | Notes                                                                                                                                      |
| ------------------------------------------------------ | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `GET /api/expenses/{expense_id}`                       | `expenses.py:290`      | Single-expense fetch. Web defines `expensesAPI.getOne` but no component calls it. Both frontends use list endpoint and filter client-side. |
| `GET /api/expenses/{expense_id}/attachments/{key}/url` | `expenses.py:561`      | Presigned download URL endpoint. Not defined in any API service file. Frontends use upload/delete but never request download URLs.         |
| `GET /api/savings-goals/{goal_id}`                     | `savings_goals.py:158` | Single-goal fetch. Web defines `savingsGoalsAPI.getOne` but no component calls it. Both frontends use list endpoint.                       |

All three are within otherwise-active routers. No entire router is dead. These were likely built for future use or became orphaned as frontends evolved toward list-based patterns.

---

### Dead Code — Unused Imports (10 total)

| File                               | Line | Import                                | Severity |
| ---------------------------------- | ---- | ------------------------------------- | -------- |
| `backend/deps.py`                  | 1    | `import os`                           | LOW      |
| `backend/services/push_service.py` | 10   | `import asyncio`                      | LOW      |
| `backend/routers/profiles.py`      | 11   | `ProfileMemberInfo` from `models`     | MEDIUM   |
| `backend/routers/profiles.py`      | 12   | `ProfileMemberResponse` from `models` | MEDIUM   |
| `backend/routers/profiles.py`      | 13   | `ProfileMemberRole` from `models`     | MEDIUM   |
| `backend/routers/push.py`          | 4    | `HTTPException` from `fastapi`        | LOW      |
| `backend/routers/auth.py`          | 29   | `AuthResponse` from `models`          | LOW      |
| `backend/routers/bills.py`         | 4    | `import asyncio`                      | LOW      |
| `backend/routers/bills.py`         | 11   | `Query` from `fastapi`                | LOW      |
| `backend/routers/budgets.py`       | 2    | `import uuid`                         | LOW      |

---

### Duplication — Date Utility Functions

**HIGH — `_month_start()` defined 4 times (identical logic)**

| File                                      | Line |
| ----------------------------------------- | ---- |
| `backend/routers/analytics.py`            | 21   |
| `backend/routers/insights.py`             | 13   |
| `backend/services/forecast_service.py`    | 15   |
| `backend/services/insights_v2_service.py` | 14   |

All four implementations: `dt.replace(day=1, hour=0, minute=0, second=0, microsecond=0)`

**HIGH — `_add_months()` defined 3 times (identical logic)**

| File                                      | Line |
| ----------------------------------------- | ---- |
| `backend/routers/analytics.py`            | 25   |
| `backend/routers/insights.py`             | 17   |
| `backend/services/insights_v2_service.py` | 18   |

All three implementations use the same year/month arithmetic.

Additionally, `backend/routers/ai.py` (lines 83–87) implements the same month-start logic inline without extracting it to a helper.

**Recommendation:** Extract `_month_start()` and `_add_months()` into a shared `backend/utils/date_helpers.py` module. Import from there in all 5 files.

---

### Duplication — Date Range Parsing

**MEDIUM — `_parse_date_range()` defined identically in 2 routers + inline variants in 2 more**

Function definitions (identical):

- `backend/routers/analytics.py` (line 31)
- `backend/routers/insights.py` (line 33)

Inline `datetime.fromisoformat(x.replace("Z", "+00:00"))` pattern (same logic, not extracted):

- `backend/routers/expenses.py` (lines 247, 254)
- `backend/routers/misc.py` (lines 76–78, 134–136)

All four use the same pattern: parse ISO date string, replace `Z` with `+00:00`, validate start < end.

**Recommendation:** Extract `_parse_date_range()` to `backend/utils/date_helpers.py` and import in all 4 routers.

---

### Duplication — Month-over-Month Spend Calculation

**LOW — Current vs previous month spend aggregation repeated across 3 routers**

The pattern of computing `current_month_start`, `prev_month_start`, filtering expenses by date range, and calculating percentage change appears in:

- `backend/routers/analytics.py` (lines 73–98)
- `backend/routers/insights.py` (lines 64–130)
- `backend/routers/ai.py` (lines 83–92)

Each implements the same filter-and-sum logic independently. Not a critical issue since the surrounding context differs, but the core date-bucketing could be shared.

---

### Duplication — Additional Patterns

**MEDIUM — `_ensure_owned()` CRUD ownership check duplicated**

- `backend/routers/budgets.py` (lines 46–56)
- `backend/routers/expenses.py` (lines 210–219)

Both do: find document by ID + user_id, raise 404 if missing, return doc. Identical logic.

**MEDIUM — `_to_float()` / numeric coercion defined 4 times**

- `backend/routers/dashboard_metrics.py` (lines 22–26)
- `backend/services/weekly_digest_service.py` (lines 43–48)
- `backend/services/chat_prompt_service.py` (lines 4–8)
- `backend/services/week13_metrics_service.py` (lines 6–15)

All variants convert a value to float with a fallback to 0.0.

**MEDIUM — Profile-scoped query branching repeated ~13 times**

The pattern of "if profile_id: query by profile_id; else: query by user_id" appears across `ai.py`, `insights.py` (2×), `net_worth.py` (2×), `savings_goals.py`, `budgets.py`, `bills.py`, `dashboard_metrics.py`, `weekly_digest.py`, and others. Could be a single `resolve_profile_query()` helper in `deps.py`.

**MEDIUM — Category name map construction repeated 8+ times**

The pattern `{c["category_id"]: c.get("name", "Uncategorized") for c in categories}` appears in `ai.py`, `insights.py` (2×), `analytics.py`, `dashboard_metrics.py`, `expenses.py`, `misc.py` (2×).

**MEDIUM — CRUD update/delete boilerplate repeated across 6 routers**

The find → validate-not-empty → set-updated_at → update_one pattern appears 9 times across `net_worth.py`, `savings_goals.py`, `bills.py`, `budgets.py`, `categories.py`, `profiles.py`. The matching delete boilerplate appears 6 times across 5 routers.

**LOW — `_days_in_month()` duplicated**

- `backend/routers/dashboard_metrics.py` (lines 29–32)
- `backend/services/forecast_service.py` (lines 21–24)

**LOW — `STATS_PROJECTION` constant duplicated**

- `backend/routers/ai.py` (line 26)
- `backend/routers/expenses.py` (line 29)

---

### Duplication — Recommended Refactoring

1. **Create `backend/utils/dates.py`**: `month_start()`, `add_months()`, `days_in_month()`, `parse_date_range()`, `parse_iso_datetime()`, `coerce_utc_datetime()`. Eliminates 20+ duplicate definitions across 8 files.

2. **Create `backend/utils/finance.py`**: `to_float()`, `to_spend_amount()`, `expense_totals_by_category()`, `sum_by_type()`, `resolve_budget_total()`, `pct_change()`. Consolidates ~25 patterns across 10+ files.

3. **Expand `backend/deps.py`**: `ensure_owned()`, `resolve_profile_query()`, `get_category_name_map()`. Reduces CRUD boilerplate across all router files.

---

### Duplication — Frontend Patterns

**MEDIUM — `getDateRangeParams()` copied verbatim between 2 pages**

- `web/src/pages/DashboardPage.jsx` (lines 142–163)
- `web/src/pages/TransactionsPage.jsx` (lines 103–118)

**MEDIUM — Date validation `useEffect` copied verbatim between 2 pages**

- `DashboardPage.jsx` (lines 126–140)
- `TransactionsPage.jsx` (lines 87–101)

**MEDIUM — `isMounted` ref boilerplate repeated in 6 pages**

- `DashboardPage`, `TransactionsPage`, `BudgetsPage`, `GoalsPage`, `NetWorthPage`, `AnalyticsPage`
- Same 5–6 line pattern each time. Extract: `useIsMounted()` hook.

**MEDIUM — Profile selector dropdown identical in 6 pages**

- `BudgetsPage`, `GoalsPage`, `NetWorthPage`, `AnalyticsPage`, `ExportPage`, `DashboardPage`
- Extract: `<ProfileSelector />` component.

**MEDIUM — Delete confirmation modal repeated in 4 pages**

- `TransactionsPage`, `SettingsPage`, `BudgetsPage`, `BillsPage`
- Extract: `<DeleteConfirmModal />` component.

**LOW — Full-page loading spinner repeated in 9 pages**

- All pages return identical `<div className="flex items-center justify-center h-64"><Spinner size="lg" /></div>`. Extract: `<PageLoadingSpinner />`.

**LOW — Error/success banner repeated across 7+ pages**

- Same red-50/green-50 banner markup. Extract: `<AlertBanner variant="error|success" />`.

**LOW — `formatCurrency` reimplemented locally in 6 mobile files**

- `stats.tsx`, `WeeklyDigestWidget.tsx`, `ForecastWidget.tsx`, `SubscriptionDetectionWidget.tsx`, `smartMetricsCards.js`, plus `SubscriptionsCard.jsx` (web) defines local `formatUsd()` instead of importing from `lib/utils`.
- `shared/utils/index.ts` already provides canonical `formatCurrency`.

---

## Summary Table

| Severity | Count | Area                                                                                                                                                                                                                                                                                                                                                                       |
| -------- | ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CRITICAL | 1     | Mobile auth contract mismatch (session_token never returned)                                                                                                                                                                                                                                                                                                               |
| HIGH     | 5     | Systematic `_ensure_profile_owned` for shared members; invite accept email bypass; missing `user_id` in expense query; SAVIQDashboard.jsx dead page (1009 lines); `_month_start`/`_add_months` defined 4×/3×                                                                                                                                                               |
| MEDIUM   | 25+   | Security: Rule 2, Rule 5, Rule 7, Rule 8, mass-assignment, rate limiting, ThemeContext. Dead code: `UserSettings` model, `key_from_url()`, `JWT_SECRET` config, 2 mobile components, 7 dead API methods, 21+ dead utility exports, 3 dead profile imports. Duplication: backend date/query/CRUD patterns (17 types), frontend date/mount/selector/modal patterns (7 types) |
| LOW      | 20+   | Dead code: `AuthResponse` model, 3 dead backend routes, 22 unused imports (10 backend + 12 frontend), dead CSS, dead mobile util file. Bugs: password min length, TransactionsPage filter, goal notification field name. Duplication: loading spinners, alert banners, `formatCurrency` reimplementations. Dependencies: passlib unmaintained                              |

---

## Prioritized Remediation

1. **CRITICAL** — Fix mobile auth: backend must return `session_token` in response body for mobile sign-in endpoints (or mobile must switch to cookie-based auth with `withCredentials`). Until fixed, all mobile sign-in is broken.

2. **HIGH** — Replace all local `_ensure_profile_owned` helpers in insights, ai, forecast, subscriptions, dashboard_metrics, weekly_digest, net_worth routers with `Depends(get_accessible_profile)` from deps.py.

3. **HIGH** — Fix invite accept email bypass: when `caller_email` is None, do not silently skip the email check. Block or fall back to `invited_user_id` comparison.

4. **HIGH** — Delete `web/src/pages/SAVIQDashboard.jsx` and its `/preview` route in `App.jsx`. Remove Three.js/R3F/Drei from `package.json` if unused elsewhere.

5. **HIGH** — Extract `_month_start()`, `_add_months()`, and `_parse_date_range()` into `backend/utils/date_helpers.py`. Replace all 4+3+4 = 11 duplicate definitions with imports.

6. **MEDIUM** — Fix `SavingsGoal` notification: change `updated.get("name", "Your goal")` to `updated.get("title", "Your goal")`.

7. **MEDIUM** — Fix `ThemeContext.jsx`: the `localStorage.getItem("session_token")` calls never find a value. Remove them; use `isAuthenticated`/`user` from `AuthContext` to gate the settings API call.

8. **MEDIUM** — Remove `profile_id` from `SavingsGoalUpdate` or validate the new profile_id is accessible to the caller.

9. **MEDIUM** — Add `@limiter.limit("20/minute")` to `GET /invite/accept` and `POST /invite/accept`.

10. **MEDIUM** — Rename `/insights/v2` endpoint and remove `schema_version: "v2"` from response payload.

11. **MEDIUM** — Delete dead backend code: `UserSettings` model (models.py:137), `key_from_url()` (r2_service.py:99-117), `JWT_SECRET` config (config.py:44-46), unused profile model imports (profiles.py:11-13).

12. **MEDIUM** — Delete dead mobile components: `ExpenseCard.tsx` (180 lines), `ProfileToggle.tsx` (79 lines), `utils/format.ts` (10 lines).

13. **MEDIUM** — Extract shared frontend patterns: `useIsMounted()` hook, `<ProfileSelector />`, `<DeleteConfirmModal />`, `getDateRangeParams()` utility.

14. **MEDIUM** — Clean up dead utility exports: 9 in `web/src/lib/utils.js`, 7 in `shared/utils/index.ts`, 3 in `shared/constants/index.ts`.

15. **LOW** — Fix `TransactionsPage.jsx`: first filter `<select>` should display categories, not payment methods.

16. **LOW** — Remove `AuthResponse` model from `models.py` and its import from `auth.py`.

17. **LOW** — Remove 7 dead API functions: 5 in `web/src/services/api.js`, 2 in `frontend/src/services/api.ts`.

18. **LOW** — Remove or document 3 dead backend routes: `GET /expenses/{id}`, `GET /expenses/{id}/attachments/{key}/url`, `GET /savings-goals/{id}`.

19. **LOW** — Clean up 22 unused imports across backend (10) and frontend (12) files.

20. **LOW** — Fix mobile `formatCurrency` reimplementations — import from `shared/utils` instead of defining locally in 6 files.

21. **LOW** — Increase minimum password length to 8 characters.

22. **LOW** — Add `max_length` to all unbounded Pydantic string fields.

23. **LOW** — Consider replacing `passlib` with actively-maintained `bcrypt` or `argon2-cffi`.
