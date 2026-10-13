"use client";

import { memo, useState, useEffect } from "react";
import { useTheme } from "@/context/ThemeContext";

interface NewsItem {
  id: number;
  title: string;
  source: string;
  sentiment: "positive" | "negative" | "neutral";
  time: string;
}

function NewsFeedPanel() {
  const { theme } = useTheme();
  const [news, setNews] = useState<NewsItem[]>([]);
  const [filter, setFilter] = useState<"all" | "positive" | "negative" | "neutral">("all");

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

  const filtered = filter === "all" ? news : news.filter((n) => n.sentiment === filter);

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
        <div className="flex gap-1">
          {(["all", "positive", "negative", "neutral"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className="text-[8px] px-1 py-0.5 rounded uppercase"
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
        {filtered.map((item) => (
          <div key={item.id} className="px-2 py-1.5 border-b" style={{ borderColor: `${theme.border}50` }}>
            <div className="flex items-start gap-1.5">
              <span className="text-[10px] mt-0.5" style={{ color: getSentimentColor(item.sentiment) }}>
                {getSentimentIcon(item.sentiment)}
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-[10px] leading-tight" style={{ color: theme.text }}>
                  {item.title}
                </div>
                <div className="flex justify-between mt-0.5">
                  <span className="text-[8px]" style={{ color: theme.dim }}>{item.source}</span>
                  <span className="text-[8px]" style={{ color: theme.dim }}>{item.time}</span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default memo(NewsFeedPanel);