import test from "node:test";
import assert from "node:assert/strict";
import { deriveBudgetProgressSummary } from "./budgetProgressSummary.js";

test("budget progress summary: counts near/over and picks top-3 at-risk", () => {
  const summary = deriveBudgetProgressSummary({
    total_budget: { budget_id: "b0", percentage: 60, is_over_budget: false },
    budgets: [
      { budget_id: "b1", category_id: "cat_food", percentage: 105, is_over_budget: true },
      { budget_id: "b2", category_id: "cat_travel", percentage: 82, is_over_budget: false },
      { budget_id: "b3", category_id: "cat_bills", percentage: 40, is_over_budget: false },
      { budget_id: "b4", category_id: "cat_fun", percentage: 90, is_over_budget: false },
    ],
  });

  assert.equal(summary.total, 5);
  assert.equal(summary.over, 1);
  assert.equal(summary.near, 2);
  assert.deepEqual(
    summary.topRisk.map((b) => b.budget_id),
    ["b1", "b4", "b2"],
  );
});

test("budget progress summary: handles no budgets", () => {
  const summary = deriveBudgetProgressSummary({ budgets: [], total_budget: null });
  assert.equal(summary.total, 0);
  assert.equal(summary.over, 0);
  assert.equal(summary.near, 0);
  assert.deepEqual(summary.topRisk, []);
});
