import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { NeumorphicCard, lightTheme } from "../NeumorphicUI";
import { useTheme } from "../../contexts/ThemeContext";
import api from "../../services/api";
import { formatCurrency as _formatCurrency } from "@shared/utils";

interface CategoryItem {
  category_id: string;
  category_name: string;
  amount: number;
  percentage: number;
}

interface Props {
  profileId?: string;
  onPressCategory?: (categoryId: string) => void;
}

export function CategoryBreakdownCard({ profileId, onPressCategory }: Props) {
  const { colors } = useTheme();
  const [items, setItems] = useState<CategoryItem[]>([]);
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
      .get("/analytics/category-breakdown", { params: { profile_id: profileId } })
      .then((res) => {
        if (cancelled) return;
        setItems(Array.isArray(res.data?.items) ? res.data.items : []);
        setIsLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setError("Could not load category breakdown.");
        setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [profileId]);

  return (
    <NeumorphicCard style={styles.card}>
      <View style={styles.header}>
        <Ionicons name="pie-chart-outline" size={18} color={colors.primary} />
        <Text style={[styles.title, { color: colors.textPrimary }]}>Category Breakdown</Text>
      </View>

      {isLoading ? (
        <ActivityIndicator size="small" color={colors.primary} />
      ) : error ? (
        <Text style={[styles.helper, { color: colors.expense }]}>{error}</Text>
      ) : items.length === 0 ? (
        <Text style={[styles.helper, { color: colors.textSecondary }]}>
          No category spend data yet.
        </Text>
      ) : (
        items.slice(0, 5).map((cat) => (
          <TouchableOpacity
            key={cat.category_id}
            style={styles.row}
            onPress={() => onPressCategory?.(cat.category_id)}
            activeOpacity={0.7}
          >
            <View style={styles.rowTop}>
              <Text style={[styles.rowLabel, { color: colors.textPrimary }]} numberOfLines={1}>
                {cat.category_name}
              </Text>
              <Text style={[styles.rowAmount, { color: colors.textSecondary }]}>
                {_formatCurrency(cat.amount)}
              </Text>
            </View>
            <View style={[styles.barTrack, { backgroundColor: colors.surfaceHover }]}>
              <View
                style={[
                  styles.barFill,
                  {
                    width: `${Math.max(0, Math.min(100, cat.percentage))}%`,
                    backgroundColor: colors.primary,
                  },
                ]}
              />
            </View>
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
  row: { marginBottom: 12 },
  rowTop: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  rowLabel: { fontSize: 14, fontWeight: "500", flex: 1, marginRight: 8 },
  rowAmount: { fontSize: 13 },
  barTrack: { height: 6, borderRadius: 3, overflow: "hidden" },
  barFill: { height: "100%", borderRadius: 3 },
});
