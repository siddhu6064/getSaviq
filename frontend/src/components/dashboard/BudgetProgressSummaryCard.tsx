import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { NeumorphicCard, lightTheme } from "../NeumorphicUI";
import { useTheme } from "../../contexts/ThemeContext";
import { budgetsAPI } from "../../services/api";
import { formatCurrency as _formatCurrency } from "@shared/utils";
import { deriveBudgetProgressSummary } from "../../utils/budgetProgressSummary";

interface Props {
  profileId?: string;
  categoryNameById?: Record<string, string>;
}

export function BudgetProgressSummaryCard({ profileId, categoryNameById = {} }: Props) {
  const { colors } = useTheme();
  const [budgetProgress, setBudgetProgress] = useState<any>({ budgets: [], total_budget: null });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!profileId) {
      setBudgetProgress({ budgets: [], total_budget: null });
      setIsLoading(false);
      return;
    }
    let cancelled = false;
    setIsLoading(true);
    setError("");
    budgetsAPI
      .getProgress(profileId)
      .then((res) => {
        if (cancelled) return;
        setBudgetProgress(res.data || { budgets: [], total_budget: null });
        setIsLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setError("Could not load budget progress.");
        setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [profileId]);

  const summary = deriveBudgetProgressSummary(budgetProgress);

  const labelFor = (item: any) =>
    item.category_id ? categoryNameById[item.category_id] || "Category" : "Total Budget";

  return (
    <NeumorphicCard style={styles.card}>
      <View style={styles.header}>
        <Ionicons name="alert-circle-outline" size={18} color={colors.warning} />
        <Text style={[styles.title, { color: colors.textPrimary }]}>Budget Progress</Text>
      </View>

      {isLoading ? (
        <ActivityIndicator size="small" color={colors.primary} />
      ) : error ? (
        <Text style={[styles.helper, { color: colors.expense }]}>{error}</Text>
      ) : summary.total === 0 ? (
        <Text style={[styles.helper, { color: colors.textSecondary }]}>
          No budgets configured for this profile yet.
        </Text>
      ) : (
        <View>
          <View style={styles.statsRow}>
            <View style={[styles.statBox, { backgroundColor: colors.surfaceHover }]}>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Tracked</Text>
              <Text style={[styles.statValue, { color: colors.textPrimary }]}>{summary.total}</Text>
            </View>
            <View style={[styles.statBox, { backgroundColor: colors.warning + "1A" }]}>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Near Limit</Text>
              <Text style={[styles.statValue, { color: colors.warning }]}>{summary.near}</Text>
            </View>
            <View style={[styles.statBox, { backgroundColor: colors.expense + "1A" }]}>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Over Budget</Text>
              <Text style={[styles.statValue, { color: colors.expense }]}>{summary.over}</Text>
            </View>
          </View>

          {summary.topRisk.length > 0 && (
            <View style={styles.topRiskSection}>
              <Text style={[styles.topRiskLabel, { color: colors.textPrimary }]}>
                Top at-risk categories
              </Text>
              {summary.topRisk.map((item: any, idx: number) => (
                <View
                  key={`${item.budget_id}-${idx}`}
                  style={[
                    styles.topRiskRow,
                    {
                      backgroundColor: item.is_over_budget
                        ? colors.expense + "1A"
                        : colors.warning + "1A",
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.topRiskText,
                      { color: item.is_over_budget ? colors.expense : colors.warning },
                    ]}
                  >
                    {labelFor(item)}
                  </Text>
                  <Text
                    style={[
                      styles.topRiskPercent,
                      { color: item.is_over_budget ? colors.expense : colors.warning },
                    ]}
                  >
                    {(item.percentage || 0).toFixed(1)}%
                  </Text>
                </View>
              ))}
            </View>
          )}

          <View style={styles.progressSection}>
            {summary.items.map((item: any) => {
              const percent = Math.max(0, Math.min(100, item.percentage || 0));
              const barColor = item.is_over_budget
                ? colors.expense
                : percent >= 80
                  ? colors.warning
                  : colors.income;
              return (
                <View key={item.budget_id} style={styles.progressRow}>
                  <View style={styles.progressTop}>
                    <Text style={[styles.progressLabel, { color: colors.textPrimary }]}>
                      {labelFor(item)}
                    </Text>
                    <Text style={[styles.progressAmount, { color: colors.textSecondary }]}>
                      {_formatCurrency(item.spent)} / {_formatCurrency(item.amount)}
                    </Text>
                  </View>
                  <View style={[styles.barTrack, { backgroundColor: colors.surfaceHover }]}>
                    <View
                      style={[styles.barFill, { width: `${percent}%`, backgroundColor: barColor }]}
                    />
                  </View>
                </View>
              );
            })}
          </View>
        </View>
      )}
    </NeumorphicCard>
  );
}

const styles = StyleSheet.create({
  card: { marginTop: 8 },
  header: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 },
  title: { fontSize: 16, fontWeight: "700" },
  helper: { fontSize: 14 },
  statsRow: { flexDirection: "row", gap: 8, marginBottom: 14 },
  statBox: { flex: 1, borderRadius: 12, padding: 10 },
  statLabel: { fontSize: 11 },
  statValue: { fontSize: 18, fontWeight: "700", marginTop: 2 },
  topRiskSection: { marginBottom: 14 },
  topRiskLabel: { fontSize: 13, fontWeight: "600", marginBottom: 6 },
  topRiskRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderRadius: 10,
    padding: 10,
    marginBottom: 6,
  },
  topRiskText: { fontSize: 13 },
  topRiskPercent: { fontSize: 13, fontWeight: "700" },
  progressSection: { gap: 10 },
  progressRow: {},
  progressTop: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  progressLabel: { fontSize: 13 },
  progressAmount: { fontSize: 12 },
  barTrack: { height: 6, borderRadius: 3, overflow: "hidden" },
  barFill: { height: "100%", borderRadius: 3 },
});
