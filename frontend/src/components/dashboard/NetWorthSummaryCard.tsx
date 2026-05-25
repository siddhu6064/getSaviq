import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { NeumorphicCard, lightTheme } from "../NeumorphicUI";
import { useTheme } from "../../contexts/ThemeContext";
import api from "../../services/api";

interface NetWorthData {
  assets_total: number;
  liabilities_total: number;
  net_worth: number;
}

interface NetWorthSummaryCardProps {
  profileId?: string;
  onPress?: () => void;
}

export function NetWorthSummaryCard({ profileId, onPress }: NetWorthSummaryCardProps) {
  const { colors } = useTheme();
  const [data, setData] = useState<NetWorthData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError("");

    const params: Record<string, string> = {};
    if (profileId) params.profile_id = profileId;

    api
      .get("/net-worth", { params })
      .then((res) => {
        if (cancelled) return;
        setData(res.data);
        setIsLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setError("Could not load net worth.");
        setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [profileId]);

  const isPositive = (data?.net_worth ?? 0) >= 0;
  const netWorth = data?.net_worth ?? 0;

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.85} disabled={!onPress}>
      <NeumorphicCard style={styles.card}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Ionicons name="stats-chart-outline" size={18} color={colors.primary} />
            <Text style={[styles.title, { color: colors.textPrimary }]}>Net Worth</Text>
          </View>
          {onPress && <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />}
        </View>

        {isLoading ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={[styles.helperText, { color: colors.textSecondary }]}>
              Loading net worth...
            </Text>
          </View>
        ) : error ? (
          <Text style={[styles.helperText, { color: colors.expense }]}>{error}</Text>
        ) : data ? (
          <>
            <Text
              style={[styles.netWorthValue, { color: isPositive ? colors.income : colors.expense }]}
            >
              {isPositive ? "" : "−"}$
              {Math.abs(netWorth).toLocaleString("en-US", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </Text>
            <View style={styles.pillRow}>
              <View style={[styles.pill, { backgroundColor: colors.surfaceHover }]}>
                <Ionicons name="arrow-up-outline" size={11} color={colors.income} />
                <Text style={[styles.pillText, { color: colors.income }]}>
                  $
                  {(data.assets_total ?? 0).toLocaleString("en-US", {
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 0,
                  })}
                </Text>
                <Text style={[styles.pillLabel, { color: colors.textSecondary }]}>assets</Text>
              </View>
              <View style={[styles.pill, { backgroundColor: colors.surfaceHover }]}>
                <Ionicons name="arrow-down-outline" size={11} color={colors.expense} />
                <Text style={[styles.pillText, { color: colors.expense }]}>
                  $
                  {(data.liabilities_total ?? 0).toLocaleString("en-US", {
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 0,
                  })}
                </Text>
                <Text style={[styles.pillLabel, { color: colors.textSecondary }]}>debts</Text>
              </View>
            </View>
          </>
        ) : null}
      </NeumorphicCard>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
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
  },
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    minHeight: 48,
  },
  helperText: {
    fontSize: 14,
    color: lightTheme.colors.textSecondary,
    minHeight: 48,
    lineHeight: 48,
  },
  netWorthValue: {
    fontSize: 30,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  pillRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 10,
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  pillText: {
    fontSize: 12,
    fontWeight: "700",
  },
  pillLabel: {
    fontSize: 11,
    fontWeight: "500",
  },
});
