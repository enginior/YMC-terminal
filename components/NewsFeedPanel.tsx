"use client";

import { memo, useState, useEffect } from "react";
import { useTheme } from "@/context/ThemeContext";
import { baseOf } from "@/lib/newsTags";
import { useRenderCount } from "@/lib/devRenderCount";

interface NewsItem {
  id: number;
  title: string;
  source: string;
  sentiment: "positive" | "negative" | "neutral";
  tags?: string[];
  time: string;
}

interface NewsFeedPanelProps {
  symbol?: string;
}

function NewsFeedPanel({ symbol = "BTC/USDT" }: NewsFeedPanelProps) {
  useRenderCount("NewsFeedPanel");
  const { theme } = useTheme();
  const [news, setNews] = useState<NewsItem[]>([]);
  const [filter, setFilter] = useState<"all" | "positive" | "negative" | "neutral">("all");
  const [assetOnly, setAssetOnly] = useState(false);

  const activeBase = baseOf(symbol);

  useEffect(() => {
    const fetchNews = async () => {
      try {
        const res = await fetch("/api/news");
        const json = await res.json();
        if (Array.isArray(json)) {
          setNews(json);
        }
      } catch {
        // retry on next interval
      }
    };
    fetchNews();
    const interval = setInterval(fetchNews, 60000);
    return () => clearInterval(interval);
  }, []);

  const filtered = news
    .filter((n) => filter === "all" || n.sentiment === filter)
    .filter((n) => !assetOnly || (n.tags && n.tags.includes(activeBase)));

  const getSentimentColor = (sentiment: string) => {
    if (sentiment === "positive") return theme.green;
    if (sentiment === "negative") return theme.red;
    return theme.yellow;
  };

  const getSentimentIcon = (sentiment: string) => {
    if (sentiment === "positive") return "▲";
    if (sentiment === "negative") return "▼";
    return "●";
  };

  return (
    <div className="h-full flex flex-col">
      <div className="px-2 py-1.5 border-b flex items-center justify-between" style={{ borderColor: theme.border }}>
        <span className="text-[10px] uppercase tracking-wider" style={{ color: theme.dim }}>News Feed</span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setAssetOnly((prev) => !prev)}
            title={`Filter headlines mentioning ${activeBase}`}
            className="text-[8px] px-1.5 py-0.5 rounded font-mono flex items-center gap-0.5 transition-colors"
            style={{
              background: assetOnly ? `${theme.yellow}25` : "transparent",
              color: assetOnly ? theme.yellow : theme.dim,
              border: `1px solid ${assetOnly ? theme.yellow : `${theme.border}80`}`,
            }}
          >
            <span style={{ fontSize: "8px" }}>{assetOnly ? "◉" : "◎"}</span>
            <span>{activeBase}</span>
          </button>
          <div className="w-[1px] h-3 mx-0.5" style={{ background: `${theme.border}80` }} />
          {(["all", "positive", "negative", "neutral"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className="text-[8px] px-1 py-0.5 rounded uppercase font-mono"
              style={{
                background: filter === f ? theme.text : "transparent",
                color: filter === f ? theme.bg : theme.dim,
              }}
            >
              {f === "all" ? "All" : f === "positive" ? "Bull" : f === "negative" ? "Bear" : "Neu"}
            </button>
          ))}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        {news.length === 0 && <div className="p-3 text-center text-[10px]" style={{ color: theme.dim }}>Loading news...</div>}
        {news.length > 0 && filtered.length === 0 && (
          <div className="p-4 text-center text-[10px] font-mono" style={{ color: theme.dim }}>
            {assetOnly
              ? filter === "all"
                ? `No ${activeBase} headlines in the latest ${news.length}`
                : `No ${filter === "positive" ? "Bull" : filter === "negative" ? "Bear" : "Neu"} ${activeBase} headlines in the latest ${news.length}`
              : `No ${filter === "positive" ? "Bull" : filter === "negative" ? "Bear" : "Neu"} headlines in the latest ${news.length}`}
          </div>
        )}
        {filtered.map((item) => {
          const displayTags = (() => {
            if (!item.tags || item.tags.length === 0) return [];
            const tags = [...item.tags];
            if (tags.includes(activeBase)) {
              const idx = tags.indexOf(activeBase);
              tags.splice(idx, 1);
              tags.unshift(activeBase);
            }
            return tags;
          })();
          const visibleTags = displayTags.slice(0, 3);
          const remainingCount = displayTags.length - visibleTags.length;

          return (
            <div key={item.id} className="px-2 py-1.5 border-b" style={{ borderColor: `${theme.border}50` }}>
              <div className="flex items-start gap-1.5">
                <span className="text-[10px] mt-0.5 shrink-0" style={{ color: getSentimentColor(item.sentiment) }}>
                  {getSentimentIcon(item.sentiment)}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-[10px] leading-tight" style={{ color: theme.text }}>
                    {item.title}
                  </div>
                  {visibleTags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1 items-center">
                      {visibleTags.map((tag) => {
                        const isSelected = tag === activeBase;
                        return (
                          <span
                            key={tag}
                            className="text-[7px] px-1 py-0.2 rounded font-mono uppercase tracking-wider"
                            style={{
                              color: isSelected ? theme.yellow : theme.dim,
                              background: isSelected ? `${theme.yellow}15` : `${theme.dim}10`,
                              border: `1px solid ${isSelected ? `${theme.yellow}50` : `${theme.border}60`}`,
                            }}
                          >
                            {tag}
                          </span>
                        );
                      })}
                      {remainingCount > 0 && (
                        <span
                          className="text-[7px] px-1 py-0.2 rounded font-mono"
                          style={{
                            color: theme.dim,
                            background: `${theme.dim}10`,
                            border: `1px solid ${theme.border}60`,
                          }}
                        >
                          +{remainingCount}
                        </span>
                      )}
                    </div>
                  )}
                  <div className="flex justify-between mt-1">
                    <span className="text-[8px]" style={{ color: theme.dim }}>{item.source}</span>
                    <span className="text-[8px]" style={{ color: theme.dim }}>{item.time}</span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default memo(NewsFeedPanel);