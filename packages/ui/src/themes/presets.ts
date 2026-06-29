/**
 * Палитры — переключение через data-theme на <html>.
 */

export type ThemeId =
  | "neon-pulse"
  | "neon-crimson"
  | "soviet-sport"
  | "midnight-vitality"
  | "electric-pulse"
  | "forest-recovery";

export interface ThemePreset {
  id: ThemeId;
  name: string;
  tagline: string;
  vibe: string;
  primary: string;
  accent: string;
  tertiary?: string;
  isNew?: boolean;
}

export const THEME_STORAGE_KEY = "sport-app-theme";
export const DEFAULT_THEME_ID: ThemeId = "neon-pulse";

/** Фон для theme-color, splash и PWA */
export const THEME_BG: Record<ThemeId, string> = {
  "neon-pulse": "#050508",
  "neon-crimson": "#080506",
  "soviet-sport": "#12100e",
  "midnight-vitality": "#0c0f14",
  "electric-pulse": "#0a0e17",
  "forest-recovery": "#0a100e",
};

export const themePresets: ThemePreset[] = [
  {
    id: "neon-pulse",
    name: "Neon Pulse",
    tagline: "Green + magenta + cyan · glow UI",
    vibe: "Как на референсе: неон, bloom, rim-light, 3D-глубина. Ярко и tech.",
    primary: "#00ffaa",
    accent: "#ff2d95",
    tertiary: "#ff8800",
    isNew: true,
  },
  {
    id: "neon-crimson",
    name: "Neon Crimson",
    tagline: "Red + orange heat · glow UI",
    vibe: "Интенсивность, пульс, HIIT. Красный неон с оранжевым — меньше «тревога», больше «огонь».",
    primary: "#ff3355",
    accent: "#ff8800",
    tertiary: "#ff2d95",
    isNew: true,
  },
  {
    id: "soviet-sport",
    name: "Soviet Sport",
    tagline: "Красный + беж · плакатный constructivism",
    vibe: "Состаренная бумага, лучи, плакатная типографика. Советский спорт без неона.",
    primary: "#c41e3a",
    accent: "#e8dcc8",
    tertiary: "#5a7d8c",
    isNew: true,
  },
  {
    id: "midnight-vitality",
    name: "Midnight Vitality",
    tagline: "Teal + amber · универсальный premium",
    vibe: "Энергия + wellness, gender-neutral. Лучший баланс для SDT.",
    primary: "#2dd4bf",
    accent: "#fb923c",
  },
  {
    id: "electric-pulse",
    name: "Electric Pulse",
    tagline: "Blue + coral · спортивный драйв",
    vibe: "Ярче, динамичнее. HIIT, соревновательный дух, digital-fitness.",
    primary: "#3b82f6",
    accent: "#f43f5e",
  },
  {
    id: "forest-recovery",
    name: "Forest Recovery",
    tagline: "Green + violet · баланс и recovery",
    vibe: "Спокойнее, holistic. Yoga, восстановление, долгосрочная мотивация.",
    primary: "#10b981",
    accent: "#8b5cf6",
  },
];

export function getStoredTheme(): ThemeId {
  const raw = localStorage.getItem(THEME_STORAGE_KEY);
  if (raw && themePresets.some((t) => t.id === raw)) return raw as ThemeId;
  return DEFAULT_THEME_ID;
}

function syncThemeColor(id: ThemeId): void {
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", THEME_BG[id]);
}

export function applyTheme(id: ThemeId): void {
  document.documentElement.setAttribute("data-theme", id);
  localStorage.setItem(THEME_STORAGE_KEY, id);
  syncThemeColor(id);
}

export function initTheme(): ThemeId {
  const id = getStoredTheme();
  applyTheme(id);
  return id;
}
