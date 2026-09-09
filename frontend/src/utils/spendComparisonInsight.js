function formatDeltaPercent(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return "0.0%";
  return `${parsed >= 0 ? "+" : ""}${parsed.toFixed(1)}%`;
}

// Port of web's SmartInsightsCard `summary` derivation — priority order:
// spending spike > budget pressure > biggest category trend > overall trend.
export function deriveSpendComparisonInsight(payload) {
  const weekly = payload?.weekly || {};
  const monthly = payload?.monthly || {};

  const weeklySpike = weekly?.anomalies?.total_spend_spike;
  const monthlySpike = monthly?.anomalies?.total_spend_spike;
  const spike =
    (monthlySpike?.detected && monthlySpike) || (weeklySpike?.detected && weeklySpike) || null;

  const budgetRisk = monthly?.budget_risk;
  const budgetMeaningful =
    budgetRisk?.status === "ok" && ["warning", "high", "critical"].includes(budgetRisk?.severity);

  const trendPercent = Number(monthly?.delta_percent || weekly?.delta_percent || 0);
  const trendPeriod = Number(monthly?.delta_percent || 0) !== 0 ? "month" : "week";
  const categoryComparisons = Array.isArray(monthly?.category_comparisons)
    ? monthly.category_comparisons
    : [];

  const bestCategoryTrend = [...categoryComparisons]
    .filter((item) => item && typeof item.category === "string")
    .map((item) => ({ category: item.category, deltaPercent: Number(item.delta_percent || 0) }))
    .filter((item) => Number.isFinite(item.deltaPercent) && item.deltaPercent !== 0)
    .sort((a, b) => {
      const byAbs = Math.abs(b.deltaPercent) - Math.abs(a.deltaPercent);
      if (byAbs !== 0) return byAbs;
      return a.category.localeCompare(b.category);
    })[0];

  if (spike) {
    return {
      title: "Spending spike",
      severity: spike.severity || "warning",
      body: `Spend is up ${Math.abs(Number(spike.delta_percent || 0)).toFixed(1)}% vs last period.`,
      badgeText: `Overspending ${formatDeltaPercent(spike.delta_percent)}`,
    };
  }

  if (budgetMeaningful) {
    return {
      title: "Budget pressure rising",
      severity: budgetRisk.severity,
      body: null,
      currentSpend: Number(budgetRisk.current_spend || 0),
      budgetAmount: Number(budgetRisk.budget_amount || 0),
      badgeText: null,
    };
  }

  if (bestCategoryTrend) {
    const isUp = bestCategoryTrend.deltaPercent > 0;
    return {
      title: `${bestCategoryTrend.category} trend ${isUp ? "up" : "down"}`,
      severity: isUp ? "warning" : "info",
      body: `${formatDeltaPercent(bestCategoryTrend.deltaPercent)} vs last month. ${isUp ? "Set a cap to stay on track." : "Maintain this pace to protect margin."}`,
      badgeText: `${bestCategoryTrend.category} ${formatDeltaPercent(bestCategoryTrend.deltaPercent)}`,
    };
  }

  if (trendPercent !== 0) {
    return {
      title: trendPercent > 0 ? "Spending is rising" : "Spending is easing",
      severity: trendPercent > 10 ? "warning" : "info",
      body: `${Math.abs(trendPercent).toFixed(1)}% ${trendPercent > 0 ? "higher" : "lower"} vs last ${trendPeriod}.`,
      badgeText: null,
    };
  }

  return null;
}
