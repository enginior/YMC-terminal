"use client";

import { useState, useEffect, useMemo, useRef, memo } from "react";
import { useTheme } from "@/context/ThemeContext";
import { UNIVERSE, SymbolDef } from "@/lib/symbols";
import { AssetIcon } from "@/components/AssetIcon";
import { useMarket } from "@/lib/marketStore";

const RECENT_SYMBOLS_KEY = "btc-terminal:recent-symbols";

interface SymbolSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectSymbol: (symbol: string) => void;
  selectedSymbol: string;
}

const CATEGORIES = ["All", "Layer 1", "DeFi", "Meme", "Commodities"] as const;
type CategoryFilter = (typeof CATEGORIES)[number];

function SymbolSearchModal({
  isOpen,
  onClose,
  onSelectSymbol,
  selectedSymbol,
}: SymbolSearchModalProps) {
  const { theme } = useTheme();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const [query, setQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<CategoryFilter>("All");
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [recentSymbols, setRecentSymbols] = useState<string[]>([]);

  // Live universe ticker prices from reactive marketStore
  const tickers = useMarket((s) => s.tickers);
  const [statsMap, setStatsMap] = useState<Record<string, { price: number; changePercent: number }>>({});

  // Fetch 24h stats from /api/comparison when modal opens
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    fetch("/api/comparison")
      .then((res) => (res.ok ? res.json() : []))
      .then((data: any[]) => {
        if (cancelled || !Array.isArray(data)) return;
        const map: Record<string, { price: number; changePercent: number }> = {};
        for (const item of data) {
          map[item.symbol] = {
            price: Number(item.price) || 0,
            changePercent: Number(item.changePercent) || 0,
          };
        }
        setStatsMap(map);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  // Load recent symbols from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(RECENT_SYMBOLS_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          const valid = parsed.filter((s) => UNIVERSE.some((u) => u.label === s));
          setRecentSymbols(valid.slice(0, 5));
        }
      }
    } catch {}
  }, [isOpen]);

  // Reset query and focus input on open
  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setHighlightedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Filter symbols based on search query and category
  const filteredSymbols: SymbolDef[] = useMemo(() => {
    const q = query.trim().toLowerCase();
    return UNIVERSE.filter((item) => {
      const matchesCategory =
        selectedCategory === "All" || item.category === selectedCategory;
      if (!matchesCategory) return false;

      if (!q) return true;
      const cleanLabel = item.label.toLowerCase().replace(/[\/\s]/g, "");
      const cleanSymbol = item.symbol.toLowerCase();
      const cleanName = item.name.toLowerCase();
      const cleanQuery = q.replace(/[\/\s]/g, "");

      return (
        cleanLabel.includes(cleanQuery) ||
        cleanSymbol.includes(cleanQuery) ||
        cleanName.includes(q)
      );
    });
  }, [query, selectedCategory]);

  // Adjust highlighted index when list changes
  useEffect(() => {
    setHighlightedIndex(0);
  }, [filteredSymbols.length, selectedCategory]);

  const handleSelect = (symbolLabel: string) => {
    // Save to recents
    try {
      const nextRecents = [symbolLabel, ...recentSymbols.filter((s) => s !== symbolLabel)].slice(0, 5);
      setRecentSymbols(nextRecents);
      localStorage.setItem(RECENT_SYMBOLS_KEY, JSON.stringify(nextRecents));
    } catch {}

    onSelectSymbol(symbolLabel);
    onClose();
  };

  // Keyboard navigation: Escape, ArrowDown, ArrowUp, Enter
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setHighlightedIndex((prev) =>
          prev < filteredSymbols.length - 1 ? prev + 1 : 0
        );
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlightedIndex((prev) =>
          prev > 0 ? prev - 1 : filteredSymbols.length - 1
        );
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (filteredSymbols[highlightedIndex]) {
          handleSelect(filteredSymbols[highlightedIndex].label);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, filteredSymbols, highlightedIndex, onClose]);

  // Auto-scroll highlighted row into view
  useEffect(() => {
    if (!listRef.current) return;
    const activeItem = listRef.current.children[highlightedIndex] as HTMLElement | undefined;
    if (activeItem) {
      activeItem.scrollIntoView({ block: "nearest" });
    }
  }, [highlightedIndex]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-20 p-4 bg-black/70 backdrop-blur-[2px] animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-lg border shadow-2xl flex flex-col max-h-[75vh] overflow-hidden"
        style={{
          background: theme.panel,
          borderColor: theme.border,
          color: theme.text,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header & Search Input */}
        <div className="p-3 border-b flex flex-col gap-2.5" style={{ borderColor: theme.border }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span
                className="text-xs font-mono font-bold px-1.5 py-0.5 rounded"
                style={{ background: `${theme.yellow}20`, color: theme.yellow }}
              >
                /
              </span>
              <span className="font-semibold text-sm tracking-wide">
                Symbol Search
              </span>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono text-dim opacity-70">
                [↑/↓] Select · [Enter] Switch · [Esc]
              </span>
              <button
                onClick={onClose}
                className="text-xs p-1 rounded hover:opacity-70 transition-opacity"
                style={{ color: theme.dim }}
              >
                ✕
              </button>
            </div>
          </div>

          {/* Search Box */}
          <div
            className="flex items-center gap-2 px-3 py-2 rounded border transition-colors"
            style={{
              background: theme.bg,
              borderColor: query ? theme.yellow : theme.border,
            }}
          >
            <span className="text-xs opacity-60">🔍</span>
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by symbol or name (BTC, Gold, Solana)..."
              className="w-full bg-transparent text-xs outline-none"
              style={{ color: theme.text }}
            />
            {query && (
              <button
                onClick={() => setQuery("")}
                className="text-xs opacity-60 hover:opacity-100"
                style={{ color: theme.dim }}
              >
                ✕
              </button>
            )}
          </div>

          {/* Category Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
            {CATEGORIES.map((cat) => {
              const isSelected = selectedCategory === cat;
              return (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className="px-2 py-0.5 rounded text-[10px] font-medium transition-colors whitespace-nowrap"
                  style={{
                    background: isSelected ? `${theme.yellow}25` : `${theme.dim}15`,
                    color: isSelected ? theme.yellow : theme.dim,
                    border: `1px solid ${isSelected ? `${theme.yellow}50` : "transparent"}`,
                  }}
                >
                  {cat}
                </button>
              );
            })}
          </div>
        </div>

        {/* Recent Searches Strip */}
        {recentSymbols.length > 0 && !query && selectedCategory === "All" && (
          <div
            className="px-3 py-1.5 border-b flex items-center gap-2 text-[10px] overflow-x-auto shrink-0"
            style={{ borderColor: theme.border, background: `${theme.bg}30` }}
          >
            <span className="text-dim opacity-70 whitespace-nowrap">Recents:</span>
            <div className="flex items-center gap-1.5">
              {recentSymbols.map((s) => (
                <button
                  key={s}
                  onClick={() => handleSelect(s)}
                  className="px-2 py-0.5 rounded border hover:opacity-80 transition-colors flex items-center gap-1 whitespace-nowrap"
                  style={{
                    background: theme.bg,
                    borderColor: s === selectedSymbol ? theme.yellow : theme.border,
                    color: s === selectedSymbol ? theme.yellow : theme.text,
                  }}
                >
                  <AssetIcon symbol={s} size={11} />
                  <span>{s.replace("/USDT", "")}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Search Results List */}
        <div
          ref={listRef}
          className="flex-1 overflow-y-auto p-2 space-y-1 text-xs min-h-[180px]"
        >
          {filteredSymbols.length === 0 ? (
            <div className="py-12 text-center text-xs opacity-60" style={{ color: theme.dim }}>
              No trading instruments found matching &quot;{query}&quot;.
            </div>
          ) : (
            filteredSymbols.map((item, idx) => {
              const isHighlighted = idx === highlightedIndex;
              const isCurrent = item.label === selectedSymbol;
              const stats = statsMap[item.symbol];
              const price = tickers[item.symbol] ?? stats?.price;
              const change24h = stats?.changePercent;

              return (
                <div
                  key={item.label}
                  onClick={() => handleSelect(item.label)}
                  onMouseEnter={() => setHighlightedIndex(idx)}
                  className="px-2.5 py-2 rounded flex items-center justify-between cursor-pointer transition-colors"
                  style={{
                    background: isHighlighted
                      ? `${theme.yellow}18`
                      : isCurrent
                      ? `${theme.dim}10`
                      : "transparent",
                    border: `1px solid ${
                      isHighlighted ? `${theme.yellow}50` : "transparent"
                    }`,
                  }}
                >
                  {/* Left: Coin Icon + Label + Name + Category */}
                  <div className="flex items-center gap-2.5 min-w-0">
                    <AssetIcon symbol={item.label} size={18} />
                    <div className="flex flex-col min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-xs tracking-wide">
                          {item.label}
                        </span>
                        <span
                          className="text-[9px] px-1 py-0.2 rounded font-medium"
                          style={{ background: `${theme.dim}20`, color: theme.dim }}
                        >
                          {item.category}
                        </span>
                      </div>
                      <span className="text-[10px] opacity-70 truncate" style={{ color: theme.dim }}>
                        {item.name}
                      </span>
                    </div>
                  </div>

                  {/* Right: Price + 24h Change */}
                  <div className="flex items-center gap-3 shrink-0 tabular-nums text-right">
                    {price !== undefined && price > 0 ? (
                      <div className="flex flex-col items-end">
                        <span className="font-mono text-xs font-semibold">
                          ${price >= 1000 ? price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : price >= 1 ? price.toFixed(2) : price.toFixed(4)}
                        </span>
                        {change24h !== undefined && (
                          <span
                            className="font-mono text-[10px] font-medium"
                            style={{
                              color: change24h >= 0 ? theme.green : theme.red,
                            }}
                          >
                            {change24h >= 0 ? "+" : ""}
                            {change24h.toFixed(2)}%
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-dim text-[10px] font-mono">--</span>
                    )}

                    {isCurrent && (
                      <span
                        className="text-[10px] font-bold px-1.5 py-0.5 rounded"
                        style={{ background: `${theme.yellow}25`, color: theme.yellow }}
                      >
                        ACTIVE
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

export default memo(SymbolSearchModal);
