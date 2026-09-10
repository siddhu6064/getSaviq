import axios from "axios";

const rawBackendUrl = import.meta.env.VITE_BACKEND_URL;
const host = typeof window !== "undefined" ? window.location.hostname : "localhost";
const isLocalHost = host === "localhost" || host === "127.0.0.1";
const isProdBuild = import.meta.env.PROD;

if (!rawBackendUrl && isProdBuild && !isLocalHost) {
  throw new Error("Missing VITE_BACKEND_URL for production build.");
}

const API_BASE_URL = rawBackendUrl || "http://localhost:8001";

if (!rawBackendUrl && typeof window !== "undefined" && !isLocalHost) {
  console.warn("[SAVIQ] VITE_BACKEND_URL is not set; falling back to http://localhost:8001");
}

const api = axios.create({
  baseURL: `${API_BASE_URL}/api`,
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
});

// Handle 401 errors — but skip the redirect for:
//   1. /api/auth/me  — that's the session-check on mount; let AuthContext handle it silently
//   2. requests made while already on /login — avoids infinite reload loop
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      const requestUrl = error.config?.url || "";
      const isSessionCheck = requestUrl.endsWith("/auth/me");
      const alreadyOnLogin =
        typeof window !== "undefined" && window.location.pathname.includes("/login");
      if (!isSessionCheck && !alreadyOnLogin) {
        localStorage.removeItem("user");
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  },
);

// Auth API
export const authAPI = {
  login: (email, password) => api.post("/auth/login", { email, password }),
  register: (email, password, name) => api.post("/auth/register", { email, password, name }),
  googleAuth: (idToken) => api.post("/auth/google", { id_token: idToken }),
  getMe: () => api.get("/auth/me"),
  logout: () => api.post("/auth/logout"),
  deleteAccount: (confirmation) => api.delete("/auth/account", { data: { confirmation } }),
};

// Profiles API
export const profilesAPI = {
  getAll: () => api.get("/profiles"),
  create: (name, profile_type = "personal") => api.post("/profiles", { name, profile_type }),
  update: (profileId, data) => api.put(`/profiles/${profileId}`, data),
  delete: (profileId) => api.delete(`/profiles/${profileId}`),
  removeMember: (profileId, memberId) => api.delete(`/profiles/${profileId}/members/${memberId}`),
};

// Categories API
export const categoriesAPI = {
  getAll: () => api.get("/categories"),
  create: (data) => api.post("/categories", data),
  update: (categoryId, data) => api.put(`/categories/${categoryId}`, data),
  delete: (categoryId) => api.delete(`/categories/${categoryId}`),
};

// Payment Methods API
export const paymentMethodsAPI = {
  getAll: () => api.get("/payment-methods"),
  create: (data) => api.post("/payment-methods", data),
  update: (paymentId, data) => api.put(`/payment-methods/${paymentId}`, data),
  delete: (paymentId) => api.delete(`/payment-methods/${paymentId}`),
};

// Expenses/Transactions API
export const expensesAPI = {
  getAll: (params) => api.get("/expenses", { params }),
  create: (data) => api.post("/expenses", data),
  update: (expenseId, data) => api.put(`/expenses/${expenseId}`, data),
  delete: (expenseId) => api.delete(`/expenses/${expenseId}`),
  refund: (expenseId, data) => api.post(`/expenses/${expenseId}/refund`, data),
  getRefunds: (expenseId) => api.get(`/expenses/${expenseId}/refunds`),
};

