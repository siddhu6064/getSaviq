import React, { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, AppState, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as LocalAuthentication from "expo-local-authentication";
import { lightTheme } from "./NeumorphicUI";
import { shouldRequireUnlock, isForegroundTransition } from "../utils/appLockState";

export const APP_LOCK_ENABLED_KEY = "app_lock_enabled";

export function AppLockGate({
  children,
  isAuthenticated,
}: {
  children: React.ReactNode;
  isAuthenticated: boolean;
}) {
  const [enabled, setEnabled] = useState(false);
  const [locked, setLocked] = useState(false);
  const [checkingHardware, setCheckingHardware] = useState(true);
  const unlockedAt = useRef<number | null>(null);
  const authenticating = useRef(false);

  const attemptUnlock = useCallback(async () => {
    if (authenticating.current) return;
    authenticating.current = true;
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: "Unlock SAVIQ",
        disableDeviceFallback: false,
      });
      if (result.success) {
        unlockedAt.current = Date.now();
        setLocked(false);
      }
    } finally {
      authenticating.current = false;
    }
  }, []);

  useEffect(() => {
    if (Platform.OS === "web") {
      setCheckingHardware(false);
      return;
    }
    AsyncStorage.getItem(APP_LOCK_ENABLED_KEY)
      .then((v) => setEnabled(v === "true"))
      .finally(() => setCheckingHardware(false));
  }, []);

  useEffect(() => {
    if (Platform.OS === "web" || checkingHardware) return;
    if (
      shouldRequireUnlock({
        enabled,
        isAuthenticated,
        unlockedAt: unlockedAt.current,
        now: Date.now(),
      })
    ) {
      setLocked(true);
      attemptUnlock();
    }
  }, [enabled, checkingHardware, isAuthenticated, attemptUnlock]);

  useEffect(() => {
    if (Platform.OS === "web") return;
    const sub = AppState.addEventListener("change", (nextState) => {
      if (!isForegroundTransition({ nextState })) return;
      if (
        shouldRequireUnlock({
          enabled,
          isAuthenticated,
          unlockedAt: unlockedAt.current,
          now: Date.now(),
        })
      ) {
        setLocked(true);
        attemptUnlock();
      }
    });
    return () => sub.remove();
  }, [enabled, isAuthenticated, attemptUnlock]);

  if (Platform.OS === "web" || checkingHardware || !locked) {
    return <>{children}</>;
  }

  return (
    <View style={styles.container}>
      <View style={styles.iconCircle}>
        <Ionicons name="lock-closed" size={36} color={lightTheme.colors.primary} />
      </View>
      <Text style={styles.title}>SAVIQ Locked</Text>
      <Text style={styles.subtitle}>Unlock with Face ID or your passcode to continue</Text>
      <TouchableOpacity style={styles.unlockBtn} onPress={attemptUnlock} activeOpacity={0.85}>
        <Ionicons name="finger-print" size={20} color="#FFF" />
        <Text style={styles.unlockBtnText}>Unlock</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999,
    backgroundColor: lightTheme.colors.background,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
  },
  iconCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: "#EFF6FF",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: "800",
    color: lightTheme.colors.text,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: lightTheme.colors.textSecondary,
    textAlign: "center",
    marginBottom: 28,
  },
  unlockBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: lightTheme.colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 14,
  },
  unlockBtnText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFF",
  },
});
