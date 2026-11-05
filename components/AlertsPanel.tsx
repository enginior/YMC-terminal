"use client";

import { memo, useState } from "react";
import { useTheme } from "@/context/ThemeContext";
import { PriceAlert, AlertPrefs } from "@/hooks/useAlerts";
import { useMarket } from "@/lib/marketStore";

interface AlertsPanelProps {
  alerts: PriceAlert[];
  currentPrice?: number;
  symbol: string;
  onAddAlert: (
    symbol: string,
    condition: "above" | "below",
    price: number,
    options?: { isArmed?: boolean; label?: string }
  ) => void;
  onToggleArmed?: (id: number) => void;
  onRemoveAlert: (id: number) => void;
  prefs: AlertPrefs;
  onPrefsChange: (patch: Partial<AlertPrefs>) => void;
  onEnableSound: () => boolean;
  onTestSound?: (type?: "chime" | "order_filled") => void;
  onRequestDesktopNotification?: () => Promise<boolean>;
}

function AlertsPanel({
  alerts,
  currentPrice: propPrice,
  symbol,
  onAddAlert,
  onToggleArmed,
  onRemoveAlert,
  prefs,
  onPrefsChange,
  onEnableSound,
  onTestSound,
  onRequestDesktopNotification,
}: AlertsPanelProps) {
  const { theme } = useTheme();
  const storePrice = useMarket((s) => s.price);
  const currentPrice = propPrice ?? storePrice;
  const [condition, setCondition] = useState<"above" | "below">("above");
  const [price, setPrice] = useState("");
  const [isArmed, setIsArmed] = useState(false);

  const handleAdd = () => {
    const numPrice = parseFloat(price);
    if (!isNaN(numPrice) && numPrice > 0) {
      onAddAlert(symbol, condition, numPrice, {
        isArmed,
        label: isArmed ? "ARMED ORDER" : undefined,
      });
      setPrice("");
    }
  };

  const activeAlerts = alerts.filter((a) => a.active);
  const triggeredAlerts = alerts.filter((a) => a.triggered);

  return (
    <div className="h-full flex flex-col">
      <div
        className="px-2 py-1.5 border-b text-[10px] uppercase tracking-wider flex items-center justify-between"
        style={{ borderColor: theme.border, color: theme.dim }}
      >
        <span>Price Alerts</span>
        <span className="text-[9px] font-mono" style={{ color: theme.yellow }}>
          {activeAlerts.length} Active
        </span>
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
          <button
            type="button"
            onClick={() => setIsArmed((prev) => !prev)}
            className="px-2 py-1 rounded text-[10px] font-mono transition-colors flex items-center gap-1"
            style={{
              borderColor: isArmed ? theme.green : theme.border,
              background: isArmed ? `${theme.green}20` : "transparent",
              color: isArmed ? theme.green : theme.dim,
              border: `1px solid ${isArmed ? theme.green : theme.border}`,
            }}
            title={
              isArmed
                ? "Armed Alert: plays 'Order Filled' audio chime on trigger"
                : "Standard Alert: plays standard two-tone chime. Click to enable Armed 'Order Filled' sound."
            }
          >
            <span>{isArmed ? "⚡ Armed" : "♪ Chime"}</span>
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
            style={{
              background: isArmed ? theme.green : theme.yellow,
              color: theme.bg,
            }}
          >
            {isArmed ? "Arm" : "Add"}
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
          <div
            key={alert.id}
            className="px-2 py-1.5 border-b flex items-center justify-between"
            style={{ borderColor: `${theme.border}50` }}
          >
            <div className="flex flex-col gap-0.5">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[11px] font-medium" style={{ color: theme.text }}>
                  {alert.symbol} {alert.condition === "above" ? "≥" : "≤"} ${alert.price.toLocaleString()}
                </span>
                {alert.isArmed ? (
                  <button
                    type="button"
                    onClick={() => onToggleArmed?.(alert.id)}
                    className="text-[9px] px-1 py-0.2 rounded font-mono font-bold hover:opacity-80 transition-opacity"
                    style={{
                      background: `${theme.green}20`,
                      color: theme.green,
                      border: `1px solid ${theme.green}50`,
                    }}
                    title="Armed alert: plays 'Order Filled' audio on trigger. Click to toggle to standard chime."
                  >
                    ⚡ ARMED
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => onToggleArmed?.(alert.id)}
                    className="text-[9px] px-1 py-0.2 rounded font-mono hover:opacity-80 transition-opacity"
                    style={{
                      color: theme.dim,
                      border: `1px solid ${theme.border}80`,
                    }}
                    title="Standard alert: plays synthesizer chime. Click to toggle to Armed 'Order Filled' sound."
                  >
                    ♪ Chime
                  </button>
                )}
                {alert.label && (
                  <span
                    className="text-[9px] px-1 py-0.2 rounded font-mono"
                    style={{ background: `${theme.yellow}18`, color: theme.yellow }}
                  >
                    {alert.label}
                  </span>
                )}
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
            <div className="text-[9px] uppercase tracking-wider" style={{ color: theme.dim }}>
              Triggered
            </div>
            {triggeredAlerts.slice(0, 5).map((alert) => (
              <div key={alert.id} className="py-1 flex items-center justify-between">
                <span className="text-[10px] flex items-center gap-1.5" style={{ color: alert.isArmed ? theme.green : theme.yellow }}>
                  {alert.isArmed && <span>⚡</span>}
                  <span>
                    {alert.symbol} {alert.condition === "above" ? "≥" : "≤"} ${alert.price.toLocaleString()}
                  </span>
                  {alert.label && (
                    <span className="text-[8.5px] opacity-80 font-mono">({alert.label})</span>
                  )}
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

        {onTestSound && (
          <button
            onClick={() => onTestSound("order_filled")}
            disabled={!prefs.sound}
            className="text-[9px] px-1.5 py-0.5 rounded border hover:opacity-70 font-mono transition-opacity"
            style={{
              borderColor: theme.border,
              color: prefs.sound ? theme.yellow : theme.dim,
              opacity: prefs.sound ? 1 : 0.35,
            }}
            title="Test 'Order Filled' sound for armed alerts"
          >
            ▶ Test
          </button>
        )}

        <button
          onClick={async () => {
            if (!prefs.desktop) {
              if (onRequestDesktopNotification) {
                await onRequestDesktopNotification();
              } else {
                onPrefsChange({ desktop: true });
              }
            } else {
              onPrefsChange({ desktop: false });
            }
          }}
          className="text-[9px] px-1 py-0.5 rounded border hover:opacity-70"
          style={{
            borderColor: theme.border,
            color: prefs.desktop ? theme.yellow : theme.dim,
          }}
          title={
            prefs.desktop
              ? "Desktop notifications on — click to disable"
              : "Desktop notifications off — click to enable"
          }
        >
          {prefs.desktop ? "DESK ON" : "DESK OFF"}
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