// Attachments API
export const attachmentsAPI = {
  upload: (expenseId, file) => {
    const fd = new FormData();
    fd.append("file", file);
    return api.post(`/expenses/${expenseId}/attachments`, fd, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },
  remove: (expenseId, url) => {
    // Extract R2 object key from public URL (pathname without leading slash)
    let key;
    try {
      key = new URL(url).pathname.slice(1);
    } catch {
      key = url;
    }
    return api.delete(`/expenses/${expenseId}/attachments/${key}`);
  },
};

// Stats API
export const statsAPI = {
  getSummary: (params) => api.get("/stats/summary", { params }),
  getInsights: (params) => api.get("/insights", { params }),
};

// Analytics API
export const analyticsAPI = {
  getSummary: (params) => api.get("/analytics/summary", { params }),
  getCategoryBreakdown: (params) => api.get("/analytics/category-breakdown", { params }),
  getPaymentMethodBreakdown: (params) => api.get("/analytics/payment-method-breakdown", { params }),
  getMonthlyTrend: (params) => api.get("/analytics/monthly-trend", { params }),
};

// Deterministic Insights API
export const insightsAPI = {
  getOverview: (params) => api.get("/insights/overview", { params }),
  getRecommendations: (params) => api.get("/insights/recommendations", { params }),
  getSpendComparison: (params) => api.get("/insights/spend-comparison", { params }),
};

// AI API
export const aiAPI = {
  scanReceipt: (image) => api.post("/scan-receipt", { image }),
  chatInsights: (data) => api.post("/ai/chat-insights", data),
  parseExpenseText: (text) => api.post("/ai/parse-expense-text", { text }),
};

// Budget API
export const budgetsAPI = {
  create: (data) => api.post("/budgets", data),
  update: (budgetId, data) => api.put(`/budgets/${budgetId}`, data),
  delete: (budgetId) => api.delete(`/budgets/${budgetId}`),
  getProgress: (profileId) => api.get("/budgets/progress", { params: { profile_id: profileId } }),
};

// Forecast API
export const forecastAPI = {
  getOverview: (params) => api.get("/forecast", { params }),
  getCashFlow: (params) => api.get("/forecast/cash-flow", { params }),
};

// Subscriptions API
export const subscriptionsAPI = {
  getSummary: (params) => api.get("/subscriptions/summary", { params }),
};

// Dashboard Metrics API
export const dashboardMetricsAPI = {
  get: (params) => api.get("/dashboard/metrics", { params }),
  getUrl: (params) => api.getUri({ url: "/dashboard/metrics", params }),
};

// Weekly Digest API
export const weeklyDigestAPI = {
  get: (params) => api.get("/weekly-digest", { params }),
  getLatest: (params) => api.get("/weekly-digest/latest", { params }),
  dismissLatest: (params) => api.post("/weekly-digest/latest/dismiss", null, { params }),
};

// Savings Goals API
export const savingsGoalsAPI = {
  getAll: (params) => api.get("/savings-goals", { params }),
  create: (data) => api.post("/savings-goals", data),
  update: (goalId, data) => api.put(`/savings-goals/${goalId}`, data),
  delete: (goalId) => api.delete(`/savings-goals/${goalId}`),
};

// Trip Budgets API
export const tripBudgetsAPI = {
  getAll: (params) => api.get("/trip-budgets", { params }),
  create: (data) => api.post("/trip-budgets", data),
  update: (tripId, data) => api.put(`/trip-budgets/${tripId}`, data),
  delete: (tripId) => api.delete(`/trip-budgets/${tripId}`),
};

// Net Worth API
export const netWorthAPI = {
  getSummary: (params) => api.get("/net-worth", { params }),
  getHistory: (params) => api.get("/net-worth/history", { params }),
  // Assets
  getAssets: (params) => api.get("/assets", { params }),
  createAsset: (data) => api.post("/assets", data),
  updateAsset: (assetId, data) => api.put(`/assets/${assetId}`, data),
  deleteAsset: (assetId) => api.delete(`/assets/${assetId}`),
  // Liabilities
  getLiabilities: (params) => api.get("/liabilities", { params }),
  createLiability: (data) => api.post("/liabilities", data),
  updateLiability: (liabilityId, data) => api.put(`/liabilities/${liabilityId}`, data),
  deleteLiability: (liabilityId) => api.delete(`/liabilities/${liabilityId}`),
};

// Settings API
export const settingsAPI = {
  get: () => api.get("/settings"),
  update: (data) => api.put("/settings", data),
};

// Invites API
export const invitesAPI = {
  invite: (profileId, email) => api.post(`/profiles/${profileId}/invite`, { email }),
  getInviteInfo: (token) => api.get("/invite/accept", { params: { token } }),
  acceptAuthenticated: (token) => api.post("/invite/accept", { token }),
  decline: (token) => api.post("/invite/decline", { token }),
};

// Notifications API
export const notificationsAPI = {
  getAll: () => api.get("/notifications"),
  markAllRead: () => api.put("/notifications/read-all"),
};

// Bills API
export const billsAPI = {
  getAll: (params) => api.get("/bills", { params }),
  create: (data) => api.post("/bills", data),
  update: (billId, data) => api.put(`/bills/${billId}`, data),
  delete: (billId) => api.delete(`/bills/${billId}`),
};

// Export API
export const exportAPI = {
  getCSV: (profileId, startDate, endDate) => {
    const params = { profile_id: profileId };
    if (startDate) params.start_date = startDate;
    if (endDate) params.end_date = endDate;
    return api.get("/export/csv", { params, responseType: "blob" });
  },
  getJSON: (profileId, startDate, endDate) => {
    const params = { profile_id: profileId };
    if (startDate) params.start_date = startDate;
    if (endDate) params.end_date = endDate;
    return api.get("/export/json", { params });
  },
};

// Import API
export const importAPI = {
  importCSV: (profileId, file) => {
    const formData = new FormData();
    formData.append("file", file);
    return api.post("/import/csv", formData, { params: { profile_id: profileId } });
  },
};

export default api;
