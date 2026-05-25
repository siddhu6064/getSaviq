import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useAuth } from "../src/contexts/AuthContext";
import { useAppStore } from "../src/store/appStore";
import { invitesAPI } from "../src/services/api";

interface InviteInfo {
  status: string;
  invite_token: string;
  invited_email: string;
  profile_id: string;
  profile_name: string;
  inviter_name: string;
}

type ErrorType =
  | "not_found"
  | "expired"
  | "declined"
  | "already_accepted"
  | "email_mismatch"
  | "error";

const ERROR_CONFIGS: Record<
  ErrorType,
  { icon: keyof typeof Ionicons.glyphMap; color: string; title: string; desc: string }
> = {
  not_found: {
    icon: "close-circle",
    color: "#FF3B30",
    title: "Invalid invite",
    desc: "This invite link is not valid or doesn't exist. Please check the link and try again.",
  },
  expired: {
    icon: "time",
    color: "#FF9500",
    title: "Invite expired",
    desc: "This invite link has expired. Ask the sender to send a new one.",
  },
  declined: {
    icon: "close-circle",
    color: "#8E8E93",
    title: "Invite declined",
    desc: "This invite was already declined.",
  },
  already_accepted: {
    icon: "checkmark-circle",
    color: "#34C759",
    title: "Already a member",
    desc: "This invite has already been accepted. You're already a member of this profile.",
  },
  email_mismatch: {
    icon: "alert-circle",
    color: "#FF3B30",
    title: "Wrong account",
    desc: "This invite was sent to a different email address.",
  },
  error: {
    icon: "close-circle",
    color: "#FF3B30",
    title: "Something went wrong",
    desc: "We couldn't process this invite. Please try again later.",
  },
};

