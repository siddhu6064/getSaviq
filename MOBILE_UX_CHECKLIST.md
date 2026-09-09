# Mobile UX Improvement Checklist

Source: UX review of mobile screenshots (dashboard, bills, automation, add-expense),
2026-09-09. Each item verified live in an iOS simulator after implementation.
Work top to bottom. Check off as implemented + verified.

## Checklist

- [x] 1. **Dock overload — 8 tabs down to 5.** `frontend/app/(tabs)/_layout.tsx` shows
     Home / Trans. / Analyt… / Budg… / Goals / Bills / Net W… / More — 4 of 8 labels
     truncate. Reduce visible dock tabs to Home, Transactions, Bills, More, plus a
     centered raised Add button (replacing the floating FAB that currently overlaps
     dock/content). Analytics, Budgets, Goals, and Net Worth move off the dock but
     stay 1-tap reachable via Home's quick-actions row and a new "Quick Links"
     section on the More screen.

- [x] 2. **FAB placement conflict.** The floating "+" is absolute-positioned
     bottom-right and overlaps dock icons/toasts in several screens. Fixed by #1
     (Add becomes a proper centered dock slot, raised above the bar).

- [x] 3. **Automation list — inconsistent row affordances.** In
     `frontend/app/(tabs)/more.tsx`, the Apple Pay / Google Pay rows show both a
     "Set Up" pill button AND a chevron that do the same thing (open the same
     guide). Drop the redundant chevron on rows that already have an action pill;
     keep chevron-only for plain navigation rows (Quick Add from Notifications);
     keep toggle-only for preference rows (Weekly Summary, Daily Reminder).

- [x] 4. **Add Expense form — too much scroll for a "log it fast" action.**
     `frontend/app/(tabs)/add.tsx` stacks Type → Amount → Note → Category → Sheet →
     Date → Time → Pending → Repeat → End Date → Add Image → Save. Collapse
     Date/Time/Pending/Repeat/End Date/Add Image behind an "Advanced" disclosure
     (collapsed by default, defaults still applied — today's date/time, not
     pending, no repeat), so the default view is Amount + Note + Category + Sheet +
     Save.

---

**Progress: 4/4 — all implemented and confirmed live in an iPhone 17 Pro simulator.**
