import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const colors = JSON.parse(
  readFileSync(path.resolve(__dirname, "../shared/constants/colors.json"), "utf-8"),
);

/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        page: colors.background.page,
        surface: colors.background.surface,
        "surface-hover": colors.background.surfaceHover,
        "text-primary": colors.text.primary,
        "text-secondary": colors.text.secondary,
        "brand-primary": colors.brand.primary,
        "brand-hover": colors.brand.primaryHover,
        "brand-accent": colors.brand.accent,
        income: colors.semantic.income,
        "income-bg": colors.semantic.incomeBg,
        expense: colors.semantic.expense,
        "expense-bg": colors.semantic.expenseBg,
        transfer: colors.semantic.transfer,
        "transfer-bg": colors.semantic.transferBg,
        warning: colors.semantic.warning,
        "border-color": colors.semantic.border,
      },
      fontFamily: {
        heading: ["Manrope", "sans-serif"],
        body: ["Inter", "sans-serif"],
      },
      borderRadius: {
        card: "1rem",
        button: "9999px",
        input: "0.5rem",
      },
    },
  },
  plugins: [],
};
