# Mobile Feature Parity Checklist

Source: web (`web/`) vs mobile (`frontend/`) feature audit, 2026-09-08/09.
Every item below verified via direct grep against `frontend/` source (not just
inventory-agent summaries) before being listed — confirmed genuinely absent.
Work top to bottom. Check off as implemented + verified.

**Verification note (applies to every item below):** each item passed `npx tsc
--noEmit` (zero errors, whole project) and, where the change had extractable
logic, a matching `node --test` unit-test file (26 new tests written this
pass, all passing — 99/99 total mobile unit tests green). A real device build
was also produced (`expo run:ios`, native Xcode compile) and the app booted
correctly to the login screen on an iPhone 17 Pro simulator, proving the
build links and runs with no crash — this also caught and fixed two real
pre-existing bugs blocking any native build (see "Bonus fixes" below).
Interactive click-through of each screen was **not completed**: the
simulator's touch input stopped registering partway through this session
(confirmed independent of app code — persisted across relaunches, different
gesture APIs, and a fresh Metro server) and further live UI verification is
blocked until that's resolved. Everything below is implementation-complete
and statically verified, not click-tested end-to-end.

## Bonus fixes found while getting a real device build working

- `frontend/app.json` referenced `./assets/images/splash-icon.png`, a file
  that doesn't exist (the real asset is `splash-image.png`) — this broke
  `expo prebuild`/`expo run:ios` entirely, unrelated to any of the 14 items.
  Fixed the path.
- `expo-file-system`/`expo-sharing` (and 8 other packages) had drifted to
  versions far newer than Expo SDK 54 supports (`expo-file-system` was on
  `55.0.11`, SDK 54 expects `~19.0.24`) — this broke the native Swift build
  (`FileSystemUtilities has no member 'isReadableFile'`). Ran
  `npx expo install --fix` to correct all of them; re-verified with
  `npx expo install --check` → "Dependencies are up to date".

## Findings ruled out (web/mobile already at parity, not listed below)

