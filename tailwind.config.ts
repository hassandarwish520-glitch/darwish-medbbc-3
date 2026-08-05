import type { Config } from "tailwindcss";
export default {
  content: ["./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#10b981",
          dark: "#059669",
          50: "#ecfdf5",
          100: "#d1fae5",
          400: "#34d399",
          500: "#10b981",
          600: "#059669",
        },
        purple: {
          DEFAULT: "#7c3aed",
          light: "#a78bfa",
          50: "#f5f3ff",
          100: "#ede9fe",
          400: "#a78bfa",
          500: "#7c3aed",
          600: "#6d28d9",
        },
        ink: {
          950: "#0B1220",
          900: "#121A2B",
          800: "#172032",
          700: "#1E2D3D",
          600: "#2D3E50",
        },
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
      },
      boxShadow: {
        "card-light": "0 1px 3px rgba(0,0,0,0.05), 0 4px 18px rgba(0,0,0,0.06)",
        "card-dark": "0 4px 20px rgba(0,0,0,0.40), 0 1px 3px rgba(0,0,0,0.20)",
        "btn-blue": "0 4px 14px rgba(99,102,241,0.30)",
        "btn-green": "0 4px 14px rgba(52,211,153,0.25)",
      },
      borderRadius: {
        "2xl": "16px",
        "3xl": "20px",
        "4xl": "24px",
      },
    },
  },
  plugins: [],
} satisfies Config;
