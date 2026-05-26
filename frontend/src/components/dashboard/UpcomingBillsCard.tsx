import React, { useEffect, useState, useMemo } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { NeumorphicCard, lightTheme } from "../NeumorphicUI";
import { useTheme } from "../../contexts/ThemeContext";
import { billsAPI } from "../../services/api";
import { computeBillStatus, getEffectiveDueDay, Bill } from "../../utils/billsStatus";

interface Props {
  profileId?: string;
  onPress?: () => void;
}

export function UpcomingBillsCard({ profileId, onPress }: Props) {
  const { colors } = useTheme();
  const [bills, setBills] = useState<Bill[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError("");

    const params: Record<string, string> = { status: "active" };
    if (profileId) params.profile_id = profileId;

    billsAPI
      .getAll(params)
      .then((res) => {
        if (cancelled) return;
        setBills(Array.isArray(res.data) ? res.data : []);
        setIsLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setError("Could not load bills.");
        setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [profileId]);

  const upcomingBills = useMemo(() => {
    return bills
      .map((b) => ({ ...b, _status: computeBillStatus(b) }))
      .filter((b) => b._status !== "paid")
      .sort((a, b) => getEffectiveDueDay(a.due_day) - getEffectiveDueDay(b.due_day))
      .slice(0, 3);
  }, [bills]);

  const totalMonthly = useMemo(
    () =>
      bills.reduce((sum, b) => {
        if (b.frequency === "monthly") return sum + b.expected_amount;
        if (b.frequency === "weekly") return sum + b.expected_amount * 4.33;
        if (b.frequency === "annual") return sum + b.expected_amount / 12;
        return sum;
      }, 0),
    [bills],
  );

  const statusDotColor: Record<string, string> = {
    overdue: colors.expense,
    due_soon: colors.warning,
    upcoming: colors.textSecondary,
    paid: colors.income,
  };

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.85} disabled={!onPress}>
      <NeumorphicCard style={styles.card}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Ionicons name="receipt-outline" size={18} color={colors.primary} />
            <Text style={[styles.title, { color: colors.textPrimary }]}>Upcoming Bills</Text>
          </View>
          {onPress && <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />}
        </View>

        {isLoading ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={[styles.helperText, { color: colors.textSecondary }]}>
              Loading bills...
            </Text>
          </View>
        ) : error ? (
          <Text style={[styles.helperText, { color: colors.expense }]}>{error}</Text>
        ) : upcomingBills.length === 0 ? (
          <Text style={[styles.allClear, { color: colors.income }]}>All bills caught up! 🎉</Text>
        ) : (
          <>
            {upcomingBills.map((b) => (
              <View key={b.bill_id} style={styles.billRow}>
                <View
                  style={[
                    styles.statusDot,
                    { backgroundColor: statusDotColor[b._status] || colors.textSecondary },
                  ]}
                />
                <Text style={[styles.billName, { color: colors.textPrimary }]} numberOfLines={1}>
                  {b.name}
                </Text>
                <Text style={[styles.billAmount, { color: colors.textPrimary }]}>
                  $
                  {b.expected_amount.toLocaleString("en-US", {
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 0,
                  })}
                </Text>
              </View>
            ))}
          </>
        )}

        {!isLoading && !error && (
          <View style={styles.footer}>
            <Text style={[styles.footerText, { color: colors.textSecondary }]}>
              {bills.length} bill{bills.length !== 1 ? "s" : ""} this month
            </Text>
            <Text style={[styles.footerAmount, { color: colors.textPrimary }]}>
              $
              {totalMonthly.toLocaleString("en-US", {
                minimumFractionDigits: 0,
                maximumFractionDigits: 0,
              })}{" "}
              total
            </Text>
          </View>
        )}
      </NeumorphicCard>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: { marginTop: 8 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  title: { fontSize: 16, fontWeight: "700" },
  loadingRow: { flexDirection: "row", alignItems: "center", gap: 8, minHeight: 40 },
  helperText: { fontSize: 14, minHeight: 40, lineHeight: 40 },
  allClear: { fontSize: 14, fontWeight: "600", paddingVertical: 8 },
  billRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 5,
  },
  statusDot: { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  billName: { flex: 1, fontSize: 14, fontWeight: "500" },
  billAmount: { fontSize: 14, fontWeight: "700" },
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: lightTheme.colors.border,
  },
  footerText: { fontSize: 12 },
  footerAmount: { fontSize: 12, fontWeight: "700" },
});
