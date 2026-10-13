import { NextResponse } from "next/server";

function extractFeedItems(xml: string) {
  const items: any[] = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;
  let id = 0;
  while ((match = itemRegex.exec(xml)) !== null && items.length < 20) {
    const item = match[1];
    const title = item.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/)?.[1] || item.match(/<title>(.*?)<\/title>/)?.[1] || "";
    const pubDate = item.match(/<pubDate>(.*?)<\/pubDate>/)?.[1] || "";
    const source = item.match(/<source[^>]*>(.*?)<\/source>/)?.[1] || "RSS";
    let sentiment: "positive" | "negative" | "neutral" = "neutral";
    const lower = title.toLowerCase();
    if (lower.includes("surge") || lower.includes("rally") || lower.includes("bull") || lower.includes("higher") || lower.includes("gain") || lower.includes("record") || lower.includes("all-time")) {
      sentiment = "positive";
    } else if (lower.includes("drop") || lower.includes("fall") || lower.includes("crash") || lower.includes("bear") || lower.includes("lower") || lower.includes("loss") || lower.includes("down") || lower.includes("ban") || lower.includes("exploit")) {
      sentiment = "negative";
    }
    items.push({
      id: id++,
      title,
      source,
      sentiment,
      time: pubDate ? new Date(pubDate).toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit" }) : "",
    });
  }
  return items;
}

export async function GET() {
  try {
    const res = await fetch("https://www.coindesk.com/arc/outboundfeeds/rss/");
    const xml = await res.text();
    const items = extractFeedItems(xml);
    return NextResponse.json(items);
  } catch {
    return NextResponse.json({ error: "Failed to fetch news" }, { status: 500 });
  }
}
