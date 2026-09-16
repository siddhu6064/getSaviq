import React, { useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { NeumorphicCard, useNeumorphicTheme } from "../NeumorphicUI";
import { MoMSummary } from "../../utils/monthSpend";
import { formatCurrency } from "@shared/utils";

interface MoMChangeCardProps {
  isLoading: boolean;
  error?: string;
  summary: MoMSummary;
}

export function MoMChangeCard({ isLoading, error, summary }: MoMChangeCardProps) {
  const theme = useNeumorphicTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const {
    currentMonthSpend,
    previousMonthSpend,
    deltaAmount,
    deltaPercent,
    hasCurrentData,
    hasPreviousData,
    direction,
  } = summary;

  const noData = !hasCurrentData && !hasPreviousData;
  const noBaseline = previousMonthSpend <= 0 && currentMonthSpend > 0;

  const accentColor =
    direction === "up"
      ? theme.colors.danger
      : direction === "down"
        ? theme.colors.success
        : theme.colors.textTertiary;

  const iconName: keyof typeof Ionicons.glyphMap =
    direction === "up"
      ? "arrow-up-circle-outline"
      : direction === "down"
        ? "arrow-down-circle-outline"
        : "remove-circle-outline";

  const headline = (() => {
    if (noData) return "No month-over-month data yet.";
    if (noBaseline) return "Spending started this month; no last-month baseline.";
    if (direction === "flat") return "Spending is in line with last month.";

    const absPercent = Math.abs(deltaPercent || 0);
    if (direction === "up") {
      return `Up ${absPercent.toFixed(1)}% vs last month`;
    }
    return `Down ${absPercent.toFixed(1)}% vs last month`;
  })();

  return (
    <NeumorphicCard style={styles.card}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Ionicons name="swap-vertical-outline" size={18} color={theme.colors.primary} />
          <Text style={styles.title}>MoM Change</Text>
        </View>
      </View>

      <View style={styles.content}>
        {isLoading ? (
          <Text style={styles.helper}>Loading month comparison...</Text>
        ) : error ? (
          <Text style={styles.helper}>{error}</Text>
        ) : (
          <>
            <View style={styles.primaryRow}>
              <Ionicons name={iconName} size={20} color={accentColor} />
              <Text style={[styles.primaryText, { color: accentColor }]}>
                {formatCurrency(Math.abs(deltaAmount))}
              </Text>
            </View>

            <Text style={styles.headline}>{headline}</Text>
            <Text style={styles.subline}>
              This month {formatCurrency(currentMonthSpend)} · Last month{" "}
              {formatCurrency(previousMonthSpend)}
            </Text>
          </>
        )}
      </View>
    </NeumorphicCard>
  );
}

const makeStyles = (theme: ReturnType<typeof useNeumorphicTheme>) =>
  StyleSheet.create({
    card: {
      marginTop: 8,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 8,
    },
    headerLeft: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    title: {
      fontSize: 16,
      fontWeight: "700",
      color: theme.colors.text,
    },
    helper: {
      fontSize: 14,
      color: theme.colors.textTertiary,
    },
    primaryRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    primaryText: {
      fontSize: 26,
      fontWeight: "800",
    },
    headline: {
      marginTop: 6,
      fontSize: 13,
      color: theme.colors.textSecondary,
    },
    subline: {
      marginTop: 4,
      fontSize: 12,
      color: theme.colors.textTertiary,
    },
    content: {
      minHeight: 68,
      justifyContent: "center",
    },
  });