export default function AcceptInviteScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const router = useRouter();
  const { isAuthenticated, user } = useAuth();
  const { fetchProfiles, setActiveProfile, profiles } = useAppStore();

  const [inviteInfo, setInviteInfo] = useState<InviteInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [inviteError, setInviteError] = useState<ErrorType | null>(null);
  const [accepting, setAccepting] = useState(false);
  const [declining, setDeclining] = useState(false);
  const [done, setDone] = useState<"accepted" | "declined" | null>(null);

  useEffect(() => {
    if (!token) {
      setInviteError("not_found");
      setLoading(false);
      return;
    }

    invitesAPI
      .getInviteInfo(token)
      .then((res) => {
        setInviteInfo(res.data);
      })
      .catch((err) => {
        const status = err.response?.status;
        const detail: string = err.response?.data?.detail || "";
        if (status === 404) setInviteError("not_found");
        else if (status === 409) setInviteError("already_accepted");
        else if (status === 410) {
          if (detail.toLowerCase().includes("declined")) setInviteError("declined");
          else setInviteError("expired");
        } else {
          setInviteError("error");
        }
      })
      .finally(() => setLoading(false));
  }, [token]);

  const handleAccept = async () => {
    if (!token) return;
    try {
      setAccepting(true);
      await invitesAPI.acceptAuthenticated(token);
      setDone("accepted");
      // Refetch profiles and switch to the newly joined profile
      await fetchProfiles();
      const updatedProfiles = useAppStore.getState().profiles;
      const newProfile = updatedProfiles.find((p) => p.profile_id === inviteInfo?.profile_id);
      if (newProfile) {
        setActiveProfile(newProfile);
      }
      setTimeout(() => router.replace("/(tabs)" as any), 1500);
    } catch (err: any) {
      const status = err.response?.status;
      if (status === 409) {
        // Already accepted — treat as success
        setDone("accepted");
        setTimeout(() => router.replace("/(tabs)" as any), 1500);
      } else if (status === 403) {
        setInviteError("email_mismatch");
      } else {
        Alert.alert("Error", "Failed to accept invite. Please try again.");
      }
    } finally {
      setAccepting(false);
    }
  };

  const handleDecline = async () => {
    if (!token) return;
    try {
      setDeclining(true);
      await invitesAPI.decline(token);
      setDone("declined");
      setTimeout(() => router.replace("/(tabs)" as any), 1200);
    } catch {
      router.replace("/(tabs)" as any);
    } finally {
      setDeclining(false);
    }
  };

  // ── Loading ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  // ── Done: accepted ─────────────────────────────────────────────────────────

  if (done === "accepted") {
    return (
      <View style={styles.centered}>
        <View style={[styles.iconCircle, { backgroundColor: "#E8F5E9" }]}>
          <Ionicons name="checkmark-circle" size={48} color="#34C759" />
        </View>
        <Text style={styles.doneTitle}>Welcome aboard!</Text>
        <Text style={styles.doneDesc}>
          You've joined{" "}
          <Text style={{ fontWeight: "700" }}>
            "{inviteInfo?.profile_name || "the shared profile"}"
          </Text>
          .
        </Text>
        <ActivityIndicator size="small" color="#007AFF" style={{ marginTop: 16 }} />
      </View>
    );
  }

  // ── Done: declined ─────────────────────────────────────────────────────────

  if (done === "declined") {
    return (
      <View style={styles.centered}>
        <Text style={styles.doneDesc}>Invite declined.</Text>
        <ActivityIndicator size="small" color="#8E8E93" style={{ marginTop: 12 }} />
      </View>
    );
  }

  // ── Error ──────────────────────────────────────────────────────────────────

  if (inviteError) {
    const cfg = ERROR_CONFIGS[inviteError];
    return (
      <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
        <View style={styles.card}>
          <View style={[styles.iconCircle, { backgroundColor: cfg.color + "20" }]}>
            <Ionicons name={cfg.icon} size={40} color={cfg.color} />
          </View>
          <Text style={styles.inviteTitle}>{cfg.title}</Text>
          <Text style={styles.inviteDesc}>{cfg.desc}</Text>
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() => router.replace("/(tabs)" as any)}
          >
            <Text style={styles.primaryBtnText}>Go to Dashboard</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ── Main invite UI ─────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <View style={styles.card}>
        {/* Icon */}
        <View style={[styles.iconCircle, { backgroundColor: "#EFF6FF" }]}>
          <Ionicons name="people" size={40} color="#007AFF" />
        </View>

        <Text style={styles.inviteTitle}>You're invited!</Text>
        <Text style={styles.inviteDesc}>
          <Text style={{ fontWeight: "700" }}>{inviteInfo?.inviter_name || "Someone"}</Text> has
          invited you to join{" "}
          <Text style={{ fontWeight: "700" }}>
            "{inviteInfo?.profile_name || "a shared profile"}"
          </Text>{" "}
          on SAVIQ.
        </Text>

        {/* Info box */}
        <View style={styles.infoBox}>
          <Text style={styles.infoText}>
            As a member you'll be able to view and add transactions to this shared profile.
          </Text>
        </View>

        {inviteInfo?.invited_email ? (
          <Text style={styles.emailHint}>
            Invited to:{" "}
            <Text style={{ fontWeight: "600", color: "#000" }}>{inviteInfo.invited_email}</Text>
          </Text>
        ) : null}

        {/* Actions */}
        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.declineBtn, (declining || accepting) && { opacity: 0.5 }]}
            onPress={handleDecline}
            disabled={declining || accepting}
          >
            {declining ? (
              <ActivityIndicator size="small" color="#8E8E93" />
            ) : (
              <Text style={styles.declineBtnText}>Decline</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.acceptBtn, (accepting || declining) && { opacity: 0.5 }]}
            onPress={handleAccept}
            disabled={accepting || declining}
          >
            {accepting ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <Text style={styles.acceptBtnText}>Accept Invite</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8F8FA",
    justifyContent: "center",
    padding: 16,
  },
  centered: {
    flex: 1,
    backgroundColor: "#F8F8FA",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  card: {
    backgroundColor: "#FFF",
    borderRadius: 20,
    padding: 28,
    alignItems: "center",
    borderWidth: 0.5,
    borderColor: "#E5E5EA",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  inviteTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#000",
    marginBottom: 10,
    textAlign: "center",
  },
  inviteDesc: {
    fontSize: 15,
    color: "#555",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 16,
  },
  infoBox: {
    backgroundColor: "#EFF6FF",
    borderRadius: 12,
    padding: 14,
    marginBottom: 14,
    width: "100%",
  },
  infoText: {
    fontSize: 13,
    color: "#1D4ED8",
    textAlign: "center",
    lineHeight: 18,
  },
  emailHint: {
    fontSize: 12,
    color: "#8E8E93",
    marginBottom: 20,
  },
  actions: {
    flexDirection: "row",
    gap: 10,
    width: "100%",
  },
  declineBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E5EA",
    alignItems: "center",
    justifyContent: "center",
  },
  declineBtnText: {
    fontSize: 15,
    color: "#8E8E93",
    fontWeight: "600",
  },
  acceptBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: "#007AFF",
    alignItems: "center",
    justifyContent: "center",
  },
  acceptBtnText: {
    fontSize: 15,
    color: "#FFF",
    fontWeight: "700",
  },
  doneTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#000",
    marginTop: 16,
    marginBottom: 8,
  },
  doneDesc: {
    fontSize: 15,
    color: "#555",
    textAlign: "center",
    lineHeight: 22,
  },
  primaryBtn: {
    backgroundColor: "#007AFF",
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 28,
    marginTop: 20,
  },
  primaryBtnText: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "700",
  },
});
