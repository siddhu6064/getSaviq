import React, { useEffect, useRef, useState } from "react";
import { Slot, useRouter, useSegments, usePathname } from "expo-router";
import { AuthProvider, useAuth } from "../src/contexts/AuthContext";
import { ThemeProvider } from "../src/contexts/ThemeContext";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  View,
  Text,
  Animated,
  ActivityIndicator,
  StyleSheet,
  StatusBar,
  Platform,
} from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { lightTheme } from "../src/components/NeumorphicUI";
import { AppLockGate } from "../src/components/AppLockGate";
import * as Linking from "expo-linking";
import * as SecureStore from "expo-secure-store";
import * as Notifications from "expo-notifications";
import notificationService from "../src/services/notificationService";
import { pushAPI } from "../src/services/api";
import {
  deriveAuthRouteAction,
  deriveDeepLinkNavigationTarget,
} from "../src/utils/authRouteGuardState";

// ─── In-app notification banner ───────────────────────────────────────────────
interface BannerState {
  title: string;
  body: string;
}

function InAppBanner({
  banner,
  slideAnim,
}: {
  banner: BannerState | null;
  slideAnim: Animated.Value;
}) {
  if (!banner) return null;
  return (
    <Animated.View
      style={[bannerStyles.container, { transform: [{ translateY: slideAnim }] }]}
      pointerEvents="none"
    >
      <Text style={bannerStyles.title} numberOfLines={1}>
        {banner.title}
      </Text>
      <Text style={bannerStyles.body} numberOfLines={2}>
        {banner.body}
      </Text>
    </Animated.View>
  );
}

