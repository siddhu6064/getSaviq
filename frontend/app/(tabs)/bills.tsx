import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  SectionList,
  RefreshControl,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useAppStore } from "../../src/store/appStore";
import { billsAPI } from "../../src/services/api";
import {
  Bill,
  BillComputedStatus,
  computeBillStatus,
  getEffectiveDueDay,
  countDueSoonBills,
} from "../../src/utils/billsStatus";
import { useBillsStore } from "../../src/store/billsStore";
import { useTheme } from "../../src/contexts/ThemeContext";

// ===================== TYPES =====================

interface BillForm {
  name: string;
  merchant: string;
  expected_amount: string;
  frequency: "monthly" | "weekly" | "annual";
  due_day: string;
  status: "active" | "paused";
}

const defaultForm: BillForm = {
  name: "",
  merchant: "",
  expected_amount: "",
  frequency: "monthly",
  due_day: "1",
  status: "active",
};

// ===================== STATUS CONFIG =====================

const STATUS_CONFIG: Record<
  BillComputedStatus,
  { label: string; color: string; bg: string; order: number }
> = {
  overdue: { label: "Overdue", color: "#EF4444", bg: "#FEE2E2", order: 0 },
  due_soon: { label: "Due Soon", color: "#D97706", bg: "#FEF3C7", order: 1 },
  upcoming: { label: "Upcoming", color: "#6B7280", bg: "#F3F4F6", order: 2 },
  paid: { label: "Paid", color: "#059669", bg: "#D1FAE5", order: 3 },
};

const SECTION_LABELS: Record<BillComputedStatus, string> = {
  overdue: "Overdue",
  due_soon: "Due Soon",
  upcoming: "Upcoming",
  paid: "Paid This Cycle",
};

const FREQ_LABELS: Record<string, string> = {
  monthly: "Monthly",
  weekly: "Weekly",
  annual: "Annual",
};

// ===================== BILL CARD =====================

function BillCard({
  bill,
  computedStatus,
  onEdit,
  onDelete,
}: {
  bill: Bill;
  computedStatus: BillComputedStatus;
  onEdit: (bill: Bill) => void;
  onDelete: (bill: Bill) => void;
}) {
  const { colors } = useTheme();
  const cfg = STATUS_CONFIG[computedStatus];
  const effectiveDueDay = getEffectiveDueDay(bill.due_day);
  const today = new Date();
  const dueDate = new Date(today.getFullYear(), today.getMonth(), effectiveDueDay);
  const dueDateStr = dueDate.toLocaleDateString("en-US", { month: "short", day: "numeric" });

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.cardMain}>
        <View style={styles.cardLeft}>
          <Text style={[styles.billName, { color: colors.textPrimary }]} numberOfLines={1}>
            {bill.name}
          </Text>
          {bill.merchant ? (
            <Text style={[styles.billMerchant, { color: colors.textSecondary }]} numberOfLines={1}>
              {bill.merchant}
            </Text>
          ) : null}
          <View style={styles.badgeRow}>
            <View style={[styles.freqBadge, { backgroundColor: colors.surfaceHover }]}>
              <Text style={[styles.freqBadgeText, { color: colors.textSecondary }]}>
                {FREQ_LABELS[bill.frequency] || bill.frequency}
              </Text>
            </View>
            <View style={[styles.statusPill, { backgroundColor: cfg.bg }]}>
              <Text style={[styles.statusPillText, { color: cfg.color }]}>{cfg.label}</Text>
            </View>
          </View>
        </View>

        <View style={styles.cardRight}>
          <Text style={[styles.amount, { color: colors.textPrimary }]}>
            $
            {bill.expected_amount.toLocaleString("en-US", {
              minimumFractionDigits: 0,
              maximumFractionDigits: 0,
            })}
          </Text>
          <Text style={[styles.dueDate, { color: colors.textSecondary }]}>Due {dueDateStr}</Text>
        </View>
      </View>

      <View style={[styles.cardActions, { borderTopColor: colors.border }]}>
        <TouchableOpacity
          style={[styles.actionBtn, { backgroundColor: colors.surfaceHover }]}
          onPress={() => onEdit(bill)}
        >
          <Ionicons name="pencil-outline" size={14} color={colors.primary} />
          <Text style={[styles.actionBtnText, { color: colors.primary }]}>Edit</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionBtn, { backgroundColor: "#FEE2E2" }]}
          onPress={() => onDelete(bill)}
        >
          <Ionicons name="trash-outline" size={14} color="#EF4444" />
          <Text style={[styles.actionBtnText, { color: "#EF4444" }]}>Delete</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ===================== ADD/EDIT MODAL =====================

