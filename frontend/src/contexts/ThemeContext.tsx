import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useColorScheme } from "react-native";
import { settingsAPI } from "../services/api";
import { setActiveCurrency } from "@shared/utils";
import colors from "@shared/constants/colors.json";

// Pre-launch decision: no dark palette exists outside ThemeContext's own tokens
// yet (see the light-mode force below), so any dark-mode toggle UI should stay
// hidden behind this until that work resumes.
export const DARK_MODE_ENABLED = false;

interface ThemeContextType {
  darkMode: boolean;
  toggleDarkMode: () => void;
  colors: typeof lightColors;
}

const lightColors = {
  background: colors.background.page,
  surface: colors.background.surface,
  surfaceHover: colors.background.surfaceHover,
  textPrimary: colors.text.primary,
  textSecondary: colors.text.secondary,
  border: colors.semantic.border,
  primary: colors.brand.primary,
  primaryHover: colors.brand.primaryHover,
  accent: colors.brand.accent,
  tint: colors.brand.tint,
  onDark: colors.brand.onDark,
  income: colors.semantic.income,
  incomeBg: colors.semantic.incomeBg,
  expense: colors.semantic.expense,
  expenseBg: colors.semantic.expenseBg,
  transfer: colors.semantic.transfer,
  transferBg: colors.semantic.transferBg,
  warning: colors.semantic.warning,
};

export type ThemeColors = typeof lightColors;

export const darkColors = {
  background: colors.dark.background,
  surface: colors.dark.surface,
  surfaceHover: colors.dark.surfaceHover,
  textPrimary: colors.dark.textPrimary,
  textSecondary: colors.dark.textSecondary,
  border: colors.dark.border,
  primary: colors.dark.brand,
  primaryHover: colors.dark.brand,
  accent: colors.brand.accent,
  tint: colors.brand.tint,
  onDark: colors.brand.onDark,
  income: colors.semantic.income,
  incomeBg: colors.semantic.incomeBg,
  expense: colors.semantic.expense,
  expenseBg: colors.semantic.expenseBg,
  transfer: colors.semantic.transfer,
  transferBg: colors.semantic.transferBg,
  warning: colors.semantic.warning,
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const systemColorScheme = useColorScheme();
  const [darkMode, setDarkMode] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      // First check local storage
      const localDarkMode = await AsyncStorage.getItem("dark_mode");
      if (localDarkMode !== null) {
        setDarkMode(localDarkMode === "true");
      } else {
        // Try to load from API
        const response = await settingsAPI.get();
        setDarkMode(response.data.dark_mode || false);
        setActiveCurrency(response.data.currency);
        return;
      }
    } catch (error) {
      // Use system preference as fallback
      setDarkMode(systemColorScheme === "dark");
    }

    // Currency preference isn't cached locally like dark mode — always fetch it.
    try {
      const response = await settingsAPI.get();
      setActiveCurrency(response.data.currency);
    } catch (error) {
      // Keep default currency (USD) on failure
    }
  };

  const toggleDarkMode = async () => {
    const newValue = !darkMode;
    setDarkMode(newValue);
    await AsyncStorage.setItem("dark_mode", newValue.toString());

    try {
      await settingsAPI.update({ dark_mode: newValue });
    } catch (error) {
      console.log("Failed to sync dark mode to server:", error);
    }
  };

  // Pre-launch decision: force light mode regardless of darkMode/system appearance.
  // NeumorphicUI (login, app shell, Home, Add Transaction, App Lock) has no dark
  // palette yet, so honoring dark here would render those screens broken.
  // darkColors is kept intact and exported so dark-mode work can resume later.
  const colors = lightColors;

  return (
    <ThemeContext.Provider value={{ darkMode, toggleDarkMode, colors }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
