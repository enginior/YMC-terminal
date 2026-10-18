"use client";

import { useTheme } from "@/context/ThemeContext";

interface HotkeysModalProps {
  onClose: () => void;
}

interface ShortcutGroup {
  title: string;
  shortcuts: { keys: string[]; description: string }[];
}

const SHORTCUT_GROUPS: ShortcutGroup[] = [
  {
    title: "Market Navigation",
    shortcuts: [
      { keys: ["1", "–", "6"], description: "Select pair (1: BTC, 2: ETH, 3: SOL, 4: XRP, 5: BNB, 6: GOLD)" },
      { keys: ["/"], description: "Focus symbol search / command bar" },
      { keys: ["Esc"], description: "Clear search, close dialogs, deselect drawings" },
      { keys: ["?"], description: "Toggle this shortcut cheat sheet" },
    ],
  },
  {
    title: "Chart Controls",
    shortcuts: [
      { keys: ["[", "]"], description: "Cycle timeframe down / up (1m, 5m, 15m, 1h, 4h, 1d)" },
      { keys: ["v"], description: "Toggle volume histogram bars" },
      { keys: ["d"], description: "Toggle UTC day boundary lines" },
      { keys: ["m"], description: "Toggle OHLC magnet snap mode" },
    ],
  },
  {
    title: "Drawings & Tools",
    shortcuts: [
      { keys: ["Click"], description: "Select a level, trendline, or box drawing" },
      { keys: ["Del", "Bksp"], description: "Delete selected drawing" },
      { keys: ["Esc"], description: "Cancel in-progress drawing or clear selection" },
    ],
  },
];

export default function HotkeysModal({ onClose }: HotkeysModalProps) {
  const { theme } = useTheme();

  return (
    <div
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="rounded-lg border p-4 w-full max-w-lg max-h-[85vh] overflow-y-auto shadow-2xl"
        style={{ background: theme.panel, borderColor: theme.border }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-3 pb-2 border-b" style={{ borderColor: theme.border }}>
          <div className="flex items-center gap-2">
            <span className="font-bold text-sm tracking-wider" style={{ color: theme.yellow }}>
              KEYBOARD SHORTCUTS
            </span>
            <span className="text-[10px] px-1.5 py-0.5 rounded border" style={{ borderColor: theme.border, color: theme.dim }}>
              Terminal Guide
            </span>
          </div>
          <button
            onClick={onClose}
            className="text-lg leading-none hover:opacity-70 px-1"
            style={{ color: theme.dim }}
            aria-label="Close shortcuts"
          >
            ×
          </button>
        </div>

        <div className="space-y-4">
          {SHORTCUT_GROUPS.map((group) => (
            <div key={group.title}>
              <div className="text-[10px] uppercase tracking-wider mb-2 font-semibold" style={{ color: theme.dim }}>
                {group.title}
              </div>
              <div className="space-y-1.5">
                {group.shortcuts.map((sc, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between py-1 px-1.5 rounded"
                    style={{ background: `${theme.bg}80` }}
                  >
                    <span className="text-[11px]" style={{ color: theme.text }}>
                      {sc.description}
                    </span>
                    <div className="flex items-center gap-1 shrink-0 ml-3">
                      {sc.keys.map((k, ki) => (
                        <kbd
                          key={ki}
                          className="px-1.5 py-0.5 text-[10px] rounded border font-mono font-bold shadow-sm"
                          style={{
                            background: theme.panel,
                            borderColor: theme.border,
                            color: theme.yellow,
                          }}
                        >
                          {k}
                        </kbd>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 pt-3 border-t flex justify-between items-center text-[10px]" style={{ borderColor: theme.border, color: theme.dim }}>
          <span>Press <kbd className="px-1 py-0.5 rounded border" style={{ borderColor: theme.border, color: theme.yellow }}>Esc</kbd> anytime to close</span>
          <button
            onClick={onClose}
            className="px-3 py-1 rounded font-medium hover:opacity-80"
            style={{ background: theme.yellow, color: theme.bg }}
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
