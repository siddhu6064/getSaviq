# V2 Plan — Deferred from Competitive Gap Analysis

Everything from [`COMPETITIVE_GAP_ANALYSIS.md`](COMPETITIVE_GAP_ANALYSIS.md) not
picked up in [`V1.5_QUICK_WINS_CHECKLIST.md`](V1.5_QUICK_WINS_CHECKLIST.md), roughly
ordered by dependency and impact. None of this is started — this is a plan, not a
checklist yet.

## 1. Bank/account aggregation (Plaid or Teller)

The root gap — everything below except debt payoff and zero-based budgeting gets
meaningfully better once this exists. Already correctly parked in the README
pending a paying subscriber; real cost (per-connection fees) and integration
complexity (OAuth flow, webhook sync, transaction dedup against existing manual
entries). Should be scoped as its own project, not folded into a quick-win pass.

## 2. Investment/brokerage holdings tracking

Depends on #1 for automatic sync, but a manual-entry version (holdings, cost
basis, current value looked up via a market-data API) could ship independently —
extends the existing Net Worth assets model rather than replacing it.

## 3. Credit score monitoring

Needs a credit-bureau data provider (e.g. a soft-pull API). No existing hook in
the codebase; net-new integration.

## 4. Bill negotiation / subscription cancellation service

Hard-blocked on #1 — negotiating or cancelling a bill on the user's behalf
requires knowing the actual linked account/institution, not just a
user-typed bill name.

## 5. Debt payoff planning (snowball/avalanche)

Doesn't need #1. Can build on the existing Liabilities model (net worth) —
add a payoff-strategy calculator (extra payment amount → snowball vs. avalanche
order → payoff timeline/interest saved). Self-contained, good v2 candidate on
its own.

## 8. Zero-based/envelope budgeting mode

Not a missing endpoint so much as a different budgeting philosophy from what
SAVIQ's category-cap budgets do today. Needs a real product decision (add as an
alternate mode? replace category budgets? per-profile choice?) before any code —
flagged in the original gap analysis as needing a design call, not an
engineering estimate.

## 9. True multi-user/org roles

Lowest priority — niche even among competitors. SAVIQ's shared-profile invite
already covers the common "couple/household" case; role-based org accounts
(admin/member permissions, audit log) would only matter for a `business` profile
pivot toward small-business teams, which isn't the current product direction per
README ("business... not a full multi-user organization account model").

## 11. Home-screen widgets / Apple Watch app

Deliberately **not** in the v1.5 quick-win pass despite being on the original
gap list — this needs a native WidgetKit (iOS) / RemoteViews (Android) target,
which means Xcode project surgery (a new native target, App Group entitlement
for data sharing between app and widget, separate build/signing config) on top
of the Expo managed workflow. That's a materially different and riskier kind of
work than the JS/RN changes in v1.5, especially right after this session spent
real effort stabilizing the native build (splash asset path, `expo-file-system`
SDK version mismatch). Worth doing, but as its own scoped native-work session
with a fresh build/verification pass, not bundled into a "quick wins" batch.

## Smaller gaps (from the original analysis, still open)

- Receipt image upload wired into the transaction UI (backend already supports
  it — R2 storage, presigned URLs — just not connected to a camera/picker on the
  add-expense screen).
- Per-notification mark-read/delete (currently only mark-_all_-read exists).
- Password-reset / welcome email flow via Resend (configured, unused).

## Suggested v2 order

1. **Debt payoff planning (#5)** — self-contained, no dependency on bank sync,
   clear user value, reuses existing Liabilities data.
2. **Receipt upload UI wiring** — backend already done, this is a UI-only lift.
3. **Notification mark-read/delete** — small, completes a feature that's already
   half-built.
4. **Bank sync (#1)** — the big one, once there's a subscriber base to justify
   the integration cost, unlocking #2–#4 afterward.
5. **Widgets/Watch (#11)** and **zero-based budgeting (#8)** — both real projects
   in their own right; schedule independently once #1–#3 above are through.
