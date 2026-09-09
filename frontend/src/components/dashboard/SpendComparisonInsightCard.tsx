import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { NeumorphicCard, lightTheme } from "../NeumorphicUI";
import { useTheme } from "../../contexts/ThemeContext";
import api from "../../services/api";
import { formatCurrency as _formatCurrency } from "@shared/utils";
import { deriveSpendComparisonInsight } from "../../utils/spendComparisonInsight";

interface Props {
  profileId?: string;
}

function severityColor(severity: string | undefined, colors: any) {
  if (severity === "critical" || severity === "high") return colors.expense;
  if (severity === "warning") return colors.warning;
  return colors.primary;
}

export function SpendComparisonInsightCard({ profileId }: Props) {
  const { colors } = useTheme();
  const [payload, setPayload] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!profileId) {
      setPayload(null);
      setIsLoading(false);
      return;
    }
    let cancelled = false;
    setIsLoading(true);
    setError("");
    api
      .get("/insights/spend-comparison", { params: { profile_id: profileId } })
      .then((res) => {
        if (cancelled) return;
        setPayload(res.data || null);
        setIsLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setError("Insights are temporarily unavailable.");
        setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [profileId]);

  const insight = payload ? deriveSpendComparisonInsight(payload) : null;

  return (
    <NeumorphicCard style={styles.card}>
      <View style={styles.header}>
        <Ionicons name="sparkles-outline" size={18} color={colors.primary} />
        <Text style={[styles.title, { color: colors.textPrimary }]}>Smart Insights</Text>
      </View>

      {isLoading ? (
        <ActivityIndicator size="small" color={colors.primary} />
      ) : error ? (
        <Text style={[styles.helper, { color: colors.expense }]}>{error}</Text>
      ) : !insight ? (
        <Text style={[styles.helper, { color: colors.textSecondary }]}>
          No standout signals yet. Keep logging to sharpen guidance.
        </Text>
      ) : (
        <View>
          <View style={styles.titleRow}>
            <Text style={[styles.insightTitle, { color: colors.textPrimary }]}>
              {insight.title}
            </Text>
            <View
              style={[
                styles.severityBadge,
                { backgroundColor: severityColor(insight.severity, colors) + "22" },
              ]}
            >
              <Text
                style={[styles.severityText, { color: severityColor(insight.severity, colors) }]}
              >
                {insight.severity}
              </Text>
            </View>
          </View>
          <Text style={[styles.body, { color: colors.textSecondary }]}>
            {insight.body ||
              (insight.budgetAmount
                ? `${_formatCurrency(insight.currentSpend)} spent of ${_formatCurrency(insight.budgetAmount)} budget.`
                : "")}
          </Text>
          {insight.badgeText && (
            <View style={[styles.deltaBadge, { backgroundColor: colors.primary + "1A" }]}>
              <Text style={[styles.deltaText, { color: colors.primary }]}>{insight.badgeText}</Text>
            </View>
          )}
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
  titleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  insightTitle: { fontSize: 15, fontWeight: "700", flex: 1, marginRight: 8 },
  severityBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  severityText: { fontSize: 11, fontWeight: "700", textTransform: "capitalize" },
  body: { fontSize: 13, lineHeight: 18, marginTop: 6 },
  deltaBadge: {
    alignSelf: "flex-start",
    marginTop: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  deltaText: { fontSize: 12, fontWeight: "700" },
});
