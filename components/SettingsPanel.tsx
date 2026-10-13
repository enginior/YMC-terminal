"use client";

import { useState } from "react";
import { useTheme, Theme, THEME_PRESETS } from "@/context/ThemeContext";

const colorFields: { key: keyof Theme; label: string }[] = [
  { key: "bg", label: "Background" },
  { key: "panel", label: "Panel" },
  { key: "border", label: "Border" },
  { key: "text", label: "Text" },
  { key: "dim", label: "Dim Text" },
  { key: "green", label: "Green (Bullish)" },
  { key: "red", label: "Red (Bearish)" },
  { key: "yellow", label: "Yellow (Accent)" },
  { key: "blue", label: "Blue (Selection)" },
  { key: "upCandle", label: "Up Candle" },
  { key: "downCandle", label: "Down Candle" },
  { key: "wickUp", label: "Wick Up" },
  { key: "wickDown", label: "Wick Down" },
];

// rgba() fields can't be edited with <input type="color">, so they take hex
// and get converted back to rgba on save.
const rgbaFields: { key: keyof Theme; label: string }[] = [
  { key: "bidBg", label: "Bid Depth Fill" },
  { key: "askBg", label: "Ask Depth Fill" },
];

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

function rgbaToHex(rgba: string) {
  const m = rgba.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (!m) return "#00d09c";
  return "#" + [m[1], m[2], m[3]].map((n) => Number(n).toString(16).padStart(2, "0")).join("");
}

