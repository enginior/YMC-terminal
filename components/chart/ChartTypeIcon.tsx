import { Theme } from "@/context/ThemeContext";
import { ChartType } from "./types";

interface ChartTypeIconProps {
  type: ChartType;
  theme: Theme;
  size?: number;
}

export function ChartTypeIcon({ type, theme, size = 11 }: ChartTypeIconProps) {
  if (type === "candles") {
    return (
      <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className="shrink-0">
        <line x1="5" y1="2" x2="5" y2="14" stroke={theme.green} strokeWidth="1.5" strokeLinecap="round" />
        <rect x="3.5" y="5" width="3" height="6" fill={theme.green} rx="0.5" />
        <line x1="11" y1="3" x2="11" y2="15" stroke={theme.red} strokeWidth="1.5" strokeLinecap="round" />
        <rect x="9.5" y="4" width="3" height="7" fill={theme.red} rx="0.5" />
      </svg>
    );
  }
  if (type === "heiken") {
    return (
      <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className="shrink-0">
        <line x1="5" y1="3" x2="5" y2="13" stroke={theme.green} strokeWidth="1.2" strokeLinecap="round" />
        <rect x="3.5" y="4" width="3" height="7" fill={theme.green} rx="0.5" />
        <line x1="11" y1="2" x2="11" y2="12" stroke={theme.green} strokeWidth="1.2" strokeLinecap="round" />
        <rect x="9.5" y="3" width="3" height="7" fill={theme.green} rx="0.5" />
      </svg>
    );
  }
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className="shrink-0">
      <path
        d="M2 12L6 8L10 10L14 4"
        stroke={theme.blue}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="14" cy="4" r="1.5" fill={theme.blue} />
    </svg>
  );
}
