// Port of web's Dashboard `budgetSummary` derivation.
export function deriveBudgetProgressSummary(budgetProgress) {
  const items = [...(budgetProgress?.budgets || [])];
  if (budgetProgress?.total_budget) items.unshift(budgetProgress.total_budget);

  const total = items.length;
  const over = items.filter((b) => b.is_over_budget).length;
  const near = items.filter((b) => !b.is_over_budget && (b.percentage || 0) >= 80).length;
  const topRisk = [...items]
    .filter((b) => (b.percentage || 0) >= 80)
    .sort((a, b) => (b.percentage || 0) - (a.percentage || 0))
    .slice(0, 3);

  return { items, total, over, near, topRisk };
}
