import { NextResponse } from "next/server";

const MAX_ITEMS = 30;
const MAX_PER_FEED = 8;

const FEEDS = [
  { name: "CoinDesk", url: "https://www.coindesk.com/arc/outboundfeeds/rss/" },
  { name: "CoinTelegraph", url: "https://cointelegraph.com/rss" },
  { name: "The Block", url: "https://www.theblock.co/rss.xml" },
  { name: "Decrypt", url: "https://decrypt.co/feed" },
  { name: "Bitcoin Magazine", url: "https://bitcoinmagazine.com/rss" },
  { name: "CNBC", url: "https://www.cnbc.com/id/100003114/device/rss/rss.html" },
];

function classifySentiment(title: string): "positive" | "negative" | "neutral" {
  const lower = title.toLowerCase();
  if (
    lower.includes("surge") ||
    lower.includes("rally") ||
    lower.includes("bull") ||
    lower.includes("higher") ||
    lower.includes("gain") ||
    lower.includes("record") ||
    lower.includes("all-time") ||
    lower.includes("approve") ||
    lower.includes("launch")
  ) {
    return "positive";
  }
  if (
    lower.includes("drop") ||
    lower.includes("fall") ||
    lower.includes("crash") ||
    lower.includes("bear") ||
    lower.includes("lower") ||
    lower.includes("loss") ||
    lower.includes("down") ||
    lower.includes("ban") ||
    lower.includes("exploit") ||
    lower.includes("scam") ||
    lower.includes("lawsuit") ||
    lower.includes("hack")
  ) {
    return "negative";
  }
  return "neutral";
}

function formatTime(pubDate: string): string {
  const d = new Date(pubDate);
  if (isNaN(d.getTime())) return "";
  const hhmm = d.toLocaleTimeString("en-US", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
  });
  return d.toDateString() === new Date().toDateString()
    ? hhmm
    : `${d.getMonth() + 1}/${d.getDate()} ${hhmm}`;
}

function extractFeedItems(xml: string, feedName: string) {
  const items: any[] = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;
  while ((match = itemRegex.exec(xml)) !== null && items.length < MAX_PER_FEED) {
    const block = match[1];
    const title =
      block.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/)?.[1] ||
      block.match(/<title>(.*?)<\/title>/)?.[1] ||
      "";
    if (!title.trim()) continue;
    const pubDate = block.match(/<pubDate>(.*?)<\/pubDate>/)?.[1] || "";
    const ts = pubDate ? new Date(pubDate).getTime() : 0;
    items.push({
      title: title.trim(),
      source: feedName,
      sentiment: classifySentiment(title),
      time: formatTime(pubDate),
      sortTime: ts,
    });
  }
  return items;
}

export async function GET() {
  const results = await Promise.allSettled(
    FEEDS.map(async (feed) => {
      const res = await fetch(feed.url);
      if (!res.ok) throw new Error(`${feed.name} ${res.status}`);
      return extractFeedItems(await res.text(), feed.name);
    })
  );

  const all: any[] = [];
  results.forEach((r, i) => {
    if (r.status === "fulfilled") {
      all.push(...r.value);
    } else {
      console.error(`news feed ${FEEDS[i].name}: ${r.reason}`);
    }
  });

  if (all.length === 0) {
    return NextResponse.json({ error: "Failed to fetch news" }, { status: 500 });
  }

  const seen = new Set<string>();
  const merged = (all as any[])
    .sort((a, b) => b.sortTime - a.sortTime)
    .filter((item) => {
      const key = item.title.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, MAX_ITEMS)
    .map((item, i) => ({ id: i, title: item.title, source: item.source, sentiment: item.sentiment, time: item.time }));

  return NextResponse.json(merged, { headers: { "Cache-Control": "s-maxage=60" } });
}