export default function SettingsPanel({ onClose }: { onClose: () => void }) {
  const {
    theme,
    updateTheme,
    applyPreset,
    resetTheme,
    presetName,
    savedThemes,
    saveTheme,
    applySavedTheme,
    deleteSavedTheme,
  } = useTheme();

  const [newName, setNewName] = useState("");
  const [showColorEditor, setShowColorEditor] = useState(false);

  const handleSave = () => {
    if (!newName.trim()) return;
    saveTheme(newName);
    setNewName("");
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="rounded-lg border p-4 w-full max-w-md max-h-[85vh] overflow-y-auto"
        style={{ background: theme.panel, borderColor: theme.border }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-sm font-bold" style={{ color: theme.text }}>
            Appearance
          </h2>
          <button onClick={onClose} className="text-lg leading-none hover:opacity-70" style={{ color: theme.dim }} aria-label="Close settings">
            ×
          </button>
        </div>

        <div className="mb-4">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] uppercase tracking-wider" style={{ color: theme.dim }}>
              Preset
            </span>
            <span className="text-[10px]" style={{ color: theme.dim }}>
              {presetName}
            </span>
          </div>
          <div className="grid grid-cols-4 gap-1.5 max-h-52 overflow-y-auto pr-1">
            {THEME_PRESETS.map((p) => {
              const active = presetName === p.name;
              const preview = { ...theme, ...p.theme };
              const dark = preview.panel === preview.text;
              return (
                <button
                  key={p.name}
                  onClick={() => applyPreset(p.name)}
                  title={p.name}
                  className="rounded border px-1 py-1.5 text-[10px] flex flex-col items-center gap-1 hover:opacity-80"
                  style={{
                    borderColor: active ? theme.yellow : theme.border,
                    color: active ? theme.text : theme.dim,
                    background: active ? `${theme.yellow}18` : "transparent",
                  }}
                >
                  <span className="flex gap-0.5">
                    <span
                      className="w-2.5 h-2.5 rounded-sm"
                      style={{ background: preview.upCandle }}
                    />
                    <span
                      className="w-2.5 h-2.5 rounded-sm"
                      style={{ background: preview.downCandle }}
                    />
                    <span
                      className="w-2.5 h-2.5 rounded-sm border"
                      style={{ background: preview.bg, borderColor: preview.border }}
                    />
                  </span>
                  {p.name}
                </button>
              );
            })}
          </div>
        </div>
        {savedThemes.length > 0 && (
          <div className="mb-4">
            <div className="text-[10px] uppercase tracking-wider mb-1.5" style={{ color: theme.dim }}>
              Saved Themes
            </div>
            <div className="flex flex-wrap gap-1.5">
              {savedThemes.map((t) => {
                const active = presetName === t.name;
                const preview = { ...theme, ...t.theme };
                return (
                  <span key={t.name} className="relative inline-flex">
                    <button
                      onClick={() => applySavedTheme(t.name)}
                      className="rounded border px-1.5 py-1 text-[10px] flex items-center gap-1.5 hover:opacity-80"
                      style={{
                        borderColor: active ? theme.yellow : theme.border,
                        background: active ? `${theme.yellow}18` : "transparent",
                        color: active ? theme.text : theme.dim,
                        paddingRight: "1.25rem",
                      }}
                    >
                      <span className="flex gap-0.5">
                        <span className="w-2.5 h-2.5 rounded-sm" style={{ background: preview.upCandle }} />
                        <span className="w-2.5 h-2.5 rounded-sm" style={{ background: preview.downCandle }} />
                      </span>
                      {t.name}
                    </button>
                    <button
                      onClick={() => deleteSavedTheme(t.name)}
                      title={`Delete ${t.name}`}
                      className="absolute right-1 top-1/2 -translate-y-1/2 text-[11px] leading-none hover:opacity-100 opacity-60"
                      style={{ color: theme.red }}
                    >
                      ×
                    </button>
                  </span>
                );
              })}
            </div>
          </div>
        )}

        <div className="mb-4">
          <div className="text-[10px] uppercase tracking-wider mb-1.5" style={{ color: theme.dim }}>
            Save Current As
          </div>
          <div className="flex gap-1.5">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleSave();
                }
              }}
              placeholder="Theme name"
              spellCheck={false}
              className="flex-1 rounded px-2 py-1 text-[11px] focus:outline-none"
              style={{ background: theme.bg, border: `1px solid ${theme.border}`, color: theme.text }}
            />
            <button
              onClick={handleSave}
              disabled={!newName.trim()}
              className="px-3 py-1 rounded text-[11px] disabled:opacity-30"
              style={{ background: theme.green, color: theme.bg }}
            >
              Save
            </button>
          </div>
        </div>

        <button
          onClick={() => setShowColorEditor((v) => !v)}
          className="w-full text-[10px] uppercase tracking-wider py-1.5 rounded border mb-3 hover:opacity-80"
          style={{ borderColor: theme.border, color: theme.dim }}
        >
          {showColorEditor ? "▾ Hide" : "▸ Show"} Fine Tuning ({colorFields.length + rgbaFields.length})
        </button>

        {showColorEditor && (
          <>
        <div className="space-y-2">
          {colorFields.map(({ key, label }) => (
            <div key={key} className="flex items-center justify-between gap-2">
              <span className="text-[11px]" style={{ color: theme.text }}>
                {label}
              </span>
              <div className="flex items-center gap-1.5">
                <input
                  type="color"
                  value={theme[key]}
                  onChange={(e) => updateTheme(key, e.target.value)}
                  className="w-7 h-6 rounded cursor-pointer border-0 bg-transparent p-0"
                  style={{ color: theme[key] }}
                />
                <input
                  type="text"
                  value={theme[key]}
                  onChange={(e) => updateTheme(key, e.target.value)}
                  spellCheck={false}
                  className="w-20 rounded px-1.5 py-0.5 text-[10px] font-mono"
                  style={{ background: theme.bg, border: `1px solid ${theme.border}`, color: theme.dim }}
                />
              </div>
            </div>
          ))}

          <div className="pt-2 mt-1" style={{ borderTop: `1px solid ${theme.border}` }}>
            <div className="text-[10px] uppercase tracking-wider mb-1.5" style={{ color: theme.dim }}>
              Order Book Depth
            </div>
            {rgbaFields.map(({ key, label }) => {
              const alphaMatch = theme[key].match(/rgba?\([^)]*?,\s*([\d.]+)\s*\)/);
              const alpha = alphaMatch ? parseFloat(alphaMatch[1]) : 0.1;
              return (
                <div key={key} className="flex items-center justify-between gap-2 mb-1.5">
                  <span className="text-[11px]" style={{ color: theme.text }}>
                    {label}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="color"
                      value={rgbaToHex(theme[key])}
                      onChange={(e) => updateTheme(key, hexToRgba(e.target.value, alpha))}
                      className="w-7 h-6 rounded cursor-pointer border-0 bg-transparent p-0"
                    />
                    <span className="text-[10px] font-mono w-10 text-right" style={{ color: theme.dim }}>
                      {Math.round(alpha * 100)}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
          </>
        )}

        <div className="flex gap-2 mt-4 pt-3" style={{ borderTop: `1px solid ${theme.border}` }}>
          <button
            onClick={resetTheme}
            className="flex-1 rounded py-1.5 text-xs border hover:opacity-80"
            style={{ borderColor: theme.border, color: theme.text }}
          >
            Reset
          </button>
          <button
            onClick={onClose}
            className="flex-1 rounded py-1.5 text-xs font-medium hover:opacity-80"
            style={{ background: theme.yellow, color: theme.bg }}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
