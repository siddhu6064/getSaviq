import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { NeumorphicCard, lightTheme } from "../NeumorphicUI";
import { useTheme } from "../../contexts/ThemeContext";
import api from "../../services/api";

interface InsightItem {
  severity?: string;
  title?: string;
  message?: string;
}

interface Props {
  profileId?: string;
}

function getSeverityColor(severity: string | undefined, colors: any) {
  if (severity === "warning") return colors.warning;
  if (severity === "positive") return colors.income;
  return colors.primary;
}

export function RecommendationsWidget({ profileId }: Props) {
  const { colors } = useTheme();
  const [items, setItems] = useState<InsightItem[]>([]);
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
      .get("/insights/recommendations", { params: { profile_id: profileId } })
      .then((res) => {
        if (cancelled) return;
        setItems(Array.isArray(res.data?.insights) ? res.data.insights : []);
        setIsLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setError("Could not load recommendations.");
        setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [profileId]);

  return (
    <NeumorphicCard style={styles.card}>
      <View style={styles.header}>
        <Ionicons name="bulb-outline" size={18} color={colors.warning} />
        <Text style={[styles.title, { color: colors.textPrimary }]}>Recommendations</Text>
      </View>

      {isLoading ? (
        <ActivityIndicator size="small" color={colors.primary} />
      ) : error ? (
        <Text style={[styles.helper, { color: colors.expense }]}>{error}</Text>
      ) : items.length === 0 ? (
        <Text style={[styles.helper, { color: colors.textSecondary }]}>
          No recommendations available yet.
        </Text>
      ) : (
        items.slice(0, 5).map((item, index) => (
          <View key={index} style={styles.row}>
            <View
              style={[styles.dot, { backgroundColor: getSeverityColor(item.severity, colors) }]}
            />
            <View style={{ flex: 1 }}>
              <Text style={[styles.rowTitle, { color: colors.textPrimary }]}>
                {item.title || "Recommendation"}
              </Text>
              <Text style={[styles.rowBody, { color: colors.textSecondary }]}>
                {item.message || "No details available."}
              </Text>
            </View>
          </View>
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
  row: { flexDirection: "row", alignItems: "flex-start", gap: 10, marginBottom: 10 },
  dot: { width: 8, height: 8, borderRadius: 4, marginTop: 6 },
  rowTitle: { fontSize: 13, fontWeight: "700" },
  rowBody: { marginTop: 2, fontSize: 13, lineHeight: 18 },
});
