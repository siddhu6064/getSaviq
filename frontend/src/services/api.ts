import axios from "axios";
import * as SecureStore from "expo-secure-store";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

const API_BASE_URL = process.env.EXPO_PUBLIC_BACKEND_URL || "http://localhost:8001";

// Helper to handle storage across web and native
const getToken = async (): Promise<string | null> => {
  try {
    if (Platform.OS === "web") {
      return await AsyncStorage.getItem("session_token");
    }
    return await SecureStore.getItemAsync("session_token");
  } catch (error) {
    console.log("Error getting token:", error);
    return null;
  }
};

const removeToken = async (): Promise<void> => {
  try {
    if (Platform.OS === "web") {
      await AsyncStorage.removeItem("session_token");
    } else {
      await SecureStore.deleteItemAsync("session_token");
    }
  } catch (error) {
    console.log("Error removing token:", error);
  }
};

const api = axios.create({
  baseURL: `${API_BASE_URL}/api`,
  headers: {
    "Content-Type": "application/json",
  },
});

// Add auth token and platform header to requests
api.interceptors.request.use(
  async (config) => {
    const token = await getToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    if (Platform.OS !== "web") {
      config.headers["X-Client-Platform"] = Platform.OS;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// Handle 401 errors
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      // Clear token on auth error
      await removeToken();
    }
    return Promise.reject(error);
  },
);

// Expenses API (beyond the appStore CRUD wrappers)
export const expensesAPI = {
  refund: (expenseId: string, data: { amount?: number; date?: string; notes?: string }) =>
    api.post(`/expenses/${expenseId}/refund`, data),
  getRefunds: (expenseId: string) => api.get(`/expenses/${expenseId}/refunds`),
};

// Budget API
export const budgetsAPI = {
  create: (data: any) => api.post("/budgets", data),
  update: (budgetId: string, data: any) => api.put(`/budgets/${budgetId}`, data),
  delete: (budgetId: string) => api.delete(`/budgets/${budgetId}`),
  getProgress: (profileId: string) =>
    api.get("/budgets/progress", { params: { profile_id: profileId } }),
};

// Trip Budgets API
export const tripBudgetsAPI = {
  getAll: (profileId: string) => api.get("/trip-budgets", { params: { profile_id: profileId } }),
  create: (data: any) => api.post("/trip-budgets", data),
  update: (tripId: string, data: any) => api.put(`/trip-budgets/${tripId}`, data),
  delete: (tripId: string) => api.delete(`/trip-budgets/${tripId}`),
};

// Settings API
export const settingsAPI = {
  get: () => api.get("/settings"),
  update: (data: {
    dark_mode?: boolean;
    currency?: string;
    push_budget_alerts?: boolean;
    push_goal_milestones?: boolean;
    push_large_transactions?: boolean;
    weekly_digest_push?: boolean;
  }) => api.put("/settings", data),
};

// Push notifications API
export const pushAPI = {
  register: (data: { expo_push_token: string; device_type: "ios" | "android" }) =>
    api.post("/push/register", data),
};

// Export API
export const exportAPI = {
  getCSV: (profileId: string, startDate?: string, endDate?: string) => {
    const params: any = { profile_id: profileId };
    if (startDate) params.start_date = startDate;
    if (endDate) params.end_date = endDate;
    return api.get("/export/csv", { params });
  },
  getJSON: (profileId: string, startDate?: string, endDate?: string) => {
    const params: any = { profile_id: profileId };
    if (startDate) params.start_date = startDate;
    if (endDate) params.end_date = endDate;
    return api.get("/export/json", { params });
  },
};

// Import API
export const importAPI = {
  importCSV: (profileId: string, uri: string, filename: string) => {
    const formData = new FormData();
    formData.append("file", { uri, name: filename, type: "text/csv" } as any);
    return api.post("/import/csv", formData, {
      params: { profile_id: profileId },
      headers: { "Content-Type": "multipart/form-data" },
    });
  },
};

// Forecast API
export const forecastAPI = {
  getCashFlow: (profileId: string, days: number = 30) =>
    api.get("/forecast/cash-flow", { params: { profile_id: profileId, days } }),
};

// AI API
export const aiAPI = {
  chatInsights: (data: { profile_id: string; question: string; recent_days?: number }) =>
    api.post("/ai/chat-insights", data),
  parseExpenseText: (text: string) => api.post("/ai/parse-expense-text", { text }),
};

// Attachments API
export const attachmentsAPI = {
  upload: (expenseId: string, uri: string, filename: string) => {
    const formData = new FormData();
    formData.append("file", { uri, name: filename, type: "image/jpeg" } as any);
    return api.post(`/expenses/${expenseId}/attachments`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },
  remove: (expenseId: string, url: string) => {
    let key: string;
    try {
      key = new URL(url).pathname.slice(1);
    } catch {
      key = url;
    }
    return api.delete(`/expenses/${expenseId}/attachments/${key}`);
  },
};

// Bills API
export const billsAPI = {
  getAll: (params?: { profile_id?: string; status?: string }) => api.get("/bills", { params }),
  create: (data: any) => api.post("/bills", data),
  update: (billId: string, data: any) => api.put(`/bills/${billId}`, data),
  delete: (billId: string) => api.delete(`/bills/${billId}`),
};

// Invites API
export const invitesAPI = {
  getInviteInfo: (token: string) => api.get("/invite/accept", { params: { token } }),
  acceptAuthenticated: (token: string) => api.post("/invite/accept", { token }),
  decline: (token: string) => api.post("/invite/decline", { token }),
};

// Notifications API
export const notificationsAPI = {
  getAll: () => api.get("/notifications"),
  markAllRead: () => api.put("/notifications/read-all"),
};

// Profiles management API (owner actions)
export const profilesAPI = {
  create: (name: string, profile_type: "personal" | "business" | "shared" = "personal") =>
    api.post("/profiles", { name, profile_type }),
  invite: (profileId: string, email: string) =>
    api.post(`/profiles/${profileId}/invite`, { email }),
  removeMember: (profileId: string, memberId: string) =>
    api.delete(`/profiles/${profileId}/members/${memberId}`),
};

export default api;