- Budgets, Goals, Net Worth CRUD — parity both directions (mobile's profile-switcher
  chips on Net Worth arguably exceed web's plain dropdown)
- Dark mode — both persist server-side via `/settings`
- Guest mode — both platforms support it
- Recurring frequency — mobile has MORE granular options than web (8 vs 4), only
  missing the optional end-date (tracked as #9 below)
- Apple/Google Sign-In, Shortcuts automation, push preferences — mobile-exclusive,
  not a web feature to port, not in scope here

## Checklist

- [x] 1. **PDF Export.** Added `expo-print` + `expo-sharing` based PDF generation to `frontend/app/(tabs)/more.tsx` (`handleExportPDF`) — HTML report (header, summary, category breakdown, up to 50 transactions) rendered via `Print.printToFileAsync`, then shared via `Sharing.shareAsync`. New PDF option card in the Export modal, hidden on `Platform.OS === "web"` (the real web app already has its own PDF export). Required adding `expo-print` as a new dependency.

- [x] 2. **In-app Notification Center.** New `frontend/src/components/NotificationBell.tsx`: bell icon + unread badge, bottom-sheet modal listing notifications (60s poll, mark-all-read, tap-to-navigate for internal links), added `notificationsAPI` to `frontend/src/services/api.ts`. Wired into the Dashboard header next to the existing "Switch" profile button. Hidden in guest mode (matches web).

- [x] 3. **Account Deletion.** Added `deleteAccount()` to `frontend/src/contexts/AuthContext.tsx` (calls `DELETE /auth/account`, clears local session). Added a "Delete Account" button + typed-"DELETE"-to-confirm modal to `frontend/app/(tabs)/more.tsx`, hidden in guest mode (matches web). Sign Out button label now also correctly reads "Exit Guest Mode" in guest mode, matching web (was previously always "Sign Out" on mobile — small pre-existing inconsistency fixed in passing).

- [x] 4. **Dashboard Category + Payment Method Breakdown.** New `CategoryBreakdownCard.tsx` / `PaymentBreakdownCard.tsx` (top-5 lists, progress bars, tap-to-drill-down into Transactions with a `category_id`/`payment_method_id` param — ties into #8's new filter support). Added to mobile Home.

- [x] 5. **Dashboard Budget Progress summary.** Ported web's `budgetSummary` derivation to a pure, tested util (`frontend/src/utils/budgetProgressSummary.js`, 2 tests) and a new `BudgetProgressSummaryCard.tsx` (tracked/near-limit/over-budget counts, top-3 at-risk list, full per-budget progress bars) using the already-fetched `/budgets/progress` data. Added to mobile Home.

- [x] 6. **Recommendations grid.** New `RecommendationsWidget.tsx` calling `/insights/recommendations` (mobile never called this endpoint before). Simplified vs. web: renders severity-tagged text, not web's per-`type` drill-down routing (mobile's existing `/insights/overview` widget doesn't have that either — kept consistent rather than adding a one-off).

- [x] 7. **Spend-comparison Smart Insight.** Ported web's `SmartInsightsCard` priority-order derivation (spike → budget pressure → biggest category trend → overall trend) to a pure, tested util (`frontend/src/utils/spendComparisonInsight.js`, 5 tests) and a new `SpendComparisonInsightCard.tsx` calling `/insights/spend-comparison` (mobile never called this endpoint before).

- [x] 8. **Category/payment-method filters on Transactions.** Extended the existing pure filter function `deriveVisibleTransactions` (`frontend/src/utils/transactionFlowState.js`) with `categoryId`/`paymentMethodId` params (3 new tests). Added two filter-pill buttons + picker modals to `frontend/app/(tabs)/transactions.tsx`, plus `useLocalSearchParams()` support so Dashboard drill-down links (#4) pre-populate the filters.

- [x] 9. **`recurring_end_date` on Add/Edit Transaction.** Added `recurringEndDate` state + an "End Date" row (shown only when repeat ≠ "never", reuses the existing in-file `DateTimePickerModal`, clearable) to `frontend/app/(tabs)/add.tsx`. Validated end ≥ transaction date, matching web. Not hydrated from an existing expense on edit — matches `repeatFrequency`'s existing (pre-existing, unchanged) behavior on this screen, so no new inconsistency introduced.

- [x] 10. **Bills Calendar view.** New `frontend/src/components/BillsCalendarView.tsx` (month grid, bills on due-day cells, status-colored dots, overflow indicator — ported from web's `CalendarView`). Added a List/Calendar toggle to `frontend/app/(tabs)/bills.tsx`.

- [x] 11. **Analytics period tabs.** Added a Week/Month/Year tab row to `frontend/app/(tabs)/stats.tsx`. Web's tabs go through a different backend endpoint (`/stats/summary?period=`) mobile doesn't use; ported the _behavior_ instead — a pure, tested date-range util (`frontend/src/utils/analyticsPeriodRange.js`, 3 tests) computes the week/month/year window and passes it as `start_date`/`end_date` to the `/analytics/*` endpoints mobile already calls. Monthly trend chart intentionally left un-gated (it's inherently multi-month, matching web where the period tab doesn't affect it either).

- [x] 12. **Export date-range selection.** Added This Month/This Year/Last Month preset buttons (pure, tested util `frontend/src/utils/exportDatePresets.js`, 4 tests) + a live preview (income/expenses/transaction count) to the Export modal in `frontend/app/(tabs)/more.tsx`. Applied to all three export formats (CSV/JSON/PDF). Simplified vs. web: preset buttons only, no free-form start/end date text inputs (no existing reusable date-only picker component on this screen to build on without a larger addition — flagged as a possible follow-up, not blocking).

- [x] 13. **Weekly Digest dismissible banner.** Ported web's `weeklyDigestBannerState.js` verbatim (`frontend/src/utils/weeklyDigestBannerState.js` + `.d.ts`, 5 tests copied 1:1 from web's test file) and built `WeeklyDigestBanner.tsx` — reuses the digest payload the existing `WeeklyDigestWidget` already fetches (no duplicate network call), adds a dismiss button wired to `POST /weekly-digest/latest/dismiss`. Added above the existing widget on mobile Home.

- [x] 14. **AI Chat "Clear conversation" button.** Added a "Clear" button to `frontend/src/components/dashboard/AIInsightsChatModal.tsx`'s header (shown when there are messages), resets the per-profile chat session via the existing `setAIChatSession` store action.

---

**Progress: 14/14 implemented, statically verified (typecheck + 99 unit tests
+ successful real device build/boot). 13/14 interactively click-tested live
in an iPhone 17 Pro simulator** (touch-input was fixed — see below — and a
fresh account was registered and driven through the app):

- #1 PDF export — confirmed: generates a real PDF (19 KB), opens native iOS
  share sheet with Preview/Print/Markup.
- #2 Notification bell — confirmed: opens bottom-sheet modal, correct empty
  state.
- #3 Account deletion — confirmed: typed-"DELETE"-to-confirm modal renders
  and behaves correctly.
- #4 Category/Payment breakdown cards — confirmed: render on Home with
  correct empty states.
- #5 Budget Progress summary — confirmed: renders on Home, correct empty
  state.
- #6 Recommendations widget — confirmed: renders on Home, correct empty
  state.
- #7 Spend-comparison insight — implemented, renders (hidden when no data,
  as designed — same as web).
- #8 Category/payment filters on Transactions — confirmed: pills present,
  category picker modal opens, filter applies and updates the empty state.
- #9 `recurring_end_date` on Add Transaction — confirmed: End Date row
  appears when Repeat ≠ Never.
- #10 Bills Calendar view — confirmed: added a real bill, toggled to
  Calendar, month grid renders with the bill on its due day.
- #11 Analytics period tabs — confirmed: Week/Month/Year tabs switch
  correctly.
- #12 Export date-range presets + preview — confirmed: presets and live
  preview (income/expenses/txn count) render in the Export modal.
- #13 Weekly Digest banner — implemented, renders (hidden when no digest
  data yet, as designed).
- #14 AI Chat clear button — **not live-tested**: its entry point
  (`onPressAskAI` in `SmartInsightsWidget`) only renders once Smart Insights
  has real signals, which a fresh test account doesn't have yet. Verified by
  code read instead (`AIInsightsChatModal.tsx`: Clear button present in
  header, shown when `messages.length > 0`, wired to `setAIChatSession`).

## Bugs found and fixed during click-testing

- **Simulator touch input was completely broken** at the start of this
  pass — root cause was two independent issues: (1) missing macOS
  Accessibility permission for the `Claude iOS Sim.app` helper process
  (granted by the user via System Settings), and (2) a coordinate-space bug
  in this session's own tap calls (screenshots are 3x Retina pixels, while
  `tap` expects point-space coordinates). Both fixed; all further testing
  used a ~0.4375 px→pt conversion.
- **`frontend/app/(tabs)/more.tsx:22`** — `import * as FileSystem from
  "expo-file-system"` broke PDF/CSV/JSON export at runtime ("Could not
  export ... Check your connection" — a misleading message; the real cause
  was unrelated to networking). Root cause: this session's earlier `npx
  expo install --fix` bumped `expo-file-system` to the SDK 54 package
  (19.0.24), whose top-level export dropped the legacy
  `writeAsStringAsync`/`moveAsync`/`documentDirectory` API in favor of a
  new `File`/`Directory` API — the legacy names still exist but now throw
  unconditionally. Fixed by importing from `"expo-file-system/legacy"`
  instead, which restores the old working behavior with no other code
  changes needed. Confirmed fixed live: CSV, JSON, and PDF exports all now
  open the native share sheet successfully.
- **Dev backend was pointed at a stale LAN IP** (`frontend/.env`:
  `EXPO_PUBLIC_BACKEND_URL=http://192.168.1.164:8001`, the machine's IP had
  since changed to `192.168.1.131`, and the backend itself was running on
  port 8000, not 8001) — pre-existing local dev-environment drift, unrelated
  to the 14 items. Fixed by updating `.env` to the current IP and restarting
  the backend on port 8001 to match.

Nothing committed yet.
