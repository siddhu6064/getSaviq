import test from "node:test";
import assert from "node:assert/strict";
import { deriveSpendComparisonInsight } from "./spendComparisonInsight.js";

test("spend comparison insight: spike takes top priority", () => {
  const insight = deriveSpendComparisonInsight({
    monthly: {
      anomalies: {
        total_spend_spike: { detected: true, severity: "critical", delta_percent: 42.5 },
      },
      budget_risk: { status: "ok", severity: "critical", current_spend: 900, budget_amount: 1000 },
    },
  });
  assert.equal(insight.title, "Spending spike");
  assert.equal(insight.severity, "critical");
});

test("spend comparison insight: budget pressure when no spike", () => {
  const insight = deriveSpendComparisonInsight({
    monthly: {
      budget_risk: { status: "ok", severity: "warning", current_spend: 800, budget_amount: 1000 },
    },
  });
  assert.equal(insight.title, "Budget pressure rising");
  assert.equal(insight.currentSpend, 800);
  assert.equal(insight.budgetAmount, 1000);
});

test("spend comparison insight: biggest category trend when no spike/budget signal", () => {
  const insight = deriveSpendComparisonInsight({
    monthly: {
      category_comparisons: [
        { category: "Dining", delta_percent: 12 },
        { category: "Travel", delta_percent: -35 },
      ],
    },
  });
  assert.equal(insight.title, "Travel trend down");
  assert.equal(insight.severity, "info");
});

test("spend comparison insight: falls back to overall trend", () => {
  const insight = deriveSpendComparisonInsight({ monthly: { delta_percent: 15 } });
  assert.equal(insight.title, "Spending is rising");
  assert.equal(insight.severity, "warning");
});

test("spend comparison insight: null when no signal present", () => {
  const insight = deriveSpendComparisonInsight({ monthly: {}, weekly: {} });
  assert.equal(insight, null);
});
