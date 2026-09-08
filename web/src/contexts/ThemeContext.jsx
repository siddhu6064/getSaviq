import React, { createContext, useContext, useState, useEffect } from "react";
import { settingsAPI } from "../services/api";
import { useAuth } from "./AuthContext";

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const { user, isGuest, loading: authLoading } = useAuth();
  const [darkMode, setDarkMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const isAuthenticated = Boolean(user) && !isGuest;

  useEffect(() => {
    if (authLoading) return;
    loadSettings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, isAuthenticated]);

  useEffect(() => {
    // Apply dark mode class to document
    if (darkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [darkMode]);

  const loadSettings = async () => {
    try {
      // First check localStorage for guest mode
      const localDarkMode = localStorage.getItem("dark_mode");
      if (localDarkMode !== null) {
        setDarkMode(localDarkMode === "true");
      }

      // Load from API when a real (non-guest) session is authenticated
      if (isAuthenticated) {
        const response = await settingsAPI.get();
        setDarkMode(response.data.dark_mode || false);
      }
    } catch (error) {
      console.log("Settings load error:", error);
    } finally {
      setLoading(false);
    }
  };

  const toggleDarkMode = async () => {
    const newValue = !darkMode;
    setDarkMode(newValue);
    localStorage.setItem("dark_mode", newValue.toString());

    if (!isAuthenticated) return;
    try {
      await settingsAPI.update({ dark_mode: newValue });
    } catch (error) {
      console.error("Failed to save dark mode setting:", error);
    }
  };

  return (
    <ThemeContext.Provider value={{ darkMode, toggleDarkMode, loading }}>
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
