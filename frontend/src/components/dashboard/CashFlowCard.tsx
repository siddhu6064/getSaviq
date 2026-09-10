import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { lightTheme } from "../NeumorphicUI";
import { forecastAPI } from "../../services/api";
import { formatCurrency } from "@shared/utils";

interface CashFlowDay {
  date: string;
  events: { label: string; amount: number }[];
  projected_balance: number;
}

export function CashFlowCard({ profileId }: { profileId?: string }) {
  const [data, setData] = useState<{
    days: CashFlowDay[];
    will_go_negative: boolean;
    first_negative_date: string | null;
  } | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!profileId) return;
    let cancelled = false;
    setLoading(true);
    forecastAPI
      .getCashFlow(profileId, 30)
      .then((res) => {
        if (!cancelled) setData(res.data);
      })
      .catch(() => {
        if (!cancelled) setData(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [profileId]);

  if (loading) {
    return (
      <View style={styles.card}>
        <ActivityIndicator color={lightTheme.colors.primary} />
      </View>
    );
  }

  if (!data) return null;

  const upcomingDays = data.days.filter((d) => d.events.length > 0).slice(0, 6);

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Ionicons name="calendar-outline" size={18} color={lightTheme.colors.primary} />
        <Text style={styles.title}>30-Day Cash Flow</Text>
      </View>

      {data.will_go_negative && data.first_negative_date && (
        <View style={styles.warningBanner}>
          <Ionicons name="warning-outline" size={16} color="#DC2626" />
          <Text style={styles.warningText}>
            Balance may go negative around{" "}
            {new Date(data.first_negative_date).toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
            })}
          </Text>
        </View>
      )}

      {upcomingDays.length === 0 ? (
        <Text style={styles.emptyText}>
          No upcoming bills or recurring transactions in the next 30 days.
        </Text>
      ) : (
        upcomingDays.map((day) => (
          <View key={day.date} style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowDate}>
                {new Date(day.date).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                })}
              </Text>
              <Text style={styles.rowEvents} numberOfLines={1}>
                {day.events.map((e) => e.label).join(", ")}
              </Text>
            </View>
            <Text
              style={[styles.rowBalance, day.projected_balance < 0 && styles.rowBalanceNegative]}
            >
              {formatCurrency(day.projected_balance)}
            </Text>
          </View>
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: lightTheme.colors.cardBackground,
    borderRadius: 16,
    padding: 16,
    borderWidth: 0.5,
    borderColor: lightTheme.colors.border,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  title: {
    fontSize: 15,
    fontWeight: "700",
    color: lightTheme.colors.text,
  },
  warningBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#FEF2F2",
    borderRadius: 10,
    padding: 10,
    marginBottom: 12,
  },
  warningText: {
    flex: 1,
    fontSize: 12,
    color: "#DC2626",
  },
  emptyText: {
    fontSize: 13,
    color: lightTheme.colors.textSecondary,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    borderTopWidth: 0.5,
    borderTopColor: lightTheme.colors.border,
  },
  rowDate: {
    fontSize: 13,
    fontWeight: "600",
    color: lightTheme.colors.text,
  },
  rowEvents: {
    fontSize: 12,
    color: lightTheme.colors.textSecondary,
    marginTop: 1,
  },
  rowBalance: {
    fontSize: 13,
    fontWeight: "700",
    color: lightTheme.colors.text,
  },
  rowBalanceNegative: {
    color: "#DC2626",
  },
});
