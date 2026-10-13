"use client";

import { memo, useState } from "react";
import { useTheme } from "@/context/ThemeContext";
import { PriceAlert, AlertPrefs } from "@/hooks/useAlerts";

interface AlertsPanelProps {
  alerts: PriceAlert[];
  currentPrice: number;
  symbol: string;
  onAddAlert: (symbol: string, condition: "above" | "below", price: number) => void;
  onRemoveAlert: (id: number) => void;
  prefs: AlertPrefs;
  onPrefsChange: (patch: Partial<AlertPrefs>) => void;
  onEnableSound: () => boolean;
}

function AlertsPanel({
  alerts,
  currentPrice,
  symbol,
  onAddAlert,
  onRemoveAlert,
  prefs,
  onPrefsChange,
  onEnableSound,
}: AlertsPanelProps) {
  const { theme } = useTheme();
  const [condition, setCondition] = useState<"above" | "below">("above");
  const [price, setPrice] = useState("");

  const handleAdd = () => {
    const numPrice = parseFloat(price);
    if (!isNaN(numPrice) && numPrice > 0) {
      onAddAlert(symbol, condition, numPrice);
      setPrice("");
    }
  };

  const activeAlerts = alerts.filter((a) => a.active);
  const triggeredAlerts = alerts.filter((a) => a.triggered);

  return (
    <div className="h-full flex flex-col">
      <div className="px-2 py-1.5 border-b text-[10px] uppercase tracking-wider" style={{ borderColor: theme.border, color: theme.dim }}>
        Price Alerts
      </div>

      <div className="p-2 border-b space-y-2" style={{ borderColor: theme.border }}>
        <div className="flex gap-1">
          <button
            onClick={() => setCondition("above")}
            className="flex-1 py-1 rounded text-[10px]"
            style={{
              background: condition === "above" ? theme.green : "transparent",
              color: condition === "above" ? theme.bg : theme.dim,
              border: `1px solid ${condition === "above" ? theme.green : theme.border}`,
            }}
          >
            Above
          </button>
          <button
            onClick={() => setCondition("below")}
            className="flex-1 py-1 rounded text-[10px]"
            style={{
              background: condition === "below" ? theme.red : "transparent",
              color: condition === "below" ? theme.bg : theme.dim,
              border: `1px solid ${condition === "below" ? theme.red : theme.border}`,
            }}
          >
            Below
          </button>
        </div>
        <div className="flex gap-1">
          <input
            type="number"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder={currentPrice ? currentPrice.toFixed(2) : "Price"}
            className="flex-1 bg-transparent border rounded px-2 py-1 text-[11px] focus:outline-none"
            style={{ borderColor: theme.border, color: theme.text }}
          />
          <button
            onClick={handleAdd}
            className="px-3 py-1 rounded text-[10px] font-medium"
            style={{ background: theme.yellow, color: theme.bg }}
          >
            Add
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {activeAlerts.length === 0 && triggeredAlerts.length === 0 && (
          <div className="p-3 text-center text-[10px]" style={{ color: theme.dim }}>
            No alerts set
          </div>
        )}
        {activeAlerts.map((alert) => (
          <div key={alert.id} className="px-2 py-1.5 border-b flex items-center justify-between" style={{ borderColor: `${theme.border}50` }}>
            <div>
              <div className="text-[11px]" style={{ color: theme.text }}>
                {alert.symbol} {alert.condition === "above" ? "≥" : "≤"} ${alert.price.toLocaleString()}
              </div>
              <div className="text-[9px]" style={{ color: theme.dim }}>
                {new Date(alert.createdAt).toLocaleTimeString()}
              </div>
            </div>
            <button
              onClick={() => onRemoveAlert(alert.id)}
              className="text-[10px] px-1.5 py-0.5 rounded hover:opacity-70"
              style={{ color: theme.red }}
            >
              ×
            </button>
          </div>
        ))}
        {triggeredAlerts.length > 0 && (
          <div className="px-2 py-1 border-b" style={{ borderColor: theme.border }}>
            <div className="text-[9px] uppercase tracking-wider" style={{ color: theme.dim }}>Triggered</div>
            {triggeredAlerts.slice(0, 5).map((alert) => (
              <div key={alert.id} className="py-1 flex items-center justify-between">
                <span className="text-[10px]" style={{ color: theme.yellow }}>
                  {alert.symbol} {alert.condition === "above" ? "≥" : "≤"} ${alert.price.toLocaleString()}
                </span>
                <button
                  onClick={() => onRemoveAlert(alert.id)}
                  className="text-[10px] px-1 py-0.5 hover:opacity-70"
                  style={{ color: theme.dim }}
                >
                  ×
                </button>
              </div>
            ))}
</div>
        )}
      </div>

      <div
        className="px-2 py-1 border-t flex items-center gap-2 shrink-0"
        style={{ borderColor: theme.border }}
      >
        <button
          onClick={() => {
            if (!prefs.sound) {
              onEnableSound();
              onPrefsChange({ sound: true });
            } else {
              onPrefsChange({ sound: false });
            }
          }}
          className="text-[9px] px-1 py-0.5 rounded border hover:opacity-70"
          style={{
            borderColor: prefs.sound ? theme.border : theme.red,
            color: prefs.sound ? theme.green : theme.dim,
          }}
          title={prefs.sound ? "Alert sound on" : "Alert sound off — click to enable"}
        >
          {prefs.sound ? "♪ ON" : "♪ OFF"}
        </button>

        <input
          type="range"
          min={0}
          max={100}
          value={Math.round(prefs.volume * 100)}
          onChange={(e) => onPrefsChange({ volume: Number(e.target.value) / 100 })}
          disabled={!prefs.sound}
          className="flex-1 min-w-0 accent-current"
          style={{ color: theme.green, opacity: prefs.sound ? 1 : 0.35 }}
          title="Alert volume"
          aria-label="Alert volume"
        />

        <span className="text-[9px] tabular-nums w-7 text-right" style={{ color: theme.dim }}>
          {Math.round(prefs.volume * 100)}%
        </span>
      </div>
    </div>
  );
}

export default memo(AlertsPanel);