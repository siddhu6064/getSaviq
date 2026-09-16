import React, { useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { NeumorphicCard, useNeumorphicTheme } from "../NeumorphicUI";
import { deriveForecastState } from "../../utils/aiIntelligenceState";
import { useTheme } from "../../contexts/ThemeContext";
import { formatCurrency as _formatCurrency } from "@shared/utils";

interface ForecastWidgetProps {
  isLoading: boolean;
  error?: string;
  forecast: any;
}

function formatCurrency(value: unknown) {
  const safe = Number(value);
  return _formatCurrency(Number.isFinite(safe) ? safe : 0);
}

function riskLabel(level?: string) {
  if (level === "high") return "High risk";
  if (level === "medium") return "Medium risk";
  return "Low risk";
}

export function ForecastWidget({ isLoading, error, forecast }: ForecastWidgetProps) {
  const { colors } = useTheme();
  const theme = useNeumorphicTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const state = deriveForecastState({ isLoading, error, forecast });

  return (
    <NeumorphicCard style={[styles.card, { backgroundColor: colors.surface }]}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Ionicons name="trending-up-outline" size={18} color={colors.income} />
          <Text style={[styles.title, { color: colors.textPrimary }]}>Forecast</Text>
        </View>
      </View>

      {state.viewState === "loading" ? (
        <Text style={[styles.helper, { color: colors.textSecondary }]}>Loading forecast…</Text>
      ) : state.viewState === "error" ? (
        <Text style={[styles.helper, { color: colors.textSecondary }]}>{error}</Text>
      ) : state.viewState === "empty" ? (
        <Text style={[styles.helper, { color: colors.textSecondary }]}>
          Forecast is waiting for data.
        </Text>
      ) : (
        <View style={styles.content}>
          <View
            style={[
              styles.valueBlock,
              { borderColor: colors.border, backgroundColor: colors.surface },
            ]}
          >
            <Text style={[styles.valueLabel, { color: colors.textSecondary }]}>
              Projected month spend
            </Text>
            <Text style={[styles.valueText, { color: colors.textPrimary }]}>
              {formatCurrency(state.projectedMonthTotal)}
            </Text>
          </View>
          <View style={styles.metaRow}>
            <Text style={[styles.metaItem, { color: colors.textSecondary }]}>
              Remaining: {formatCurrency(state.projectedRemaining)}
            </Text>
            <Text style={[styles.metaItem, { color: colors.textSecondary }]}>
              Confidence:{" "}
              {Number.isFinite(Number(state.confidence))
                ? `${Math.round(Number(state.confidence))}%`
                : "--"}
            </Text>
          </View>
          <Text style={[styles.riskText, { color: colors.textSecondary }]}>
            Budget risk: {riskLabel(state.riskLevel)}
          </Text>
        </View>
      )}
    </NeumorphicCard>
  );
}

const makeStyles = (theme: ReturnType<typeof useNeumorphicTheme>) =>
  StyleSheet.create({
    card: { marginTop: 8 },
    header: { marginBottom: 8 },
    titleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
    title: { fontSize: 16, fontWeight: "700", color: theme.colors.text },
    helper: { fontSize: 14, color: theme.colors.textTertiary },
    content: { gap: 8 },
    valueBlock: {
      borderWidth: 0.5,
      borderColor: theme.colors.border,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
      backgroundColor: theme.colors.cardBackground,
    },
    valueLabel: { fontSize: 11, color: theme.colors.textSecondary, textTransform: "uppercase" },
    valueText: { marginTop: 2, fontSize: 24, fontWeight: "800", color: theme.colors.text },
    metaRow: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
    metaItem: { fontSize: 12, color: theme.colors.textSecondary },
    riskText: { fontSize: 12, color: theme.colors.textTertiary },
  });