function AddBillModal({
  visible,
  onClose,
  onSuccess,
  profileId,
  editingBill,
}: {
  visible: boolean;
  onClose: () => void;
  onSuccess: (msg: string) => void;
  profileId?: string;
  editingBill: Bill | null;
}) {
  const { colors } = useTheme();
  const [form, setForm] = useState<BillForm>(defaultForm);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const mode = editingBill ? "edit" : "create";

  useEffect(() => {
    if (!visible) return;
    if (editingBill) {
      setForm({
        name: editingBill.name || "",
        merchant: editingBill.merchant || "",
        expected_amount: String(editingBill.expected_amount || ""),
        frequency: editingBill.frequency || "monthly",
        due_day: String(editingBill.due_day || "1"),
        status: editingBill.status || "active",
      });
    } else {
      setForm(defaultForm);
    }
  }, [visible, editingBill]);

  const handleSubmit = async () => {
    if (isSubmitting) return;
    const name = form.name.trim();
    if (!name) {
      Alert.alert("Validation", "Name is required.");
      return;
    }
    const amountVal = parseFloat(form.expected_amount);
    if (isNaN(amountVal) || amountVal <= 0) {
      Alert.alert("Validation", "Enter a valid amount greater than 0.");
      return;
    }
    const dueDayVal = parseInt(form.due_day, 10);
    if (isNaN(dueDayVal) || dueDayVal < 1 || dueDayVal > 31) {
      Alert.alert("Validation", "Due day must be between 1 and 31.");
      return;
    }
    if (!profileId) {
      Alert.alert("Error", "No active profile selected.");
      return;
    }

    try {
      setIsSubmitting(true);
      const payload = {
        profile_id: profileId,
        name,
        merchant: form.merchant.trim() || null,
        expected_amount: amountVal,
        frequency: form.frequency,
        due_day: dueDayVal,
        status: form.status,
      };

      if (mode === "edit" && editingBill?.bill_id) {
        const { profile_id, ...updatePayload } = payload;
        await billsAPI.update(editingBill.bill_id, updatePayload);
        onSuccess("Bill updated.");
      } else {
        await billsAPI.create(payload);
        onSuccess("Bill added.");
      }
    } catch {
      Alert.alert("Error", mode === "edit" ? "Failed to update bill." : "Failed to create bill.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const inputStyle = [
    styles.input,
    { borderColor: colors.border, color: colors.textPrimary, backgroundColor: colors.surface },
  ];
  const labelStyle = [styles.inputLabel, { color: colors.textSecondary }];

  const FREQ_OPTIONS: Array<{ value: BillForm["frequency"]; label: string }> = [
    { value: "monthly", label: "Monthly" },
    { value: "weekly", label: "Weekly" },
    { value: "annual", label: "Annual" },
  ];
  const STATUS_OPTIONS: Array<{ value: BillForm["status"]; label: string }> = [
    { value: "active", label: "Active" },
    { value: "paused", label: "Paused" },
  ];

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
              {mode === "edit" ? "Edit Bill" : "Add Bill"}
            </Text>
            <TouchableOpacity style={styles.iconButton} onPress={onClose} disabled={isSubmitting}>
              <Ionicons name="close" size={24} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <Text style={labelStyle}>Name *</Text>
            <TextInput
              style={inputStyle}
              value={form.name}
              onChangeText={(v) => setForm((p) => ({ ...p, name: v }))}
              placeholder="e.g. Netflix"
              placeholderTextColor={colors.textSecondary}
              editable={!isSubmitting}
            />

            <Text style={labelStyle}>Merchant (optional)</Text>
            <TextInput
              style={inputStyle}
              value={form.merchant}
              onChangeText={(v) => setForm((p) => ({ ...p, merchant: v }))}
              placeholder="e.g. Netflix Inc."
              placeholderTextColor={colors.textSecondary}
              editable={!isSubmitting}
            />

            <Text style={labelStyle}>Expected Amount *</Text>
            <TextInput
              style={inputStyle}
              value={form.expected_amount}
              onChangeText={(v) => setForm((p) => ({ ...p, expected_amount: v }))}
              placeholder="0.00"
              keyboardType="decimal-pad"
              placeholderTextColor={colors.textSecondary}
              editable={!isSubmitting}
            />

            <Text style={labelStyle}>Due Day (1–31) *</Text>
            <TextInput
              style={inputStyle}
              value={form.due_day}
              onChangeText={(v) => setForm((p) => ({ ...p, due_day: v }))}
              placeholder="1"
              keyboardType="number-pad"
              placeholderTextColor={colors.textSecondary}
              editable={!isSubmitting}
            />

            <Text style={labelStyle}>Frequency</Text>
            <View style={styles.chipRow}>
              {FREQ_OPTIONS.map((opt) => (
                <TouchableOpacity
                  key={opt.value}
                  style={[
                    styles.chip,
                    { backgroundColor: colors.surfaceHover },
                    form.frequency === opt.value && { backgroundColor: colors.primary },
                  ]}
                  onPress={() => setForm((p) => ({ ...p, frequency: opt.value }))}
                  disabled={isSubmitting}
                >
                  <Text
                    style={[
                      styles.chipText,
                      { color: colors.textPrimary },
                      form.frequency === opt.value && styles.chipTextActive,
                    ]}
                  >
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={labelStyle}>Status</Text>
            <View style={styles.chipRow}>
              {STATUS_OPTIONS.map((opt) => (
                <TouchableOpacity
                  key={opt.value}
                  style={[
                    styles.chip,
                    { backgroundColor: colors.surfaceHover },
                    form.status === opt.value && { backgroundColor: colors.primary },
                  ]}
                  onPress={() => setForm((p) => ({ ...p, status: opt.value }))}
                  disabled={isSubmitting}
                >
                  <Text
                    style={[
                      styles.chipText,
                      { color: colors.textPrimary },
                      form.status === opt.value && styles.chipTextActive,
                    ]}
                  >
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              style={[
                styles.saveButton,
                { backgroundColor: colors.primary },
                isSubmitting && styles.saveButtonDisabled,
              ]}
              onPress={handleSubmit}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <Text style={styles.saveButtonText}>
                  {mode === "edit" ? "Update Bill" : "Add Bill"}
                </Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

// ===================== MAIN SCREEN =====================

export default function BillsScreen() {
  const { colors } = useTheme();
  const { activeProfile } = useAppStore();
  const setDueSoonCount = useBillsStore((s) => s.setDueSoonCount);

  const [bills, setBills] = useState<Bill[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editingBill, setEditingBill] = useState<Bill | null>(null);
  const previousProfileIdRef = useRef<string | null>(null);

  const loadBills = useCallback(
    async (refresh = false) => {
      if (!activeProfile?.profile_id) {
        setBills([]);
        setIsLoading(false);
        setIsRefreshing(false);
        return;
      }
      try {
        if (refresh) setIsRefreshing(true);
        else setIsLoading(true);
        setError("");
        const res = await billsAPI.getAll({ profile_id: activeProfile.profile_id });
        const data = Array.isArray(res.data) ? res.data : [];
        setBills(data);
        setDueSoonCount(countDueSoonBills(data));
      } catch {
        setError("Failed to load bills. Pull to retry.");
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [activeProfile?.profile_id, setDueSoonCount],
  );

  useEffect(() => {
    const nextId = activeProfile?.profile_id || null;
    if (nextId !== previousProfileIdRef.current) {
      setBills([]);
      setError("");
      setSuccess("");
      previousProfileIdRef.current = nextId;
    }
  }, [activeProfile?.profile_id]);

  useEffect(() => {
    loadBills();
  }, [loadBills]);

  useEffect(() => {
    if (!success) return;
    const t = setTimeout(() => setSuccess(""), 2500);
    return () => clearTimeout(t);
  }, [success]);

  // Enrich + group by status
  const enriched = useMemo(
    () => bills.map((b) => ({ ...b, _status: computeBillStatus(b) })),
    [bills],
  );

  const sections = useMemo(() => {
    const order: BillComputedStatus[] = ["overdue", "due_soon", "upcoming", "paid"];
    const grouped: Record<BillComputedStatus, typeof enriched> = {
      overdue: [],
      due_soon: [],
      upcoming: [],
      paid: [],
    };
    enriched.forEach((b) => grouped[b._status].push(b));
    return order
      .filter((s) => grouped[s].length > 0)
      .map((s) => ({
        key: s,
        title: SECTION_LABELS[s],
        data: grouped[s],
      }));
  }, [enriched]);

  // Summary
  const activeBills = useMemo(() => bills.filter((b) => b.status === "active"), [bills]);
  const totalMonthly = useMemo(
    () =>
      activeBills.reduce((sum, b) => {
        if (b.frequency === "monthly") return sum + b.expected_amount;
        if (b.frequency === "weekly") return sum + b.expected_amount * 4.33;
        if (b.frequency === "annual") return sum + b.expected_amount / 12;
        return sum;
      }, 0),
    [activeBills],
  );

  const openCreate = () => {
    setEditingBill(null);
    setShowModal(true);
  };

  const openEdit = (bill: Bill) => {
    setEditingBill(bill);
    setShowModal(true);
  };

  const handleDelete = (bill: Bill) => {
    Alert.alert("Delete Bill", `Delete "${bill.name}"?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await billsAPI.delete(bill.bill_id);
            const next = bills.filter((b) => b.bill_id !== bill.bill_id);
            setBills(next);
            setDueSoonCount(countDueSoonBills(next));
            setSuccess("Bill deleted.");
          } catch {
            Alert.alert("Error", "Failed to delete bill.");
          }
        },
      },
    ]);
  };

  const handleModalSuccess = (msg: string) => {
    setShowModal(false);
    setEditingBill(null);
    setSuccess(msg);
    loadBills();
  };

  if (isLoading) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading bills...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <SafeAreaView style={styles.safeArea} edges={["top"]}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={[styles.title, { color: colors.textPrimary }]}>Bills</Text>
            {!error && (
              <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                {activeBills.length} bill{activeBills.length !== 1 ? "s" : ""} · $
                {totalMonthly.toLocaleString("en-US", { maximumFractionDigits: 0 })} /mo
              </Text>
            )}
          </View>
          <TouchableOpacity
            style={[styles.addButton, { backgroundColor: colors.primary }]}
            onPress={openCreate}
          >
            <Ionicons name="add" size={18} color="#FFF" />
            <Text style={styles.addButtonText}>New</Text>
          </TouchableOpacity>
        </View>

        {/* Error banner */}
        {error ? (
          <TouchableOpacity
            style={[
              styles.errorCard,
              { backgroundColor: colors.surface, borderColor: colors.expense },
            ]}
            onPress={() => loadBills()}
            activeOpacity={0.8}
          >
            <Ionicons name="alert-circle-outline" size={18} color={colors.expense} />
            <Text style={[styles.errorText, { color: colors.expense }]}>{error}</Text>
            <Text style={[styles.retryText, { color: colors.expense }]}>Tap to retry</Text>
          </TouchableOpacity>
        ) : null}

        {/* Success banner */}
        {success ? (
          <View
            style={[
              styles.successCard,
              { backgroundColor: colors.surface, borderColor: colors.income },
            ]}
          >
            <Ionicons name="checkmark-circle-outline" size={18} color={colors.income} />
            <Text style={[styles.successText, { color: colors.income }]}>{success}</Text>
          </View>
        ) : null}

        {/* No profile */}
        {!activeProfile ? (
          <View style={styles.emptyState}>
            <Ionicons name="receipt-outline" size={42} color={colors.textSecondary} />
            <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>
              No profile selected
            </Text>
            <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
              Select a profile to manage your bills.
            </Text>
          </View>
        ) : bills.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="receipt-outline" size={42} color={colors.textSecondary} />
            <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>No bills yet</Text>
            <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
              Track recurring payments like rent, utilities, and subscriptions.
            </Text>
            <TouchableOpacity
              style={[styles.emptyCta, { backgroundColor: colors.primary }]}
              onPress={openCreate}
            >
              <Text style={styles.emptyCtaText}>Add First Bill</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <SectionList
            sections={sections}
            keyExtractor={(item) => item.bill_id}
            contentContainerStyle={styles.listContent}
            refreshControl={
              <RefreshControl refreshing={isRefreshing} onRefresh={() => loadBills(true)} />
            }
            renderSectionHeader={({ section }) => (
              <View style={[styles.sectionHeader, { backgroundColor: colors.surfaceHover }]}>
                <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
                  {section.title.toUpperCase()}
                </Text>
                <Text style={[styles.sectionCount, { color: colors.textSecondary }]}>
                  {section.data.length} bill{section.data.length !== 1 ? "s" : ""}
                </Text>
              </View>
            )}
            renderItem={({ item }) => (
              <BillCard
                bill={item}
                computedStatus={item._status}
                onEdit={openEdit}
                onDelete={handleDelete}
              />
            )}
          />
        )}
      </SafeAreaView>

      <AddBillModal
        visible={showModal}
        onClose={() => {
          setShowModal(false);
          setEditingBill(null);
        }}
        onSuccess={handleModalSuccess}
        profileId={activeProfile?.profile_id}
        editingBill={editingBill}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  loadingText: { fontSize: 14 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  title: { fontSize: 28, fontWeight: "800" },
  subtitle: { fontSize: 13, marginTop: 2 },
  addButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  addButtonText: { color: "#FFF", fontWeight: "700", fontSize: 14 },
  errorCard: {
    marginHorizontal: 16,
    marginBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  errorText: { flex: 1, fontSize: 13 },
  retryText: { fontSize: 12, fontWeight: "700" },
  successCard: {
    marginHorizontal: 16,
    marginBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  successText: { fontSize: 13, fontWeight: "600" },
  emptyState: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32, gap: 8 },
  emptyTitle: { fontSize: 18, fontWeight: "700" },
  emptySubtitle: { fontSize: 14, textAlign: "center" },
  emptyCta: { marginTop: 8, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10 },
  emptyCtaText: { color: "#FFF", fontWeight: "700", fontSize: 15 },
  listContent: { paddingBottom: 120 },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  sectionTitle: { fontSize: 11, fontWeight: "700", letterSpacing: 0.8 },
  sectionCount: { fontSize: 11 },
  card: {
    marginHorizontal: 16,
    marginVertical: 4,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
  },
  cardMain: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    padding: 14,
    gap: 8,
  },
  cardLeft: { flex: 1, gap: 4 },
  billName: { fontSize: 15, fontWeight: "700" },
  billMerchant: { fontSize: 12 },
  badgeRow: { flexDirection: "row", gap: 6, marginTop: 4, flexWrap: "wrap" },
  freqBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  freqBadgeText: { fontSize: 11, fontWeight: "600" },
  statusPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  statusPillText: { fontSize: 11, fontWeight: "700" },
  cardRight: { alignItems: "flex-end", gap: 2 },
  amount: { fontSize: 16, fontWeight: "800" },
  dueDate: { fontSize: 12 },
  cardActions: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 14,
    paddingBottom: 10,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  actionBtnText: { fontSize: 12, fontWeight: "700" },
  // Modal
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 16,
    paddingBottom: 34,
    maxHeight: "90%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  modalTitle: { fontSize: 18, fontWeight: "700" },
  iconButton: { padding: 4 },
  inputLabel: { marginTop: 12, marginBottom: 6, fontSize: 13 },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
  chipRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  chip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 16 },
  chipText: { fontSize: 13, fontWeight: "600" },
  chipTextActive: { color: "#FFF" },
  saveButton: { marginTop: 20, borderRadius: 10, paddingVertical: 14, alignItems: "center" },
  saveButtonDisabled: { opacity: 0.7 },
  saveButtonText: { color: "#FFF", fontSize: 15, fontWeight: "700" },
});
