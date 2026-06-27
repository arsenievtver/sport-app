/**
 * Design tokens — единый источник правды для TS (графики, inline-стили).
 * CSS-версия: ./tokens.css — меняй оба при смене палитры.
 */
export const theme = {
  name: "midnight-vitality",

  colors: {
    bg: "#0c0f14",
    bgElevated: "#151a22",
    surface: "#1c2430",
    surfaceHover: "#243040",
    overlay: "#2a3544",

    border: "rgba(255, 255, 255, 0.08)",
    borderStrong: "rgba(255, 255, 255, 0.14)",

    text: "#f1f5f9",
    textSecondary: "#94a3b8",
    textMuted: "#64748b",
    textInverse: "#0c0f14",

    primary: "#2dd4bf",
    primaryHover: "#14b8a6",
    primaryMuted: "rgba(45, 212, 191, 0.14)",

    accent: "#fb923c",
    accentHover: "#f97316",
    accentMuted: "rgba(251, 146, 60, 0.14)",

    success: "#34d399",
    successMuted: "rgba(52, 211, 153, 0.14)",

    warning: "#fbbf24",
    danger: "#f87171",
    dangerMuted: "rgba(248, 113, 113, 0.14)",

    info: "#60a5fa",

    /** Градиент прогресса (Recharts, progress bars) */
    progressStart: "#2dd4bf",
    progressEnd: "#34d399",

    /** Градиент достижений / челленджей */
    achievementStart: "#fb923c",
    achievementEnd: "#f472b6",
  },

  fonts: {
    sans: '"Recama", system-ui, -apple-system, sans-serif',
    mono: '"JetBrains Mono", ui-monospace, monospace',
  },

  radius: {
    sm: "8px",
    md: "12px",
    lg: "16px",
    xl: "24px",
    full: "9999px",
  },

  spacing: {
    touch: "48px",
  },

  /** SVG stroke in 24×24 viewBox; aligns visually with --border-width (1px). */
  icon: {
    strokeWidth: 1.5,
  },

  shadow: {
    glowPrimary: "0 0 24px rgba(45, 212, 191, 0.25)",
    glowAccent: "0 0 20px rgba(251, 146, 60, 0.2)",
  },
} as const;

export type Theme = typeof theme;
