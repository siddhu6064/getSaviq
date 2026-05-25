import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
  ActivityIndicator,
  Dimensions,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../src/contexts/ThemeContext";
import { useAppStore } from "../../src/store/appStore";
import api from "../../src/services/api";
import { LineChart } from "react-native-gifted-charts";

// ─── Types ────────────────────────────────────────────────────────────────────

interface NetWorthSummary {
  assets_total: number;
  liabilities_total: number;
  net_worth: number;
}

interface Asset {
  asset_id: string;
  name: string;
  type: "cash" | "property" | "investment" | "other";
  value: number;
  currency: string;
}

interface Liability {
  liability_id: string;
  name: string;
  type: "loan" | "credit" | "mortgage" | "other";
  balance: number;
  interest_rate?: number | null;
  monthly_payment?: number | null;
}

interface SnapshotPoint {
  net_worth: number;
  date: string;
}

const ASSET_TYPES = ["cash", "property", "investment", "other"] as const;
const LIABILITY_TYPES = ["loan", "credit", "mortgage", "other"] as const;

const SCREEN_WIDTH = Dimensions.get("window").width;

// ─── Currency helper ──────────────────────────────────────────────────────────

function fmt(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

// ─── Sparkline chart ──────────────────────────────────────────────────────────

function NetWorthSparkline({ profileId }: { profileId?: string }) {
  const { colors } = useTheme();
  const [data, setData] = useState<SnapshotPoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);

    const params: Record<string, string | number> = { days: 180 };
    if (profileId) params.profile_id = profileId;

    api
      .get("/net-worth/history", { params })
      .then((res) => {
        if (cancelled) return;
        const snapshots: SnapshotPoint[] = Array.isArray(res.data?.snapshots)
          ? res.data.snapshots
          : [];
        setData(snapshots);
        setIsLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [profileId]);

  if (isLoading) {
    return (
      <View style={[styles.chartPlaceholder, { backgroundColor: colors.surfaceHover }]}>
        <ActivityIndicator size="small" color={colors.primary} />
      </View>
    );
  }

  if (data.length < 2) {
    return (
      <View style={[styles.chartPlaceholder, { backgroundColor: colors.surfaceHover }]}>
        <Ionicons name="trending-up-outline" size={28} color={colors.textSecondary} />
        <Text style={[styles.chartEmpty, { color: colors.textSecondary }]}>
          Trend available after first nightly snapshot
        </Text>
      </View>
    );
  }

  const chartData = data.map((s) => ({ value: s.net_worth }));

  return (
    <View style={styles.chartContainer}>
      <LineChart
        data={chartData}
        areaChart
        curved
        color={colors.primary}
        startFillColor={colors.primary}
        endFillColor="transparent"
        startOpacity={0.25}
        endOpacity={0}
        hideDataPoints
        hideAxesAndRules
        width={SCREEN_WIDTH - 64}
        height={80}
        thickness={2}
        noOfSections={3}
        isAnimated
      />
    </View>
  );
}

// ─── Asset row ────────────────────────────────────────────────────────────────

function AssetRow({
  item,
  onEdit,
  onDelete,
}: {
  item: Asset;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { colors } = useTheme();
  return (
    <View style={[styles.row, { borderColor: colors.border }]}>
      <View style={styles.rowInfo}>
        <Text style={[styles.rowName, { color: colors.textPrimary }]} numberOfLines={1}>
          {item.name}
        </Text>
        <View style={[styles.typeBadge, { backgroundColor: colors.surfaceHover }]}>
          <Text style={[styles.typeBadgeText, { color: colors.primary }]}>{item.type}</Text>
        </View>
      </View>
      <View style={styles.rowRight}>
        <Text style={[styles.rowValue, { color: colors.income }]}>{fmt(item.value)}</Text>
        <TouchableOpacity
          style={styles.iconBtn}
          onPress={onEdit}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="pencil-outline" size={16} color={colors.primary} />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.iconBtn}
          onPress={onDelete}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="trash-outline" size={16} color={colors.expense} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Liability row ────────────────────────────────────────────────────────────

function LiabilityRow({
  item,
  onEdit,
  onDelete,
}: {
  item: Liability;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { colors } = useTheme();
  const meta = [
    item.interest_rate != null ? `${item.interest_rate}% APR` : null,
    item.monthly_payment != null ? `${fmt(item.monthly_payment)}/mo` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <View style={[styles.row, { borderColor: colors.border }]}>
      <View style={styles.rowInfo}>
        <Text style={[styles.rowName, { color: colors.textPrimary }]} numberOfLines={1}>
          {item.name}
        </Text>
        <View style={styles.rowMetaRow}>
          <View style={[styles.typeBadge, { backgroundColor: colors.surfaceHover }]}>
            <Text style={[styles.typeBadgeText, { color: colors.expense }]}>{item.type}</Text>
          </View>
          {meta ? (
            <Text style={[styles.metaText, { color: colors.textSecondary }]}>{meta}</Text>
          ) : null}
        </View>
      </View>
      <View style={styles.rowRight}>
        <Text style={[styles.rowValue, { color: colors.expense }]}>{fmt(item.balance)}</Text>
        <TouchableOpacity
          style={styles.iconBtn}
          onPress={onEdit}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="pencil-outline" size={16} color={colors.primary} />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.iconBtn}
          onPress={onDelete}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="trash-outline" size={16} color={colors.expense} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Section header ───────────────────────────────────────────────────────────

function SectionHeader({
  icon,
  title,
  total,
  totalColor,
  onAdd,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  total: number;
  totalColor: string;
  onAdd: () => void;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionHeaderLeft}>
        <Ionicons name={icon} size={18} color={totalColor} />
        <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>{title}</Text>
        <Text style={[styles.sectionTotal, { color: totalColor }]}>{fmt(total)}</Text>
      </View>
      <TouchableOpacity
        style={[styles.addBtn, { backgroundColor: colors.primary }]}
        onPress={onAdd}
        activeOpacity={0.8}
      >
        <Ionicons name="add" size={16} color="#FFF" />
        <Text style={styles.addBtnText}>Add</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Add/Edit Modal ───────────────────────────────────────────────────────────

type ModalMode = "asset_create" | "asset_edit" | "liability_create" | "liability_edit";

interface ModalState {
  mode: ModalMode;
  editingId?: string;
  name: string;
  type: string;
  value: string; // asset value
  balance: string; // liability balance
  interestRate: string;
  monthlyPayment: string;
}

const defaultModal = (mode: ModalMode): ModalState => ({
  mode,
  name: "",
  type: mode.startsWith("asset") ? "cash" : "loan",
  value: "",
  balance: "",
  interestRate: "",
  monthlyPayment: "",
});

// ─── Main Screen ─────────────────────────────────────────────────────────────

export default function NetWorthScreen() {
  const { colors } = useTheme();
  const { activeProfile, profiles, setActiveProfile } = useAppStore();

  const [summary, setSummary] = useState<NetWorthSummary | null>(null);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [liabilities, setLiabilities] = useState<Liability[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [modalVisible, setModalVisible] = useState(false);
  const [modalState, setModalState] = useState<ModalState>(defaultModal("asset_create"));

  const isMounted = useRef(true);
  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  // Auto-clear success
  useEffect(() => {
    if (!success) return;
    const t = setTimeout(() => setSuccess(""), 2500);
    return () => clearTimeout(t);
  }, [success]);

  const profileId = activeProfile?.profile_id;

  const loadAll = useCallback(
    async (refresh = false) => {
      if (!profileId) {
        setSummary(null);
        setAssets([]);
        setLiabilities([]);
        setIsLoading(false);
        setIsRefreshing(false);
        return;
      }
      try {
        if (refresh) setIsRefreshing(true);
        else setIsLoading(true);
        setError("");

        const params = { profile_id: profileId };
        const [sumRes, assetsRes, liabsRes] = await Promise.all([
          api.get("/net-worth", { params }),
          api.get("/assets", { params }),
          api.get("/liabilities", { params }),
        ]);

        if (!isMounted.current) return;
        setSummary(sumRes.data ?? null);
        setAssets(Array.isArray(assetsRes.data) ? assetsRes.data : []);
        setLiabilities(Array.isArray(liabsRes.data) ? liabsRes.data : []);
      } catch {
        if (!isMounted.current) return;
        setError("Failed to load data. Pull to retry.");
      } finally {
        if (isMounted.current) {
          setIsLoading(false);
          setIsRefreshing(false);
        }
      }
    },
    [profileId],
  );

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // ── Modal helpers ──────────────────────────────────────────────────────────

  const openAddAsset = () => {
    setModalState(defaultModal("asset_create"));
    setModalVisible(true);
  };

  const openEditAsset = (a: Asset) => {
    setModalState({
      mode: "asset_edit",
      editingId: a.asset_id,
      name: a.name,
      type: a.type,
      value: String(a.value),
      balance: "",
      interestRate: "",
      monthlyPayment: "",
    });
    setModalVisible(true);
  };

  const openAddLiability = () => {
    setModalState(defaultModal("liability_create"));
    setModalVisible(true);
  };

  const openEditLiability = (l: Liability) => {
    setModalState({
      mode: "liability_edit",
      editingId: l.liability_id,
      name: l.name,
      type: l.type,
      value: "",
      balance: String(l.balance),
      interestRate: l.interest_rate != null ? String(l.interest_rate) : "",
      monthlyPayment: l.monthly_payment != null ? String(l.monthly_payment) : "",
    });
    setModalVisible(true);
  };

  const closeModal = () => {
    if (isSubmitting) return;
    setModalVisible(false);
  };

  const isAssetMode = modalState.mode.startsWith("asset");

  const handleSubmit = async () => {
    if (isSubmitting || !profileId) return;

    const { mode, editingId, name, type, value, balance, interestRate, monthlyPayment } =
      modalState;

    if (!name.trim()) {
      Alert.alert("Validation", "Name is required.");
      return;
    }

    if (isAssetMode) {
      const numValue = parseFloat(value);
      if (isNaN(numValue) || numValue < 0) {
        Alert.alert("Validation", "Enter a valid value (0 or greater).");
        return;
      }
    } else {
      const numBalance = parseFloat(balance);
      if (isNaN(numBalance) || numBalance < 0) {
        Alert.alert("Validation", "Enter a valid balance (0 or greater).");
        return;
      }
    }

    try {
      setIsSubmitting(true);
      setError("");

      if (mode === "asset_create") {
        await api.post("/assets", {
          profile_id: profileId,
          name: name.trim(),
          type,
          value: parseFloat(value),
          currency: "USD",
        });
        setSuccess("Asset added.");
      } else if (mode === "asset_edit" && editingId) {
        await api.put(`/assets/${editingId}`, {
          name: name.trim(),
          type,
          value: parseFloat(value),
        });
        setSuccess("Asset updated.");
      } else if (mode === "liability_create") {
        await api.post("/liabilities", {
          profile_id: profileId,
          name: name.trim(),
          type,
          balance: parseFloat(balance),
          interest_rate: interestRate !== "" ? parseFloat(interestRate) : null,
          monthly_payment: monthlyPayment !== "" ? parseFloat(monthlyPayment) : null,
        });
        setSuccess("Liability added.");
      } else if (mode === "liability_edit" && editingId) {
        await api.put(`/liabilities/${editingId}`, {
          name: name.trim(),
          type,
          balance: parseFloat(balance),
          interest_rate: interestRate !== "" ? parseFloat(interestRate) : null,
          monthly_payment: monthlyPayment !== "" ? parseFloat(monthlyPayment) : null,
        });
        setSuccess("Liability updated.");
      }

      setModalVisible(false);
      await loadAll();
    } catch {
      Alert.alert("Error", `Failed to ${mode.includes("edit") ? "update" : "save"} entry.`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteAsset = (item: Asset) => {
    Alert.alert("Delete Asset", `Delete "${item.name}"?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await api.delete(`/assets/${item.asset_id}`);
            setSuccess("Asset deleted.");
            await loadAll();
          } catch {
            Alert.alert("Error", "Failed to delete asset.");
          }
        },
      },
    ]);
  };

  const handleDeleteLiability = (item: Liability) => {
    Alert.alert("Delete Liability", `Delete "${item.name}"?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await api.delete(`/liabilities/${item.liability_id}`);
            setSuccess("Liability deleted.");
            await loadAll();
          } catch {
            Alert.alert("Error", "Failed to delete liability.");
          }
        },
      },
    ]);
  };

  const isPositive = (summary?.net_worth ?? 0) >= 0;

  // ── Render ─────────────────────────────────────────────────────────────────

  if (!activeProfile) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <Ionicons name="stats-chart-outline" size={42} color={colors.textSecondary} />
        <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>No profile selected</Text>
        <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
          Select a profile in the More tab to view net worth.
        </Text>
      </View>
    );
  }

  if (isLoading) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
          Loading net worth...
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <SafeAreaView style={styles.safeArea} edges={["top"]}>
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={() => loadAll(true)}
              tintColor={colors.primary}
            />
          }
        >
          {/* ── Header ── */}
          <View style={styles.headerRow}>
            <View>
              <Text style={[styles.screenTitle, { color: colors.textPrimary }]}>Net Worth</Text>
              <Text style={[styles.screenSubtitle, { color: colors.textSecondary }]}>
                {activeProfile.name}
              </Text>
            </View>
            {/* Profile switcher */}
            {profiles.length > 1 && (
              <View style={styles.profilePicker}>
                {profiles.map((p) => (
                  <TouchableOpacity
                    key={p.profile_id}
                    style={[
                      styles.profileChip,
                      {
                        backgroundColor:
                          p.profile_id === profileId ? colors.primary : colors.surfaceHover,
                      },
                    ]}
                    onPress={() => setActiveProfile(p)}
                  >
                    <Text
                      style={[
                        styles.profileChipText,
                        {
                          color: p.profile_id === profileId ? "#FFF" : colors.textSecondary,
                        },
                      ]}
                    >
                      {p.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          {/* ── Error / Success banners ── */}
          {error ? (
            <TouchableOpacity
              style={[
                styles.banner,
                { backgroundColor: colors.surface, borderColor: colors.expense },
              ]}
              onPress={() => loadAll()}
              activeOpacity={0.8}
            >
              <Ionicons name="alert-circle-outline" size={16} color={colors.expense} />
              <Text style={[styles.bannerText, { color: colors.expense }]}>{error}</Text>
              <Text style={[styles.retryText, { color: colors.expense }]}>Tap to retry</Text>
            </TouchableOpacity>
          ) : null}

          {success ? (
            <View
              style={[
                styles.banner,
                { backgroundColor: colors.surface, borderColor: colors.income },
              ]}
            >
              <Ionicons name="checkmark-circle-outline" size={16} color={colors.income} />
              <Text style={[styles.bannerText, { color: colors.income }]}>{success}</Text>
            </View>
          ) : null}

          {/* ── Summary row ── */}
          <View
            style={[
              styles.summaryCard,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <View style={styles.summaryMain}>
              <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Net Worth</Text>
              <Text
                style={[
                  styles.summaryValue,
                  { color: isPositive ? colors.income : colors.expense },
                ]}
              >
                {isPositive ? "" : "−"}
                {fmt(Math.abs(summary?.net_worth ?? 0))}
              </Text>
            </View>
            <View style={styles.summaryPills}>
              <View style={[styles.summaryPill, { backgroundColor: colors.surfaceHover }]}>
                <Ionicons name="trending-up-outline" size={13} color={colors.income} />
                <Text style={[styles.summaryPillValue, { color: colors.income }]}>
                  {fmt(summary?.assets_total ?? 0)}
                </Text>
                <Text style={[styles.summaryPillLabel, { color: colors.textSecondary }]}>
                  Assets
                </Text>
              </View>
              <View style={[styles.summaryPill, { backgroundColor: colors.surfaceHover }]}>
                <Ionicons name="trending-down-outline" size={13} color={colors.expense} />
                <Text style={[styles.summaryPillValue, { color: colors.expense }]}>
                  {fmt(summary?.liabilities_total ?? 0)}
                </Text>
                <Text style={[styles.summaryPillLabel, { color: colors.textSecondary }]}>
                  Liabilities
                </Text>
              </View>
            </View>
          </View>

          {/* ── Sparkline ── */}
          <View
            style={[
              styles.sparklineCard,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <Text style={[styles.sparklineTitle, { color: colors.textSecondary }]}>
              6-Month Trend
            </Text>
            <NetWorthSparkline profileId={profileId} />
          </View>

          {/* ── Assets section ── */}
          <View
            style={[
              styles.section,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <SectionHeader
              icon="wallet-outline"
              title="Assets"
              total={assets.reduce((s, a) => s + (a.value || 0), 0)}
              totalColor={colors.income}
              onAdd={openAddAsset}
            />

            {assets.length === 0 ? (
              <View style={styles.emptySection}>
                <Text style={[styles.emptySectionText, { color: colors.textSecondary }]}>
                  No assets yet. Tap Add to get started.
                </Text>
              </View>
            ) : (
              assets.map((a) => (
                <AssetRow
                  key={a.asset_id}
                  item={a}
                  onEdit={() => openEditAsset(a)}
                  onDelete={() => handleDeleteAsset(a)}
                />
              ))
            )}
          </View>

          {/* ── Liabilities section ── */}
          <View
            style={[
              styles.section,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <SectionHeader
              icon="card-outline"
              title="Liabilities"
              total={liabilities.reduce((s, l) => s + (l.balance || 0), 0)}
              totalColor={colors.expense}
              onAdd={openAddLiability}
            />

            {liabilities.length === 0 ? (
              <View style={styles.emptySection}>
                <Text style={[styles.emptySectionText, { color: colors.textSecondary }]}>
                  No liabilities recorded.
                </Text>
              </View>
            ) : (
              liabilities.map((l) => (
                <LiabilityRow
                  key={l.liability_id}
                  item={l}
                  onEdit={() => openEditLiability(l)}
                  onDelete={() => handleDeleteLiability(l)}
                />
              ))
            )}
          </View>
        </ScrollView>
      </SafeAreaView>

      {/* ── Add/Edit Modal ── */}
      <Modal visible={modalVisible} animationType="slide" transparent onRequestClose={closeModal}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            {/* Modal header */}
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
                {modalState.mode === "asset_create" && "Add Asset"}
                {modalState.mode === "asset_edit" && "Edit Asset"}
                {modalState.mode === "liability_create" && "Add Liability"}
                {modalState.mode === "liability_edit" && "Edit Liability"}
              </Text>
              <TouchableOpacity
                style={styles.iconButton}
                onPress={closeModal}
                disabled={isSubmitting}
              >
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Name */}
            <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Name *</Text>
            <TextInput
              style={[
                styles.input,
                {
                  borderColor: colors.border,
                  color: colors.textPrimary,
                  backgroundColor: colors.surface,
                },
              ]}
              value={modalState.name}
              onChangeText={(v) => setModalState((s) => ({ ...s, name: v }))}
              placeholder={isAssetMode ? "e.g. Checking Account" : "e.g. Student Loan"}
              placeholderTextColor={colors.textSecondary}
              editable={!isSubmitting}
              autoCapitalize="words"
            />

            {/* Type picker */}
            <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Type *</Text>
            <View style={styles.typeRow}>
              {(isAssetMode ? ASSET_TYPES : LIABILITY_TYPES).map((t) => (
                <TouchableOpacity
                  key={t}
                  style={[
                    styles.typeChip,
                    { backgroundColor: colors.surfaceHover },
                    modalState.type === t && { backgroundColor: colors.primary },
                  ]}
                  onPress={() => setModalState((s) => ({ ...s, type: t }))}
                  disabled={isSubmitting}
                >
                  <Text
                    style={[
                      styles.typeChipText,
                      { color: colors.textPrimary },
                      modalState.type === t && { color: "#FFF" },
                    ]}
                  >
                    {t}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Value / Balance */}
            <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>
              {isAssetMode ? "Current Value ($) *" : "Current Balance ($) *"}
            </Text>
            <TextInput
              style={[
                styles.input,
                {
                  borderColor: colors.border,
                  color: colors.textPrimary,
                  backgroundColor: colors.surface,
                },
              ]}
              value={isAssetMode ? modalState.value : modalState.balance}
              onChangeText={(v) =>
                setModalState((s) => (isAssetMode ? { ...s, value: v } : { ...s, balance: v }))
              }
              placeholder="0.00"
              keyboardType="decimal-pad"
              placeholderTextColor={colors.textSecondary}
              editable={!isSubmitting}
            />

            {/* Liability-only optional fields */}
            {!isAssetMode && (
              <View style={styles.optionalRow}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>
                    Interest Rate % (opt.)
                  </Text>
                  <TextInput
                    style={[
                      styles.input,
                      {
                        borderColor: colors.border,
                        color: colors.textPrimary,
                        backgroundColor: colors.surface,
                      },
                    ]}
                    value={modalState.interestRate}
                    onChangeText={(v) => setModalState((s) => ({ ...s, interestRate: v }))}
                    placeholder="e.g. 4.5"
                    keyboardType="decimal-pad"
                    placeholderTextColor={colors.textSecondary}
                    editable={!isSubmitting}
                  />
                </View>
                <View style={{ width: 10 }} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>
                    Monthly Pay $ (opt.)
                  </Text>
                  <TextInput
                    style={[
                      styles.input,
                      {
                        borderColor: colors.border,
                        color: colors.textPrimary,
                        backgroundColor: colors.surface,
                      },
                    ]}
                    value={modalState.monthlyPayment}
                    onChangeText={(v) => setModalState((s) => ({ ...s, monthlyPayment: v }))}
                    placeholder="0.00"
                    keyboardType="decimal-pad"
                    placeholderTextColor={colors.textSecondary}
                    editable={!isSubmitting}
                  />
                </View>
              </View>
            )}

            {/* Submit */}
            <TouchableOpacity
              style={[
                styles.submitBtn,
                { backgroundColor: colors.primary },
                isSubmitting && styles.submitBtnDisabled,
              ]}
              onPress={handleSubmit}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <Text style={styles.submitBtnText}>
                  {modalState.mode.includes("edit") ? "Save" : "Add"}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10, padding: 24 },
  loadingText: { fontSize: 13, marginTop: 8 },
  emptyTitle: { fontSize: 18, fontWeight: "700", textAlign: "center" },
  emptySubtitle: { fontSize: 13, textAlign: "center", lineHeight: 20 },

  content: { padding: 16, gap: 12, paddingBottom: 100 },

  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 4,
  },
  screenTitle: { fontSize: 28, fontWeight: "800" },
  screenSubtitle: { fontSize: 13, marginTop: 2 },

  profilePicker: { flexDirection: "row", flexWrap: "wrap", gap: 6, maxWidth: 200 },
  profileChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  profileChipText: { fontSize: 11, fontWeight: "600" },

  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    flexWrap: "wrap",
  },
  bannerText: { fontSize: 13, fontWeight: "600", flex: 1 },
  retryText: { fontSize: 11 },

  // Summary card
  summaryCard: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 0.5,
    gap: 12,
  },
  summaryMain: { gap: 4 },
  summaryLabel: { fontSize: 12, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.8 },
  summaryValue: { fontSize: 36, fontWeight: "900", letterSpacing: -1 },
  summaryPills: { flexDirection: "row", gap: 10 },
  summaryPill: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 10,
    padding: 10,
  },
  summaryPillValue: { fontSize: 14, fontWeight: "700" },
  summaryPillLabel: { fontSize: 11, fontWeight: "500" },

  // Sparkline
  sparklineCard: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 0.5,
    gap: 10,
  },
  sparklineTitle: {
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  chartContainer: { overflow: "hidden", borderRadius: 8 },
  chartPlaceholder: {
    height: 80,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  chartEmpty: { fontSize: 12, textAlign: "center", paddingHorizontal: 16 },

  // Section
  section: {
    borderRadius: 16,
    padding: 14,
    borderWidth: 0.5,
    gap: 4,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  sectionHeaderLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  sectionTitle: { fontSize: 16, fontWeight: "700" },
  sectionTotal: { fontSize: 14, fontWeight: "600" },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  addBtnText: { color: "#FFF", fontSize: 12, fontWeight: "700" },
  emptySection: { paddingVertical: 16, alignItems: "center" },
  emptySectionText: { fontSize: 13 },

  // Row
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
    borderTopWidth: 0.5,
    gap: 8,
  },
  rowInfo: { flex: 1, gap: 4 },
  rowName: { fontSize: 14, fontWeight: "600" },
  rowMetaRow: { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" },
  typeBadge: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  typeBadgeText: { fontSize: 11, fontWeight: "700", textTransform: "capitalize" },
  metaText: { fontSize: 11 },
  rowRight: { flexDirection: "row", alignItems: "center", gap: 6 },
  rowValue: { fontSize: 14, fontWeight: "700", minWidth: 60, textAlign: "right" },
  iconBtn: {
    minWidth: 32,
    minHeight: 32,
    alignItems: "center",
    justifyContent: "center",
  },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: Platform.OS === "ios" ? 36 : 24,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  modalTitle: { fontSize: 18, fontWeight: "700" },
  iconButton: { minWidth: 44, minHeight: 44, alignItems: "center", justifyContent: "center" },
  inputLabel: { fontSize: 13, marginTop: 10, marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
  typeRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  typeChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
    minHeight: 34,
    justifyContent: "center",
  },
  typeChipText: { fontSize: 12, fontWeight: "600", textTransform: "capitalize" },
  optionalRow: { flexDirection: "row", alignItems: "flex-start" },
  submitBtn: {
    marginTop: 16,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  submitBtnDisabled: { opacity: 0.65 },
  submitBtnText: { color: "#FFF", fontSize: 15, fontWeight: "700" },
});
