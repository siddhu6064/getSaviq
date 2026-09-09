import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { NeumorphicCard, lightTheme } from "../NeumorphicUI";
import { useTheme } from "../../contexts/ThemeContext";
import api from "../../services/api";
import {
  mapWeeklyDigestBannerData,
  resolveWeeklyDigestBannerState,
} from "../../utils/weeklyDigestBannerState";

interface Props {
  digest: any;
  loading?: boolean;
  error?: string | null;
  profileId?: string;
}

const POLARITY_COLOR_KEY: Record<string, string> = {
  positive: "income",
  negative: "expense",
  neutral: "textSecondary",
};

export function WeeklyDigestBanner({ digest, loading = false, error = null, profileId }: Props) {
  const { colors } = useTheme();
  const [dismissed, setDismissed] = useState(false);
  const [isDismissing, setIsDismissing] = useState(false);

  const state = dismissed ? "hidden" : resolveWeeklyDigestBannerState({ loading, error, digest });

  if (state === "loading") {
    return (
      <NeumorphicCard style={[styles.card, { backgroundColor: colors.surface }]}>
        <View style={styles.loadingRow}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
            Loading latest weekly digest...
          </Text>
        </View>
      </NeumorphicCard>
    );
  }

  if (state !== "ready") return null;

  const data = mapWeeklyDigestBannerData(digest);

  const handleDismiss = async () => {
    if (!profileId || isDismissing) return;
    setIsDismissing(true);
    try {
      await api.post("/weekly-digest/latest/dismiss", null, { params: { profile_id: profileId } });
      setDismissed(true);
    } catch {
      // best-effort — leave banner visible on failure
    } finally {
      setIsDismissing(false);
    }
  };

  return (
    <NeumorphicCard style={[styles.card, { backgroundColor: colors.surfaceHover }]}>
      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <View style={styles.labelRow}>
            <Ionicons name="notifications-outline" size={12} color={colors.textSecondary} />
            <Text style={[styles.label, { color: colors.textSecondary }]}>{data.latestLabel}</Text>
          </View>
          {data.summary && (
            <Text style={[styles.summary, { color: colors.textPrimary }]}>{data.summary}</Text>
          )}
          {data.recommendations.length > 0 && (
            <View style={{ marginTop: 6 }}>
              {data.recommendations.map((item: any) => (
                <Text
                  key={item.id}
                  style={[
                    styles.recommendation,
                    {
                      color:
                        (colors as any)[POLARITY_COLOR_KEY[item.polarity]] || colors.textSecondary,
                    },
                  ]}
                >
                  • {item.text}
                </Text>
              ))}
            </View>
          )}
        </View>
        <TouchableOpacity onPress={handleDismiss} disabled={isDismissing} style={styles.dismissBtn}>
          {isDismissing ? (
            <ActivityIndicator size="small" color={colors.textSecondary} />
          ) : (
            <Ionicons name="close" size={18} color={colors.textSecondary} />
          )}
        </TouchableOpacity>
      </View>
    </NeumorphicCard>
  );
}

const styles = StyleSheet.create({
  card: { marginTop: 8, paddingVertical: 10 },
  loadingRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  loadingText: { fontSize: 13 },
  row: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  labelRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  label: { fontSize: 10, fontWeight: "700", textTransform: "uppercase" },
  summary: { fontSize: 13, marginTop: 4 },
  recommendation: { fontSize: 12, lineHeight: 17 },
  dismissBtn: { padding: 4 },
});
