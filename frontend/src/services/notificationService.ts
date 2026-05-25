import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  deriveRouteFromNotificationData,
  resolveNextHandledNotificationId,
  shouldSuppressDuplicateNotification,
} from "../utils/notificationRouteState";

// Configure how notifications appear when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

const EXPO_PUSH_TOKEN_KEY = "expo_push_token";

const REMINDER_ENABLED_KEY = "notification_reminder_enabled";
const REMINDER_HOUR_KEY = "notification_reminder_hour";
const REMINDER_MINUTE_KEY = "notification_reminder_minute";
const ONBOARDING_SEEN_KEY = "automation_onboarding_seen";
const APPLE_PAY_SETUP_SEEN_KEY = "apple_pay_setup_seen";

const WEEKLY_ENABLED_KEY = "weekly_summary_enabled";
const WEEKLY_DAY_KEY = "weekly_summary_day"; // 0=Sun … 6=Sat
const WEEKLY_HOUR_KEY = "weekly_summary_hour";
const WEEKLY_MINUTE_KEY = "weekly_summary_minute";
const WEEKLY_NOTIF_ID_KEY = "weekly_summary_notif_id";

export type NotificationSettings = {
  enabled: boolean;
  hour: number;
  minute: number;
};

export type WeeklySettings = {
  enabled: boolean;
  day: number; // 0=Sunday … 6=Saturday
  hour: number;
  minute: number;
};

// Day names for display
export const WEEK_DAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

