// Shared Constants for SAVIQ
// Used by both Web and Mobile apps

import colors from "./colors.json";

// Category colors palette
export const CATEGORY_COLORS = [
  "#ef4444", // Red
  "#f97316", // Orange
  "#eab308", // Yellow
  "#22c55e", // Green
  "#06b6d4", // Cyan
  "#3b82f6", // Blue
  "#8b5cf6", // Violet
  "#ec4899", // Pink
  "#6b7280", // Gray
  "#4A6D5C", // Brand Green
];

// Payment method types
export const PAYMENT_TYPES = [
  { type: "cash", label: "Cash", icon: "cash" },
  { type: "credit_card", label: "Credit Card", icon: "card" },
  { type: "debit_card", label: "Debit Card", icon: "card-outline" },
  { type: "bank_transfer", label: "Bank Transfer", icon: "business" },
  { type: "other", label: "Other", icon: "wallet" },
] as const;

// Category icon mapping (Ionicons to Lucide)
export const CATEGORY_ICON_MAP: Record<string, string> = {
  restaurant: "Utensils",
  car: "Car",
  cart: "ShoppingCart",
  flash: "Zap",
  film: "Film",
  medical: "HeartPulse",
  airplane: "Plane",
  school: "GraduationCap",
  "ellipsis-horizontal": "MoreHorizontal",
  tag: "Tag",
  home: "Home",
  wallet: "Wallet",
  card: "CreditCard",
  cash: "Banknote",
  business: "Building2",
  pricetag: "Tag",
};

// Transaction type colors
export const TRANSACTION_COLORS = {
  income: {
    primary: colors.semantic.income,
    background: colors.semantic.incomeBg,
  },
  expense: {
    primary: colors.semantic.expense,
    background: colors.semantic.expenseBg,
  },
  transfer: {
    primary: colors.semantic.transfer,
    background: colors.semantic.transferBg,
  },
};

// Week days
export const WEEK_DAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

// Theme colors
export const THEME = {
  light: {
    background: colors.background.page,
    surface: colors.background.surface,
    surfaceHover: colors.background.surfaceHover,
    textPrimary: colors.text.primary,
    textSecondary: colors.text.secondary,
    border: colors.semantic.border,
    brandPrimary: colors.brand.primary,
    brandHover: colors.brand.primaryHover,
    brandAccent: colors.brand.accent,
  },
  dark: {
    background: colors.dark.background,
    surface: colors.dark.surface,
    surfaceHover: colors.dark.surfaceHover,
    textPrimary: colors.dark.textPrimary,
    textSecondary: colors.dark.textSecondary,
    border: colors.dark.border,
    brandPrimary: colors.dark.brand,
    brandHover: colors.dark.brand,
    brandAccent: colors.brand.accent,
  },
};

// Category emoji map — single source of truth for mobile and web
export const CATEGORY_EMOJIS: Record<string, string> = {
  "Food & Dining": "🍔",
  Food: "🍔",
  "Social Life": "👫",
  Pets: "🐾",
  Transportation: "🚕",
  Transport: "🚕",
  Culture: "🖼️",
  Household: "🏠",
  Apparel: "👒",
  Beauty: "💄",
  Healthcare: "🏥",
  Health: "🏥",
  Education: "📚",
  Gift: "🎁",
  Shopping: "🛒",
  "Bills & Utilities": "⚡",
  Entertainment: "🎬",
  Travel: "✈️",
  Other: "📋",
};

export function getCategoryEmoji(name: string): string {
  return CATEGORY_EMOJIS[name] || "📋";
}
