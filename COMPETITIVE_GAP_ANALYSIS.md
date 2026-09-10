# Competitive Gap Analysis

SAVIQ feature audit (grounded in code — `backend/routers/*.py`, `backend/models.py`,
web/mobile source) vs. Monarch Money, Copilot Money, YNAB, Rocket Money, Empower
Personal Dashboard, Quicken Simplifi, PocketGuard. Web-researched 2026-09-09.

## The one gap that matters most

**No bank/institution linking.** Confirmed by grep across the whole repo — zero
Plaid/Teller/aggregator integration. Every transaction is manual entry or an
AI-scanned receipt photo. README already tracks this: "Bank sync (Teller) —
Parked, add after first paying subscriber." Every competitor above leads with
automatic bank sync (Monarch: 13,000+ institutions; Copilot: Plaid + direct
Venmo/Apple Card/Coinbase). This is the single biggest reason a user would
churn to a competitor — manual entry has real drop-off for daily-use finance
apps. Everything below is secondary to this.

## Gaps, ranked by impact

| #   | Gap                                                  | Who has it                                                            | Notes                                                                                                                                                                                                                                            |
| --- | ---------------------------------------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | Bank/account aggregation (Plaid/Teller)              | Monarch, Copilot, YNAB, Rocket Money, Empower, Simplifi — all of them | See above. Unlocks #2–#5 below too.                                                                                                                                                                                                              |
| 2   | Investment/brokerage holdings tracking               | Monarch, Empower, Copilot                                             | SAVIQ's Net Worth is manual assets/liabilities only (e.g. "home," "car loan") — no holdings, cost basis, or portfolio allocation view. Empower's fee analyzer (flags expensive 401k funds) is a notable differentiator with no SAVIQ equivalent. |
| 3   | Credit score monitoring                              | Rocket Money, Empower                                                 | Not present in SAVIQ at all.                                                                                                                                                                                                                     |
| 4   | Bill negotiation / subscription cancellation service | Rocket Money, PocketGuard                                             | Needs bank sync as a prerequisite. SAVIQ detects recurring subscriptions (read-only) but can't act on them.                                                                                                                                      |
| 5   | Debt payoff planning (snowball/avalanche)            | Simplifi, PocketGuard, YNAB ecosystem                                 | No payoff-strategy calculator; net worth tracks liability balances but no payoff plan/timeline.                                                                                                                                                  |
| 6   | Forward-looking cash-flow calendar (up to 1 year)    | Simplifi ("Projected Cash Flow")                                      | SAVIQ's forecast is 7/30-day only (`forecast.py`), not a full calendar view of projected balances against upcoming bills/income.                                                                                                                 |
| 7   | CSV/OFX transaction import                           | Most competitors (even without bank sync, as a fallback)              | SAVIQ only exports (CSV/JSON/PDF) — no bulk import path exists, so switching _into_ SAVIQ from another tool means re-entering everything by hand.                                                                                                |
| 8   | Zero-based / envelope budgeting method               | YNAB (its whole identity), Simplifi (supports as one mode)            | SAVIQ budgets are category spending caps, not "give every dollar a job" allocation. Different budgeting philosophy, not just a missing toggle — would need a real design call.                                                                   |
| 9   | True multi-user/org collaboration with roles         | — (niche; not a focus for any of these consumer apps either)          | Lower priority. SAVIQ's `business` profile type is data partitioning only, not a role-based team account — README already flags this as roadmap.                                                                                                 |
| 10  | Biometric app lock (Face ID/Touch ID gate)           | Standard in nearly every finance app                                  | Confirmed absent — no `expo-local-authentication` dependency, no biometric gate on app open. This is a low-effort, high-expectation gap for a finance app specifically (users expect it even more than for a typical app).                       |
| 11  | Home-screen widgets / Apple Watch app                | Copilot, Monarch (widgets); several have watchOS companions           | Not present. Mobile's Shortcuts-based Apple Pay auto-fill is a clever partial substitute for quick-add, but isn't a widget.                                                                                                                      |
| 12  | Multi-currency (real conversion, not just a label)   | Monarch, YNAB (both support multi-currency households)                | `currency` is a free-text field per record (defaults "USD"), no exchange-rate conversion or multi-currency net worth rollup.                                                                                                                     |

## Smaller, cheaper-to-fix gaps (found during the audit, not competitor-driven)

- **Receipt image upload isn't wired into the transaction UI** even though the backend fully supports attachments (R2 storage, presigned URLs) — noted directly in the code as not yet connected.
- **Notifications are read-only from the client** — `GET /notifications` and mark-all-read only exist; no per-notification mark-read or delete/dismiss endpoint.
- **No password-reset or welcome email flow** — Resend is configured but unused for this (README Roadmap #2).
- **No transaction import**, covered above as #7, but worth flagging separately as a low-lift, high-goodwill fix even before full bank sync (a plain CSV importer would remove a lot of onboarding friction).

## Where SAVIQ is already ahead or at parity

Worth keeping in view so gap-closing work doesn't accidentally regress a real
strength:

- **AI receipt scanning** (vision model, degrades gracefully) — most budget-tier competitors (PocketGuard, Rocket Money) don't have this at all; it's usually a Monarch/Copilot-tier feature.
- **AI chat + insights + forecast**, all gated cleanly behind `ENABLE_AI_FEATURES` so core CRUD never depends on AI being up — comparable to Monarch's AI Assistant.
- **Profile isolation** (personal/business/shared) with invite-based shared access is more structured than most competitors' single-household model.
- **Bills auto-matching to expenses with variance alerts** — a genuinely nice touch not called out by name in any competitor's marketing.
- **Mobile is now at full feature parity with web** (see `MOBILE_PARITY_CHECKLIST.md`) plus a UX pass (see `MOBILE_UX_CHECKLIST.md`) — many competitors' mobile apps lag their web app; SAVIQ's don't.

## Suggested next move

Bank sync (#1) is the correct long-term priority but is explicitly parked
pending a paying subscriber (real cost/complexity tradeoff, not an oversight).
Until then, the highest goodwill-per-effort items are **#7 (CSV import)**,
**#10 (biometric lock)**, and the **notification mark-read/delete gap** — all
small, contained, and don't require a product-philosophy decision the way
zero-based budgeting (#8) would.
