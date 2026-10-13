"use client";

import { useEffect } from "react";
import { useTheme } from "@/context/ThemeContext";
import { PriceAlert } from "@/hooks/useAlerts";

interface AlertNotificationProps {
  alert: PriceAlert;
  onDismiss: () => void;
}

export default function AlertNotification({ alert, onDismiss }: AlertNotificationProps) {
  const { theme } = useTheme();

  useEffect(() => {
    const timer = setTimeout(onDismiss, 5000);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  return (
    <div
      className="fixed top-12 right-4 z-50 rounded-lg border p-3 shadow-lg animate-pulse"
      style={{ background: theme.panel, borderColor: theme.yellow }}
    >
      <div className="flex items-center gap-3">
        <div>
          <div className="text-xs font-bold" style={{ color: theme.yellow }}>
            PRICE ALERT
          </div>
          <div className="text-[11px]" style={{ color: theme.text }}>
            {alert.symbol} {alert.condition === "above" ? "≥" : "≤"} ${alert.price.toLocaleString()}
          </div>
        </div>
        <button
          onClick={onDismiss}
          className="text-lg hover:opacity-70"
          style={{ color: theme.dim }}
        >
          ×
        </button>
      </div>
    </div>
  );
}
