"use client";

import React from "react";

interface AssetIconProps {
  symbol: string;
  size?: number;
  className?: string;
}

function normalizeKey(symbol: string): string {
  const clean = symbol.toUpperCase().replace("/USDT", "").replace("USDT", "").trim();
  if (clean === "GOLD" || clean === "PAXG" || clean === "XAU") return "XAU";
  if (clean === "SILVER" || clean === "XAG") return "XAG";
  if (clean === "OIL" || clean === "CL" || clean === "CRUDE" || clean === "WTI") return "OIL";
  return clean;
}

export function AssetIcon({ symbol, size = 14, className = "" }: AssetIconProps) {
  const key = normalizeKey(symbol);

  switch (key) {
    case "BTC":
      return (
        <svg
          viewBox="0 0 24 24"
          width={size}
          height={size}
          className={className}
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <circle cx="12" cy="12" r="11" fill="#F7931A" />
          <path
            d="M15.4 10.3c.2-1.4-.9-2.1-2.4-2.6l.5-1.9-1.2-.3-.5 1.8c-.3-.1-.6-.2-1-.2l.5-1.9-1.2-.3-.5 1.9c-.3-.1-.6-.1-.9-.2l-1.6-.4-.3 1.3s.9.2.9.2c.5.1.7.4.6.7l-1.6 6.3c0 .1-.2.3-.4.3 0 0-.9-.2-.9-.2l-.6 1.5 1.5.4c.3.1.6.2.9.2l-.5 2 1.2.3.5-1.9c.3.1.6.2.9.2l-.5 2 1.2.3.5-2c2 .4 3.5.2 4.1-1.6.5-1.5 0-2.3-1.1-2.9.8-.4 1.3-1.1 1.1-2.3zm-2.5 4.8c-.4 1.5-2.7.7-3.4.5l.6-2.4c.7.2 3.1.6 2.8 1.9zm.4-2.7c-.3 1.4-2.3.7-2.9.5l.6-2.2c.6.2 2.7.5 2.3 1.7z"
            fill="#FFFFFF"
          />
        </svg>
      );

    case "ETH":
      return (
        <svg
          viewBox="0 0 24 24"
          width={size}
          height={size}
          className={className}
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <circle cx="12" cy="12" r="11" fill="#627EEA" />
          <path d="M12 4.5l4.8 8-4.8 2.8-4.8-2.8 4.8-8z" fill="#FFFFFF" fillOpacity="0.9" />
          <path d="M12 4.5v10.8l4.8-2.8-4.8-8z" fill="#DFE6FB" />
          <path d="M12 16.3l4.8-2.8-4.8 6-4.8-6 4.8 2.8z" fill="#FFFFFF" fillOpacity="0.9" />
          <path d="M12 16.3v6l4.8-6-4.8 2.8z" fill="#DFE6FB" />
        </svg>
      );

    case "SOL":
      return (
        <svg
          viewBox="0 0 24 24"
          width={size}
          height={size}
          className={className}
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <circle cx="12" cy="12" r="11" fill="#14141E" />
          <path
            d="M5.5 7.6a.6.6 0 0 1 .4-.3h10.4a.5.5 0 0 1 .4.8L14.9 10a.6.6 0 0 1-.4.2H4.1a.5.5 0 0 1-.4-.8l1.8-1.8z"
            fill="#00FFA3"
          />
          <path
            d="M18.5 11.2a.6.6 0 0 1-.4.3H7.7a.5.5 0 0 1-.4-.8L9.1 8.8a.6.6 0 0 1 .4-.2h10.4a.5.5 0 0 1 .4.8l-1.8 1.8z"
            fill="#03E1FF"
          />
          <path
            d="M5.5 14.8a.6.6 0 0 1 .4-.3h10.4a.5.5 0 0 1 .4.8L14.9 17.2a.6.6 0 0 1-.4.3H4.1a.5.5 0 0 1-.4-.9l1.8-1.8z"
            fill="#DC1FFF"
          />
        </svg>
      );

    case "XRP":
      return (
        <svg
          viewBox="0 0 24 24"
          width={size}
          height={size}
          className={className}
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <circle cx="12" cy="12" r="11" fill="#23292F" />
          <path
            d="M18.2 5.5h1.8c-.8 1-2.1 2.2-4.1 3.5-1.9 1.3-3.9 1.9-6 1.9-2.1 0-4.1-.6-6-1.9C2 7.7.8 6.5 0 5.5h1.8c1.3.8 2.8 1.4 4.4 1.8 1.8.4 3.6.5 5.7.5 2.1 0 4-.1 5.8-.5 1.7-.4 3.2-1 4.5-1.8z"
            fill="#FFFFFF"
            transform="scale(0.85) translate(2, 3)"
          />
          <path
            d="M5.8 18.5H4c.8-1 2.1-2.2 4.1-3.5 1.9-1.3 3.9-1.9 6-1.9 2.1 0 4.1.6 6 1.9 1.9 1.3 3.1 2.5 3.9 3.5h-1.8c-1.3-.8-2.8-1.4-4.4-1.8-1.8-.4-3.6-.5-5.7-.5-2.1 0-4 .1-5.8.5-1.8.4-3.3 1-4.5 1.8z"
            fill="#FFFFFF"
            transform="scale(0.85) translate(2, 3)"
          />
        </svg>
      );

    case "BNB":
      return (
        <svg
          viewBox="0 0 24 24"
          width={size}
          height={size}
          className={className}
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <circle cx="12" cy="12" r="11" fill="#F3BA2F" />
          <path d="M12 9.5l2.5 2.5L12 14.5 9.5 12z" fill="#FFFFFF" />
          <path d="M6.5 12l1.6-1.6 1.2 1.2-1.6 1.6 1.6 1.6-1.2 1.2-1.6-1.6z" fill="#FFFFFF" />
          <path d="M17.5 12l-1.6-1.6-1.2 1.2 1.6 1.6-1.6 1.6 1.2 1.2 1.6-1.6z" fill="#FFFFFF" />
          <path d="M12 5.5l3.5 3.5-1.4 1.4-2.1-2.1-2.1 2.1-1.4-1.4z" fill="#FFFFFF" />
          <path d="M12 18.5l-3.5-3.5 1.4-1.4 2.1 2.1 2.1-2.1 1.4 1.4z" fill="#FFFFFF" />
        </svg>
      );

    case "DOGE":
      return (
        <svg
          viewBox="0 0 24 24"
          width={size}
          height={size}
          className={className}
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <circle cx="12" cy="12" r="11" fill="#C2A633" />
          <path
            d="M8.5 7h4.2c2.6 0 4.3 1.8 4.3 4.5s-1.7 4.5-4.3 4.5H8.5V7zm3.8 7.3c1.6 0 2.5-1.2 2.5-2.8s-.9-2.8-2.5-2.8h-2v5.6h2zM7.5 11.2h4.5v1.6H7.5v-1.6z"
            fill="#FFFFFF"
          />
        </svg>
      );

    case "SUI":
      return (
        <svg
          viewBox="0 0 24 24"
          width={size}
          height={size}
          className={className}
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <circle cx="12" cy="12" r="11" fill="#2A82E4" />
          <path
            d="M12 4.5C9.8 7.8 7.5 11.2 7.5 14a4.5 4.5 0 0 0 9 0c0-2.8-2.3-6.2-4.5-9.5zm0 12.5a3 3 0 0 1-3-3c0-1.6 1.4-3.8 3-5.8 1.6 2 3 4.2 3 5.8a3 3 0 0 1-3 3z"
            fill="#FFFFFF"
          />
        </svg>
      );

    case "AVAX":
      return (
        <svg
          viewBox="0 0 24 24"
          width={size}
          height={size}
          className={className}
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <circle cx="12" cy="12" r="11" fill="#E84142" />
          <path d="M14 6.5l6.5 11.5H17l-3-5.5-3 5.5H8L14 6.5z" fill="#FFFFFF" />
          <path d="M6.5 18l3-5.5 1.5 2.5-1.5 3H6.5z" fill="#FFFFFF" />
        </svg>
      );

    case "LINK":
      return (
        <svg
          viewBox="0 0 24 24"
          width={size}
          height={size}
          className={className}
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <circle cx="12" cy="12" r="11" fill="#375BD2" />
          <path
            d="M12 5.5l5.5 3.2v6.4L12 18.3 6.5 15.1V8.7L12 5.5zm0 2.4L8.4 9.9v4.2l3.6 2.1 3.6-2.1V9.9L12 7.9z"
            fill="#FFFFFF"
          />
        </svg>
      );

    case "XAU":
      // Gold Ingot / Bullion Bar with metallic luster and "AU" hallmark
      return (
        <svg
          viewBox="0 0 24 24"
          width={size}
          height={size}
          className={className}
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <circle cx="12" cy="12" r="11" fill="#92400E" />
          {/* Top Face */}
          <polygon points="6,9 18,9 15.5,6.5 8.5,6.5" fill="#FDE68A" />
          {/* Front Face */}
          <polygon points="6,9 18,9 19.5,16.5 4.5,16.5" fill="#F59E0B" />
          {/* Right Face / Bevel Shadow */}
          <polygon points="18,9 19.5,16.5 17,16.5 16,9" fill="#D97706" />
          {/* Subtle Inscription / Hallmark */}
          <text
            x="12"
            y="14"
            textAnchor="middle"
            fill="#78350F"
            fontSize="5.2"
            fontFamily="monospace"
            fontWeight="bold"
            letterSpacing="0.5"
          >
            AU
          </text>
          {/* Sparkle Glint */}
          <polygon points="15.5,5.5 16.2,6.8 17.5,7.5 16.2,8.2 15.5,9.5 14.8,8.2 13.5,7.5 14.8,6.8" fill="#FFFBEB" />
        </svg>
      );

    case "XAG":
      // Silver Ingot / Bullion Bar with platinum-silver sheen and "AG" hallmark
      return (
        <svg
          viewBox="0 0 24 24"
          width={size}
          height={size}
          className={className}
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <circle cx="12" cy="12" r="11" fill="#475569" />
          {/* Top Face */}
          <polygon points="6,9 18,9 15.5,6.5 8.5,6.5" fill="#F8FAFC" />
          {/* Front Face */}
          <polygon points="6,9 18,9 19.5,16.5 4.5,16.5" fill="#CBD5E1" />
          {/* Right Face / Bevel Shadow */}
          <polygon points="18,9 19.5,16.5 17,16.5 16,9" fill="#94A3B8" />
          {/* Subtle Inscription / Hallmark */}
          <text
            x="12"
            y="14"
            textAnchor="middle"
            fill="#334155"
            fontSize="5.2"
            fontFamily="monospace"
            fontWeight="bold"
            letterSpacing="0.5"
          >
            AG
          </text>
          {/* Sparkle Glint */}
          <polygon points="15.5,5.5 16.2,6.8 17.5,7.5 16.2,8.2 15.5,9.5 14.8,8.2 13.5,7.5 14.8,6.8" fill="#FFFFFF" />
        </svg>
      );

    case "OIL":
      // Industrial Petroleum Drum / Crude Oil Barrel with amber crude droplet
      return (
        <svg
          viewBox="0 0 24 24"
          width={size}
          height={size}
          className={className}
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <circle cx="12" cy="12" r="11" fill="#0F172A" />
          {/* Barrel Body */}
          <rect x="7" y="6" width="10" height="12" rx="1.5" fill="#1E293B" stroke="#475569" strokeWidth="0.8" />
          {/* Barrel Ribs */}
          <line x1="7" y1="9.5" x2="17" y2="9.5" stroke="#334155" strokeWidth="1" />
          <line x1="7" y1="14.5" x2="17" y2="14.5" stroke="#334155" strokeWidth="1" />
          {/* Crude Oil Droplet in Amber Gold */}
          <path
            d="M12 8.5c-.8 1.4-2 2.7-2 3.8a2 2 0 0 0 4 0c0-1.1-1.2-2.4-2-3.8z"
            fill="#F59E0B"
          />
          <circle cx="11.3" cy="12.2" r="0.5" fill="#FEF3C7" />
        </svg>
      );

    default:
      return (
        <div
          className={`rounded-full flex items-center justify-center font-bold font-mono uppercase select-none text-[8px] bg-slate-700 text-slate-200 ${className}`}
          style={{ width: size, height: size, minWidth: size, minHeight: size }}
        >
          {key.slice(0, 2)}
        </div>
      );
  }
}
