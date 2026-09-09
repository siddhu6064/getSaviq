import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useTheme } from "../contexts/ThemeContext";
import { useAppStore } from "../store/appStore";
import { notificationsAPI } from "../services/api";

interface NotificationItem {
  notif_id: string;
  title: string;
  body: string;
  read: boolean;
  created_at: string;
  link?: string | null;
}

function timeAgo(dateStr: string): string {
  if (!dateStr) return "";
  const diffSec = (Date.now() - new Date(dateStr).getTime()) / 1000;
  if (diffSec < 60) return "just now";
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  return `${Math.floor(diffSec / 86400)}d ago`;
}

export function NotificationBell() {
  const { colors } = useTheme();
  const router = useRouter();
  const isGuestMode = useAppStore((s) => s.isGuestMode);
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const fetchNotifications = useCallback(async () => {
    if (isGuestMode) return;
    try {
      setIsLoading(true);
      const res = await notificationsAPI.getAll();
      setNotifications(Array.isArray(res.data) ? res.data : []);
    } catch {
      // best-effort — never break the dashboard
    } finally {
      setIsLoading(false);
    }
  }, [isGuestMode]);

  useEffect(() => {
    if (isGuestMode) return;
    fetchNotifications();
    const id = setInterval(fetchNotifications, 60_000);
    return () => clearInterval(id);
  }, [fetchNotifications, isGuestMode]);

  const handleMarkAllRead = async () => {
    try {
      await notificationsAPI.markAllRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    } catch {
      // ignore
    }
  };

  const handleNotificationPress = async (notif: NotificationItem) => {
    setIsOpen(false);
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    try {
      await notificationsAPI.markAllRead();
    } catch {
      // ignore
    }
    if (notif.link && notif.link.startsWith("/")) {
      router.push(notif.link as any);
    }
  };

  if (isGuestMode) return null;

  return (
    <>
      <TouchableOpacity
        onPress={() => setIsOpen(true)}
        style={[styles.bellButton, { borderColor: colors.border, backgroundColor: colors.surface }]}
        activeOpacity={0.8}
      >
        <Ionicons name="notifications-outline" size={18} color={colors.textPrimary} />
        {unreadCount > 0 && (
          <View style={[styles.badge, { backgroundColor: colors.expense }]}>
            <Text style={styles.badgeText}>{unreadCount > 9 ? "9+" : unreadCount}</Text>
          </View>
        )}
      </TouchableOpacity>

      <Modal
        visible={isOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setIsOpen(false)}
      >
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setIsOpen(false)}>
          <TouchableOpacity
            activeOpacity={1}
            style={[styles.sheet, { backgroundColor: colors.surface }]}
          >
            <View style={[styles.header, { borderBottomColor: colors.border }]}>
              <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Notifications</Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 16 }}>
                <TouchableOpacity onPress={handleMarkAllRead} disabled={unreadCount === 0}>
                  <Text
                    style={[
                      styles.markAllRead,
                      { color: colors.primary, opacity: unreadCount === 0 ? 0.4 : 1 },
                    ]}
                  >
                    Mark all read
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setIsOpen(false)}>
                  <Ionicons name="close" size={22} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>
            </View>

            <ScrollView style={styles.list}>
              {isLoading && notifications.length === 0 ? (
                <View style={styles.centerState}>
                  <ActivityIndicator size="small" color={colors.primary} />
                </View>
              ) : notifications.length === 0 ? (
                <View style={styles.centerState}>
                  <Ionicons name="notifications-outline" size={32} color={colors.textSecondary} />
                  <Text style={[styles.emptyTitle, { color: colors.textSecondary }]}>
                    No notifications yet
                  </Text>
                  <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
                    Budget alerts and goal milestones will appear here
                  </Text>
                </View>
              ) : (
                notifications.slice(0, 20).map((notif) => (
                  <TouchableOpacity
                    key={notif.notif_id}
                    onPress={() => handleNotificationPress(notif)}
                    style={[
                      styles.row,
                      { borderBottomColor: colors.border },
                      !notif.read && { backgroundColor: colors.primary + "0D" },
                    ]}
                  >
                    <View style={styles.rowTop}>
                      <View style={styles.rowTitleWrap}>
                        {!notif.read && (
                          <View style={[styles.unreadDot, { backgroundColor: colors.primary }]} />
                        )}
                        <Text
                          style={[styles.rowTitle, { color: colors.textPrimary }]}
                          numberOfLines={1}
                        >
                          {notif.title}
                        </Text>
                      </View>
                      <Text style={[styles.rowTime, { color: colors.textSecondary }]}>
                        {timeAgo(notif.created_at)}
                      </Text>
                    </View>
                    <Text
                      style={[styles.rowBody, { color: colors.textSecondary }]}
                      numberOfLines={2}
                    >
                      {notif.body}
                    </Text>
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  bellButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
  },
  badge: {
    position: "absolute",
    top: -2,
    right: -2,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 3,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: { color: "#FFFFFF", fontSize: 9, fontWeight: "700" },
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  sheet: { maxHeight: "70%", borderTopLeftRadius: 20, borderTopRightRadius: 20 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: { fontSize: 16, fontWeight: "700" },
  markAllRead: { fontSize: 13, fontWeight: "600" },
  list: { paddingBottom: 20 },
  centerState: { alignItems: "center", paddingVertical: 40, gap: 6, paddingHorizontal: 24 },
  emptyTitle: { fontSize: 14, fontWeight: "500" },
  emptySubtitle: { fontSize: 12, textAlign: "center" },
  row: { paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  rowTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  rowTitleWrap: { flexDirection: "row", alignItems: "center", gap: 6, flex: 1 },
  unreadDot: { width: 6, height: 6, borderRadius: 3 },
  rowTitle: { fontSize: 14, fontWeight: "600", flexShrink: 1 },
  rowTime: { fontSize: 10, marginLeft: 8 },
  rowBody: { fontSize: 12, marginTop: 3, marginLeft: 12 },
});