export const notificationService = {
  _lastHandledNotificationId: "" as string,
  async requestPermissions(): Promise<boolean> {
    if (Platform.OS === "web") return false;

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    return finalStatus === "granted";
  },

  async getPermissionStatus(): Promise<string> {
    if (Platform.OS === "web") return "denied";
    const { status } = await Notifications.getPermissionsAsync();
    return status;
  },

  /**
   * Register this device's Expo push token with the backend.
   * Call fire-and-forget after login — never await in a request path.
   * Stores token in AsyncStorage under EXPO_PUSH_TOKEN_KEY.
   */
  async registerExpoPushToken(
    postFn: (data: { expo_push_token: string; device_type: "ios" | "android" }) => Promise<any>,
  ): Promise<void> {
    if (Platform.OS === "web") return;
    try {
      const granted = await this.requestPermissions();
      if (!granted) return; // denied — no crash, no retry

      const projectId =
        Constants.expoConfig?.extra?.eas?.projectId ??
        (Constants.easConfig as any)?.projectId ??
        undefined;

      const tokenData = await Notifications.getExpoPushTokenAsync(
        projectId ? { projectId } : undefined,
      );
      const token = tokenData.data;

      await AsyncStorage.setItem(EXPO_PUSH_TOKEN_KEY, token);

      const device_type: "ios" | "android" = Platform.OS === "ios" ? "ios" : "android";

      await postFn({ expo_push_token: token, device_type });
    } catch (e) {
      // Never crash the app — push token registration is best-effort
      console.log("[Push] registerExpoPushToken error:", e);
    }
  },

  // ============ DAILY REMINDER ============

  async getSettings(): Promise<NotificationSettings> {
    try {
      const [enabled, hour, minute] = await Promise.all([
        AsyncStorage.getItem(REMINDER_ENABLED_KEY),
        AsyncStorage.getItem(REMINDER_HOUR_KEY),
        AsyncStorage.getItem(REMINDER_MINUTE_KEY),
      ]);
      return {
        enabled: enabled === "true",
        hour: hour ? parseInt(hour) : 20,
        minute: minute ? parseInt(minute) : 0,
      };
    } catch {
      return { enabled: false, hour: 20, minute: 0 };
    }
  },

  async saveSettings(settings: NotificationSettings): Promise<void> {
    await Promise.all([
      AsyncStorage.setItem(REMINDER_ENABLED_KEY, String(settings.enabled)),
      AsyncStorage.setItem(REMINDER_HOUR_KEY, String(settings.hour)),
      AsyncStorage.setItem(REMINDER_MINUTE_KEY, String(settings.minute)),
    ]);
  },

  async scheduleReminder(hour: number, minute: number): Promise<string | null> {
    if (Platform.OS === "web") return null;
    await this.cancelDailyReminder();
    try {
      const notificationId = await Notifications.scheduleNotificationAsync({
        content: {
          title: "💰 Time to log your expenses!",
          body: "Tap to quickly add today's transactions",
          sound: true,
          data: { type: "daily_reminder", screen: "add" },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DAILY,
          hour,
          minute,
        },
      });
      return notificationId;
    } catch (e) {
      console.log("Schedule notification error:", e);
      return null;
    }
  },

  async cancelDailyReminder(): Promise<void> {
    if (Platform.OS === "web") return;
    try {
      // Cancel only scheduled daily reminders, not weekly
      const scheduled = await Notifications.getAllScheduledNotificationsAsync();
      for (const n of scheduled) {
        const data = n.content.data as any;
        if (data?.type === "daily_reminder") {
          await Notifications.cancelScheduledNotificationAsync(n.identifier);
        }
      }
    } catch (e) {
      console.log("Cancel daily reminder error:", e);
    }
  },

  async cancelReminders(): Promise<void> {
    if (Platform.OS === "web") return;
    try {
      await Notifications.cancelAllScheduledNotificationsAsync();
    } catch (e) {
      console.log("Cancel notifications error:", e);
    }
  },

  // ============ WEEKLY SUMMARY ============

  async getWeeklySettings(): Promise<WeeklySettings> {
    try {
      const [enabled, day, hour, minute] = await Promise.all([
        AsyncStorage.getItem(WEEKLY_ENABLED_KEY),
        AsyncStorage.getItem(WEEKLY_DAY_KEY),
        AsyncStorage.getItem(WEEKLY_HOUR_KEY),
        AsyncStorage.getItem(WEEKLY_MINUTE_KEY),
      ]);
      return {
        enabled: enabled === "true",
        day: day ? parseInt(day) : 0, // Default: Sunday
        hour: hour ? parseInt(hour) : 20, // Default: 8 PM
        minute: minute ? parseInt(minute) : 0,
      };
    } catch {
      return { enabled: false, day: 0, hour: 20, minute: 0 };
    }
  },

  async saveWeeklySettings(settings: WeeklySettings): Promise<void> {
    await Promise.all([
      AsyncStorage.setItem(WEEKLY_ENABLED_KEY, String(settings.enabled)),
      AsyncStorage.setItem(WEEKLY_DAY_KEY, String(settings.day)),
      AsyncStorage.setItem(WEEKLY_HOUR_KEY, String(settings.hour)),
      AsyncStorage.setItem(WEEKLY_MINUTE_KEY, String(settings.minute)),
    ]);
  },

  async scheduleWeeklySummary(
    day: number,
    hour: number,
    minute: number,
    title: string,
    body: string,
  ): Promise<string | null> {
    if (Platform.OS === "web") return null;
    await this.cancelWeeklySummary();
    try {
      // Expo WEEKLY trigger: weekday is 1=Sunday,2=Monday,...,7=Saturday
      const weekday = (day + 1) as 1 | 2 | 3 | 4 | 5 | 6 | 7;
      const notifId = await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          sound: true,
          data: { type: "weekly_summary", screen: "stats" },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
          weekday,
          hour,
          minute,
        },
      });
      await AsyncStorage.setItem(WEEKLY_NOTIF_ID_KEY, notifId);
      return notifId;
    } catch (e) {
      console.log("Schedule weekly summary error:", e);
      return null;
    }
  },

  async cancelWeeklySummary(): Promise<void> {
    if (Platform.OS === "web") return;
    try {
      const id = await AsyncStorage.getItem(WEEKLY_NOTIF_ID_KEY);
      if (id) {
        await Notifications.cancelScheduledNotificationAsync(id);
        await AsyncStorage.removeItem(WEEKLY_NOTIF_ID_KEY);
      }
    } catch (e) {
      console.log("Cancel weekly summary error:", e);
    }
  },

  async sendWeeklySummaryPreview(title: string, body: string): Promise<boolean> {
    if (Platform.OS === "web") return false;
    const hasPermission = await this.requestPermissions();
    if (!hasPermission) return false;
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        sound: true,
        data: { type: "weekly_summary", screen: "stats" },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: 3,
      },
    });
    return true;
  },

  // ============ QUICK ADD ============

  async sendQuickAddNotification(): Promise<boolean> {
    if (Platform.OS === "web") {
      if (typeof window !== "undefined" && "Notification" in window) {
        if (Notification.permission === "granted") {
          new Notification("💰 Add Expense", { body: "Tap to quickly add a transaction" });
          return true;
        } else if (Notification.permission !== "denied") {
          const perm = await Notification.requestPermission();
          if (perm === "granted") {
            new Notification("💰 Add Expense", { body: "Tap to quickly add a transaction" });
            return true;
          }
        }
      }
      return false;
    }
    const hasPermission = await this.requestPermissions();
    if (!hasPermission) return false;
    await Notifications.scheduleNotificationAsync({
      content: {
        title: "💸 Quick Add Expense",
        body: "Tap to add a transaction now",
        sound: true,
        data: { type: "quick_add", screen: "add" },
      },
      trigger: null,
    });
    return true;
  },

  async sendTestNotification(): Promise<boolean> {
    if (Platform.OS === "web") return false;
    const hasPermission = await this.requestPermissions();
    if (!hasPermission) return false;
    await Notifications.scheduleNotificationAsync({
      content: {
        title: "✅ Reminders are set!",
        body: "You'll receive daily expense reminders. Tap to add expenses instantly.",
        sound: true,
        data: { type: "test", screen: "add" },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: 2,
      },
    });
    return true;
  },

  // ============ ONBOARDING / SETUP FLAGS ============

  async isOnboardingSeen(): Promise<boolean> {
    try {
      const seen = await AsyncStorage.getItem(ONBOARDING_SEEN_KEY);
      return seen === "true";
    } catch {
      return false;
    }
  },

  async markOnboardingSeen(): Promise<void> {
    await AsyncStorage.setItem(ONBOARDING_SEEN_KEY, "true");
  },

  async isApplePaySetupSeen(): Promise<boolean> {
    try {
      const seen = await AsyncStorage.getItem(APPLE_PAY_SETUP_SEEN_KEY);
      return seen === "true";
    } catch {
      return false;
    }
  },

  async markApplePaySetupSeen(): Promise<void> {
    await AsyncStorage.setItem(APPLE_PAY_SETUP_SEEN_KEY, "true");
  },

  // ============ NAVIGATION ============

  extractNavigationFromNotification(notification: Notifications.Notification): string | null {
    const notificationId = String(notification?.request?.identifier || "").trim();
    if (
      shouldSuppressDuplicateNotification({
        lastHandledId: this._lastHandledNotificationId,
        notificationId,
      })
    ) {
      return null;
    }
    const data = notification.request.content.data as any;
    const route = deriveRouteFromNotificationData(data);
    this._lastHandledNotificationId = resolveNextHandledNotificationId({
      lastHandledId: this._lastHandledNotificationId,
      notificationId,
      route,
    });
    return route;
  },
};

export default notificationService;
