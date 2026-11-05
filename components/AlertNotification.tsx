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

  const isArmed = Boolean(alert.isArmed);

  return (
    <div
      className="fixed top-12 right-4 z-50 rounded-lg border p-3 shadow-lg animate-pulse"
      style={{
        background: theme.panel,
        borderColor: isArmed ? theme.green : theme.yellow,
        boxShadow: `0 4px 14px ${isArmed ? `${theme.green}30` : `${theme.yellow}30`}`,
      }}
    >
      <div className="flex items-center gap-3">
        <div>
          <div
            className="text-xs font-bold flex items-center gap-1.5"
            style={{ color: isArmed ? theme.green : theme.yellow }}
          >
            <span>{isArmed ? "⚡ ORDER FILLED" : "PRICE ALERT"}</span>
            {alert.label && (
              <span
                className="text-[10px] font-mono font-normal px-1.5 py-0.2 rounded"
                style={{
                  background: isArmed ? `${theme.green}20` : `${theme.yellow}20`,
                  color: isArmed ? theme.green : theme.yellow,
                }}
              >
                {alert.label}
              </span>
            )}
          </div>
          <div className="text-[11px]" style={{ color: theme.text }}>
            {alert.symbol} {alert.condition === "above" ? "≥" : "≤"} ${alert.price.toLocaleString()}
          </div>
        </div>
        <button
          onClick={onDismiss}
          className="text-lg hover:opacity-70 ml-2"
          style={{ color: theme.dim }}
        >
          ×
        </button>
      </div>
    </div>
  );
}
