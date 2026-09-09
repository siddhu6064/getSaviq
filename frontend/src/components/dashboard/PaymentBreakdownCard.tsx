import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { NeumorphicCard, lightTheme } from "../NeumorphicUI";
import { useTheme } from "../../contexts/ThemeContext";
import api from "../../services/api";
import { formatCurrency as _formatCurrency } from "@shared/utils";

interface PaymentItem {
  payment_method_id: string;
  payment_method_name: string;
  amount: number;
}

interface Props {
  profileId?: string;
  onPressPaymentMethod?: (paymentMethodId: string) => void;
}

export function PaymentBreakdownCard({ profileId, onPressPaymentMethod }: Props) {
  const { colors } = useTheme();
  const [items, setItems] = useState<PaymentItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!profileId) {
      setItems([]);
      setIsLoading(false);
      return;
    }
    let cancelled = false;
    setIsLoading(true);
    setError("");
    api
      .get("/analytics/payment-method-breakdown", { params: { profile_id: profileId } })
      .then((res) => {
        if (cancelled) return;
        setItems(Array.isArray(res.data?.items) ? res.data.items : []);
        setIsLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setError("Could not load payment method breakdown.");
        setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [profileId]);

  return (
    <NeumorphicCard style={styles.card}>
      <View style={styles.header}>
        <Ionicons name="card-outline" size={18} color={colors.primary} />
        <Text style={[styles.title, { color: colors.textPrimary }]}>Payment Methods</Text>
      </View>

      {isLoading ? (
        <ActivityIndicator size="small" color={colors.primary} />
      ) : error ? (
        <Text style={[styles.helper, { color: colors.expense }]}>{error}</Text>
      ) : items.length === 0 ? (
        <Text style={[styles.helper, { color: colors.textSecondary }]}>
          No payment method spend data yet.
        </Text>
      ) : (
        items.slice(0, 5).map((item) => (
          <TouchableOpacity
            key={item.payment_method_id}
            style={styles.row}
            onPress={() => onPressPaymentMethod?.(item.payment_method_id)}
            activeOpacity={0.7}
          >
            <Text style={[styles.rowLabel, { color: colors.textPrimary }]} numberOfLines={1}>
              {item.payment_method_name}
            </Text>
            <Text style={[styles.rowAmount, { color: colors.textSecondary }]}>
              {_formatCurrency(item.amount)}
            </Text>
          </TouchableOpacity>
        ))
      )}
    </NeumorphicCard>
  );
}

const styles = StyleSheet.create({
  card: { marginTop: 8 },
  header: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 },
  title: { fontSize: 16, fontWeight: "700" },
  helper: { fontSize: 14 },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 7,
  },
  rowLabel: { fontSize: 14, flex: 1, marginRight: 8 },
  rowAmount: { fontSize: 14, fontWeight: "600" },
});