// ─── Root layout navigator ────────────────────────────────────────────────────
function RootLayoutNav() {
  const { isLoading, isAuthenticated, signInWithGoogle } = useAuth();
  const router = useRouter();
  const segments = useSegments();
  const pathname = usePathname();
  const hasProcessedCallback = useRef(false);
  const pendingDeepLink = useRef<string | null>(null);
  const notificationListener = useRef<Notifications.EventSubscription | null>(null);
  const responseListener = useRef<Notifications.EventSubscription | null>(null);
  const pushRegistered = useRef(false);

  // In-app banner state
  const [banner, setBanner] = useState<BannerState | null>(null);
  const slideAnim = useRef(new Animated.Value(-80)).current;
  const bannerTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showBanner = (title: string, body: string) => {
    if (bannerTimer.current) clearTimeout(bannerTimer.current);
    setBanner({ title, body });
    Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, friction: 8 }).start();
    bannerTimer.current = setTimeout(() => {
      Animated.timing(slideAnim, {
        toValue: -80,
        duration: 300,
        useNativeDriver: true,
      }).start(() => setBanner(null));
    }, 3500);
  };

  // Register Expo push token once after login (fire-and-forget, non-blocking)
  useEffect(() => {
    if (isAuthenticated && !pushRegistered.current && Platform.OS !== "web") {
      pushRegistered.current = true;
      notificationService.registerExpoPushToken(pushAPI.register).catch(() => {
        // Silently ignore — never block app
      });
    }
  }, [isAuthenticated]);

  // Handle notification tap → navigate to Add Expense screen
  useEffect(() => {
    if (Platform.OS === "web") return;

    // Listener: notification received while app is open → show in-app banner
    notificationListener.current = Notifications.addNotificationReceivedListener((notification) => {
      const { title, body } = notification.request.content;
      if (title) showBanner(title, body || "");
    });

    // Listener: user tapped on a notification
    responseListener.current = Notifications.addNotificationResponseReceivedListener((response) => {
      const navPath = notificationService.extractNavigationFromNotification(response.notification);
      if (navPath && isAuthenticated) {
        setTimeout(() => router.push(navPath as any), 500);
      } else if (navPath && !isAuthenticated) {
        pendingDeepLink.current = navPath;
      }
    });

    // Check if app was launched from notification
    Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response) {
        const navPath = notificationService.extractNavigationFromNotification(
          response.notification,
        );
        if (navPath) {
          if (isAuthenticated) {
            setTimeout(() => router.push(navPath as any), 800);
          } else {
            pendingDeepLink.current = navPath;
          }
        }
      }
    });

    return () => {
      notificationListener.current?.remove();
      responseListener.current?.remove();
      if (bannerTimer.current) clearTimeout(bannerTimer.current);
    };
  }, [isAuthenticated]);

  // Handle deep links for Apple Shortcuts / Automation
  useEffect(() => {
    const handleDeepLink = (event: { url: string }) => {
      const url = event.url;
      if (!url) return;

      try {
        const parsed = Linking.parse(url);
        const path = (parsed.path || "").replace(/^\/+/, "").toLowerCase();
        const queryParams = parsed.queryParams || {};

        // Invite deep link — store token in AsyncStorage so it survives restart
        if (path === "accept-invite") {
          const token = queryParams.token ? String(queryParams.token) : null;
          if (token) {
            if (isAuthenticated) {
              router.push(`/accept-invite?token=${encodeURIComponent(token)}` as any);
            } else {
              (Platform.OS !== "web"
                ? SecureStore.setItemAsync("pending_invite_token", token)
                : AsyncStorage.setItem("pending_invite_token", token)
              ).catch(() => {});
            }
          }
          return;
        }

        const navPath = deriveDeepLinkNavigationTarget(path, queryParams);
        if (navPath) {
          if (isAuthenticated) {
            router.push(navPath as any);
          } else {
            // Store for after auth
            pendingDeepLink.current = navPath;
          }
        }
      } catch (e) {
        console.error("Deep link error:", e);
      }
    };

    // Listen for incoming deep links
    const subscription = Linking.addEventListener("url", handleDeepLink);

    // Check if app was opened via deep link
    Linking.getInitialURL().then((url) => {
      if (url) handleDeepLink({ url });
    });

    return () => subscription?.remove();
  }, [isAuthenticated]);

  // Handle OAuth callback from web
  useEffect(() => {
    if (Platform.OS === "web" && typeof window !== "undefined") {
      const hash = window.location.hash;
      if (hash && hash.includes("session_id=") && !hasProcessedCallback.current) {
        hasProcessedCallback.current = true;
        const sessionId = hash.split("session_id=")[1]?.split("&")[0];
        if (sessionId) {
          signInWithGoogle(sessionId)
            .then(() => {
              window.history.replaceState(null, "", window.location.pathname);
              router.replace("/(tabs)");
            })
            .catch((err) => {
              console.error("Auth callback error:", err);
              hasProcessedCallback.current = false;
            });
        }
      }
    }
  }, []);

  // Handle navigation based on auth state
  useEffect(() => {
    if (isLoading) return;

    const routeAction = deriveAuthRouteAction({
      isLoading,
      isAuthenticated,
      segments,
    });

    if (routeAction === "enter_tabs") {
      router.replace("/(tabs)");
      // Check for pending invite token (survives app restart)
      (Platform.OS !== "web"
        ? SecureStore.getItemAsync("pending_invite_token")
        : AsyncStorage.getItem("pending_invite_token")
      )
        .then((token) => {
          if (token) {
            (Platform.OS !== "web"
              ? SecureStore.deleteItemAsync("pending_invite_token")
              : AsyncStorage.removeItem("pending_invite_token")
            ).catch(() => {});
            setTimeout(() => {
              router.push(`/accept-invite?token=${encodeURIComponent(token)}` as any);
            }, 600);
          } else if (pendingDeepLink.current) {
            // Process other pending deep links
            setTimeout(() => {
              router.push(pendingDeepLink.current as any);
              pendingDeepLink.current = null;
            }, 500);
          }
        })
        .catch(() => {
          // Fallback: process in-memory pending link
          if (pendingDeepLink.current) {
            setTimeout(() => {
              router.push(pendingDeepLink.current as any);
              pendingDeepLink.current = null;
            }, 500);
          }
        });
    } else if (routeAction === "leave_tabs") {
      router.replace("/");
    }
  }, [isAuthenticated, isLoading, segments]);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={lightTheme.colors.primary} />
      </View>
    );
  }

  return (
    <AppLockGate isAuthenticated={isAuthenticated}>
      <View style={{ flex: 1 }}>
        <Slot />
        <InAppBanner banner={banner} slideAnim={slideAnim} />
      </View>
    </AppLockGate>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <StatusBar barStyle="dark-content" backgroundColor={lightTheme.colors.background} />
        <AuthProvider>
          <RootLayoutNav />
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: lightTheme.colors.background,
  },
});

const bannerStyles = StyleSheet.create({
  container: {
    position: "absolute",
    top: Platform.OS === "ios" ? 56 : 36,
    left: 16,
    right: 16,
    backgroundColor: "#1C1C1E",
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 10,
    zIndex: 9999,
  },
  title: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFFFFF",
    marginBottom: 2,
  },
  body: {
    fontSize: 13,
    color: "#EBEBF599",
    lineHeight: 18,
  },
});
