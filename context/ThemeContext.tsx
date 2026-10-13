"use client";

import { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from "react";

export interface Theme {
  bg: string;
  panel: string;
  border: string;
  text: string;
  dim: string;
  green: string;
  red: string;
  yellow: string;
  blue: string;
  upCandle: string;
  downCandle: string;
  wickUp: string;
  wickDown: string;
  bidBg: string;
  askBg: string;
}

const defaultTheme: Theme = {
  bg: "#0a0a0a",
  panel: "#111111",
  border: "#1a1a1a",
  text: "#e0e0e0",
  dim: "#666666",
  green: "#00d09c",
  red: "#ff5c5c",
  yellow: "#f0b90b",
  blue: "#3b82f6",
  upCandle: "#00d09c",
  downCandle: "#ff5c5c",
  wickUp: "#00d09c",
  wickDown: "#ff5c5c",
  bidBg: "rgba(0, 208, 156, 0.1)",
  askBg: "rgba(255, 92, 92, 0.1)",
};

const STORAGE_KEY = "btc-terminal:theme";

/**
 * Preset palettes.
 *
 * Each entry declares the semantic slots only. Wicks mirror the candle colors
 * and the depth fills are derived from green/red, so a preset can never end up
 * with, say, teal candles but stale teal-tinted order-book shading.
 */
export interface ThemePreset {
  name: string;
  theme: Partial<Theme>;
}

/** Build a preset from its core slots, deriving wicks and depth fills. */
function makePreset(name: string, c: {
  bg: string; panel: string; border: string; text: string; dim: string;
  green: string; red: string; yellow: string; blue: string;
  depthAlpha?: number;
}): ThemePreset {
  const a = c.depthAlpha ?? 0.12;
  return {
    name,
    theme: {
      bg: c.bg,
      panel: c.panel,
      border: c.border,
      text: c.text,
      dim: c.dim,
      green: c.green,
      red: c.red,
      yellow: c.yellow,
      blue: c.blue,
      upCandle: c.green,
      downCandle: c.red,
      wickUp: c.green,
      wickDown: c.red,
      bidBg: hexToRgba(c.green, a),
      askBg: hexToRgba(c.red, a),
    },
  };
}

function hexToRgba(hex: string, alpha: number) {
  const m = hex.replace("#", "");
  const full = m.length === 3 ? m.split("").map((c) => c + c).join("") : m;
  const int = parseInt(full, 16);
  if (Number.isNaN(int)) return `rgba(0, 208, 156, ${alpha})`;
  const r = (int >> 16) & 255;
  const g = (int >> 8) & 255;
  const b = int & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export const THEME_PRESETS: ThemePreset[] = [
  { name: "Default", theme: {} },

  // The real Bloomberg look: amber phosphor on black
  makePreset("Bloomberg", {
    bg: "#000000", panel: "#0a0a0a", border: "#2a2a2a",
    text: "#ffb000", dim: "#8a5f00",
    green: "#ffb000", red: "#ff4d00", yellow: "#ffd700", blue: "#8a5f00",
  }),

  makePreset("Amber", {
    bg: "#0d0b06", panel: "#16130a", border: "#2b2413",
    text: "#f5e6c8", dim: "#8a7a52",
    green: "#d7a029", red: "#c1440e", yellow: "#f0b90b", blue: "#7a6a3a",
  }),

  makePreset("Paper", {
    bg: "#f7f6f2", panel: "#ffffff", border: "#dcd9d0",
    text: "#1c1b18", dim: "#8a877e",
    green: "#0f8a5f", red: "#c62828", yellow: "#b8860b", blue: "#1565c0",
  }),

  makePreset("Matrix", {
    bg: "#000000", panel: "#04110a", border: "#0d2b18",
    text: "#b8ffcb", dim: "#3f7a52",
    green: "#00ff41", red: "#ff0040", yellow: "#00cc33", blue: "#00a86b",
  }),

  makePreset("Tokyo Night", {
    bg: "#1a1b26", panel: "#24283b", border: "#2f334d",
    text: "#c0caf5", dim: "#7d8bb0",
    green: "#9ece6a", red: "#ff7a93", yellow: "#e0af68", blue: "#7aa2f7",
  }),

  makePreset("Nord", {
    bg: "#2e3440", panel: "#3b4252", border: "#4c566a",
    text: "#eceff4", dim: "#93a1c1",
    green: "#a3be8c", red: "#d08770", yellow: "#ebcb8b", blue: "#81a1c1",
  }),

  makePreset("Gruvbox", {
    bg: "#282828", panel: "#32302f", border: "#3c3836",
    text: "#ebdbb2", dim: "#928374",
    green: "#b8bb26", red: "#fb4934", yellow: "#fabd2f", blue: "#83a598",
  }),

  makePreset("Dracula", {
    bg: "#282a36", panel: "#343746", border: "#44475a",
    text: "#f8f8f2", dim: "#8b95c4",
    green: "#50fa7b", red: "#ff6e6e", yellow: "#f1fa8c", blue: "#bd93f9",
  }),

  makePreset("Solarized Dark", {
    bg: "#002b36", panel: "#073642", border: "#0d4b58",
    text: "#c3d3d3", dim: "#7d9aa1",
    green: "#93c379", red: "#f0645f", yellow: "#c9a227", blue: "#4aa5d8",
  }),

  makePreset("Solarized Light", {
    bg: "#fdf6e3", panel: "#f5efdc", border: "#e4dcc4",
    text: "#073642", dim: "#78878f",
    green: "#5f7a1e", red: "#c0392b", yellow: "#9a6b00", blue: "#1f6fa3",
  }),

  makePreset("Monokai", {
    bg: "#272822", panel: "#2f302a", border: "#3e3d32",
    text: "#f8f8f2", dim: "#9a9583",
    green: "#a6e22e", red: "#ff5c8a", yellow: "#e6db74", blue: "#66d9ef",
  }),

  makePreset("Cyberpunk", {
    bg: "#0d0221", panel: "#150734", border: "#2a1b4d",
    text: "#e0e6ff", dim: "#6b5b95",
    green: "#00f5d4", red: "#f20089", yellow: "#fcee0a", blue: "#00bbf9",
  }),

  makePreset("High Contrast", {
    bg: "#000000", panel: "#0a0a0a", border: "#4d4d4d",
    text: "#ffffff", dim: "#a6a6a6",
    green: "#00ff66", red: "#ff3355", yellow: "#ffe600", blue: "#3d9dff",
    depthAlpha: 0.22,
  }),

  makePreset("Deep Ocean", {
    bg: "#04141c", panel: "#07222e", border: "#0d3a4a",
    text: "#d6f1ff", dim: "#5b8ea6",
    green: "#2ee6a8", red: "#ff6b6b", yellow: "#ffd166", blue: "#4cc9f0",
  }),
];

interface ThemeContextType {
  theme: Theme;
  updateTheme: (key: keyof Theme, value: string) => void;
  applyPreset: (name: string) => void;
  resetTheme: () => void;
  presetName: string;
  /** User-saved palettes, persisted separately from the active theme. */
  savedThemes: ThemePreset[];
  saveTheme: (name: string) => void;
  applySavedTheme: (name: string) => void;
  deleteSavedTheme: (name: string) => void;
}

const SAVED_KEY = "btc-terminal:themes";

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  // Start from the default so the server and client render identically,
  // then rehydrate from storage in an effect.
  const [theme, setTheme] = useState<Theme>(defaultTheme);
  const [presetName, setPresetName] = useState("Default");
  const [savedThemes, setSavedThemes] = useState<ThemePreset[]>([]);

  // The two save effects below also fire on mount, with the default initial
  // state, which would overwrite stored values before the load effect's state
  // lands — and under StrictMode the mount runs twice, so the second load would
  // read the clobbered value. Skip exactly one write per key so defaults never
  // overwrite saved data. (Same guard as the drawings persistence.)
  const skipThemeSaveRef = useRef(true);
  const skipSavedThemesSaveRef = useRef(true);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.theme) {
          setTheme({ ...defaultTheme, ...parsed.theme });
          setPresetName(parsed.presetName ?? "Custom");
        }
      }
      const rawSaved = window.localStorage.getItem(SAVED_KEY);
      if (rawSaved) {
        const parsed = JSON.parse(rawSaved);
        if (Array.isArray(parsed)) {
          setSavedThemes(parsed.filter((t) => t && typeof t.name === "string" && t.theme));
        }
      }
    } catch {
      /* unreadable or corrupt — stay on defaults */
    }
  }, []);

  useEffect(() => {
    if (skipThemeSaveRef.current) {
      skipThemeSaveRef.current = false;
      return;
    }
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ theme, presetName }));
    } catch {
      /* private mode — theme just won't persist */
    }
  }, [theme, presetName]);

  useEffect(() => {
    if (skipSavedThemesSaveRef.current) {
      skipSavedThemesSaveRef.current = false;
      return;
    }
    try {
      window.localStorage.setItem(SAVED_KEY, JSON.stringify(savedThemes));
    } catch {
      /* private mode or quota — saved themes just won't persist */
    }
  }, [savedThemes]);

  const updateTheme = useCallback((key: keyof Theme, value: string) => {
    setPresetName("Custom");
    setTheme((prev) => ({ ...prev, [key]: value }));
  }, []);

  const applyPreset = useCallback((name: string) => {
    const preset = THEME_PRESETS.find((p) => p.name === name);
    if (!preset) return;
    setTheme({ ...defaultTheme, ...preset.theme });
    setPresetName(preset.name);
  }, []);

  const resetTheme = useCallback(() => {
    setTheme(defaultTheme);
    setPresetName("Default");
  }, []);

  const saveTheme = useCallback((name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setSavedThemes((prev) => {
      // Saving over an existing name replaces it rather than duplicating
      const next = prev.filter((t) => t.name !== trimmed);
      next.unshift({ name: trimmed, theme: { ...theme } });
      return next;
    });
    setPresetName(trimmed);
  }, [theme]);

  const applySavedTheme = useCallback((name: string) => {
    const saved = savedThemes.find((t) => t.name === name);
    if (!saved) return;
    setTheme({ ...defaultTheme, ...saved.theme });
    setPresetName(saved.name);
  }, [savedThemes]);

  const deleteSavedTheme = useCallback((name: string) => {
    setSavedThemes((prev) => prev.filter((t) => t.name !== name));
    setPresetName((cur) => (cur === name ? "Custom" : cur));
  }, []);

  return (
    <ThemeContext.Provider
      value={{
        theme,
        updateTheme,
        applyPreset,
        resetTheme,
        presetName,
        savedThemes,
        saveTheme,
        applySavedTheme,
        deleteSavedTheme,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
