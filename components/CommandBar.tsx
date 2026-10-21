"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useTheme } from "@/context/ThemeContext";
import { REPO_URL } from "@/lib/links";
import { CHART_LABELS, resolvePrefix } from "@/lib/symbols";
import { AssetIcon } from "@/components/AssetIcon";

interface CommandBarProps {
  onCommand: (cmd: string) => void;
  onOpenSettings: () => void;
  onOpenShortcuts?: () => void;
  onSelectSymbol?: (symbol: string) => void;
  selectedSymbol?: string;
}

export default function CommandBar({
  onCommand,
  onOpenSettings,
  onOpenShortcuts,
  onSelectSymbol,
  selectedSymbol,
}: CommandBarProps) {
  const { theme } = useTheme();
  const [value, setValue] = useState("");
  const [focused, setFocused] = useState(false);
  const [time, setTime] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const updateTime = () => setTime(new Date().toLocaleTimeString("en-US", { hour12: false }));
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "/") {
        e.preventDefault();
        inputRef.current?.focus();
      }
      if (e.key === "Escape") {
        inputRef.current?.blur();
        setValue("");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const raw = value.trim();
    if (!raw) return;

    onCommand(raw);

    // Resolve prefixes ("sol", "gol") to a chartable label
    const resolved = resolvePrefix(raw);
    if (resolved) onSelectSymbol?.(resolved);
    setValue("");
  };

  return (
    <div
      className="h-11 border-b flex items-center px-3.5 gap-4 shrink-0"
      style={{ background: theme.panel, borderColor: theme.border }}
    >
      <div className="flex items-center gap-2 shrink-0">
        <div className="font-bold text-base tracking-wider" style={{ color: theme.yellow }}>
          YMC TERMINAL
        </div>
        <span
          className="text-[10px] font-mono px-1.5 py-0.5 rounded border hidden sm:inline-block leading-none"
          style={{ borderColor: `${theme.border}80`, color: theme.dim }}
        >
          v0.1.4
        </span>
      </div>
      <form onSubmit={handleSubmit} className="flex-1 max-w-md">
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder="Type symbol + Enter (e.g. BTC, ETH)  |  Press / to focus"
          className="w-full rounded px-2.5 py-1.5 text-sm focus:outline-none"
          style={{
            background: theme.bg,
            border: `1px solid ${focused ? theme.blue : theme.border}`,
            color: theme.text,
          }}
        />
      </form>
      {onSelectSymbol && (
        <div className="flex items-center gap-1">
          {CHART_LABELS.map((s) => (
            <button
              key={s}
              onClick={() => onSelectSymbol(s)}
              className="text-[11px] px-1.5 py-0.5 rounded hover:opacity-70 flex items-center gap-1"
              style={{
                color: selectedSymbol === s ? theme.bg : theme.dim,
                background: selectedSymbol === s ? theme.text : "transparent",
              }}
              title={`Chart ${s}`}
            >
              <AssetIcon symbol={s} size={11} className="shrink-0" />
              <span>{s.replace("/USDT", "")}</span>
            </button>
          ))}
        </div>
      )}
      <div className="flex items-center gap-1 ml-auto">
        <a
          href={REPO_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[11px] px-2 py-1 rounded hover:opacity-70"
          style={{ color: theme.dim }}
          title="View source on GitHub"
        >
          GitHub
        </a>
        <Link
          href="/about"
          className="text-[11px] px-2 py-1 rounded hover:opacity-70"
          style={{ color: theme.dim }}
          title="About this terminal"
        >
          About
        </Link>
        {onOpenShortcuts && (
          <button
            onClick={onOpenShortcuts}
            className="text-xs px-2 py-1 rounded border hover:opacity-70 font-mono font-bold"
            style={{ borderColor: theme.border, color: theme.yellow }}
            title="Keyboard Shortcuts (?)"
          >
            ?
          </button>
        )}
        <button
          onClick={onOpenSettings}
          className="text-sm px-2.5 py-1 rounded border hover:opacity-70"
          style={{ borderColor: theme.border, color: theme.dim }}
        >
          Settings
        </button>
      </div>
      <div className="text-sm flex items-center gap-1.5" style={{ color: theme.dim }}>
        <span style={{ color: theme.green }}>●</span> LIVE | {time}
      </div>
    </div>
  );
}
