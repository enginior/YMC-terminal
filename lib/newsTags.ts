/**
 * Headline tagging for the news feed.
 *
 * Tags headlines with base symbols from UNIVERSE (e.g. BTC, ETH, SOL, XAU, OIL)
 * and macro topic tags (ETF, SEC, MACRO).
 */

import { UNIVERSE } from "./symbols";

export type NewsTag = string;

interface TagRule {
  tag: NewsTag;
  ciRegex?: RegExp;
  csRegex?: RegExp;
}

export function baseOf(label: string): string {
  if (!label) return "BTC";
  if (label.includes("/")) {
    return label.split("/")[0].toUpperCase();
  }
  return label.replace(/USDT$/i, "").toUpperCase();
}

/**
 * Tag definitions.
 * Word boundaries (\b) are strictly enforced to prevent substring false-positives.
 * Case-sensitive tickers prevent matching common English words (e.g. "second", "linked", "sui").
 */
const RULES: TagRule[] = [
  // UNIVERSE assets
  { tag: "BTC", ciRegex: /\bbitcoin\b/i, csRegex: /\bBTC\b/ },
  { tag: "ETH", ciRegex: /\b(ethereum|ether)\b/i, csRegex: /\bETH\b/ },
  { tag: "SOL", ciRegex: /\bsolana\b/i, csRegex: /\bSOL\b/ },
  { tag: "XRP", ciRegex: /\b(ripple|xrp)\b/i },
  { tag: "BNB", ciRegex: /\bbnb\s+chain\b/i, csRegex: /\bBNB\b/ },
  { tag: "DOGE", ciRegex: /\bdogecoin\b/i, csRegex: /\bDOGE\b/ },
  { tag: "SUI", csRegex: /\bSUI\b/ },
  { tag: "AVAX", ciRegex: /\bavalanche\b/i, csRegex: /\bAVAX\b/ },
  { tag: "LINK", ciRegex: /\bchainlink\b/i, csRegex: /\bLINK\b/ },
  { tag: "XAU", ciRegex: /\bgold\b/i, csRegex: /\bXAU\b/ },
  { tag: "XAG", ciRegex: /\bsilver\b/i, csRegex: /\bXAG\b/ },
  { tag: "OIL", ciRegex: /\b(crude|opec|brent|wti|oil\s+prices?)\b/i },

  // Macro & regulatory topics
  { tag: "ETF", ciRegex: /\betfs?\b/i },
  { tag: "SEC", csRegex: /\bSEC\b/ },
  {
    tag: "MACRO",
    ciRegex:
      /\b(fed|federal\s+reserve|fomc|cpi|inflation|rate\s+cuts?|rate\s+hikes?|powell|treasury\s+yields?|jobs\s+report|nonfarm)\b/i,
  },
];

// Dev-time check: warn if any UNIVERSE base has no corresponding tag rule
if (process.env.NODE_ENV !== "production") {
  const covered = new Set(RULES.map((r) => r.tag));
  for (const def of UNIVERSE) {
    const base = baseOf(def.label);
    if (!covered.has(base)) {
      console.warn(`[newsTags] UNIVERSE asset "${base}" has no headline tagging rule.`);
    }
  }
}

/**
 * Extracts matching tags from a news headline title.
 */
export function tagHeadline(title: string): NewsTag[] {
  if (!title) return [];
  const matched: NewsTag[] = [];

  for (const rule of RULES) {
    let hit = false;
    if (rule.csRegex && rule.csRegex.test(title)) {
      hit = true;
    } else if (rule.ciRegex && rule.ciRegex.test(title)) {
      hit = true;
    }

    if (hit) {
      matched.push(rule.tag);
    }
  }

  return matched;
}
