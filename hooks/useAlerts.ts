"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { marketStore } from "@/lib/marketStore";
import { toBinanceSymbol, toLabel } from "@/lib/symbols";

export interface PriceAlert {
  id: number;
  symbol: string;
  condition: "above" | "below";
  price: number;
  active: boolean;
  triggered: boolean;
  createdAt: number;
}

const STORAGE_KEY = "btc-terminal:alerts";
const PREFS_KEY = "btc-terminal:alert-prefs";

export interface AlertPrefs {
  sound: boolean;
  volume: number;
  desktop: boolean;
}

const DEFAULT_PREFS: AlertPrefs = { sound: true, volume: 0.25, desktop: false };

export function useAlerts(explicitPrice?: number) {
  const [alerts, setAlerts] = useState<PriceAlert[]>([]);
  const [showNotification, setShowNotification] = useState<PriceAlert | null>(null);
  const [prefs, setPrefs] = useState<AlertPrefs>(DEFAULT_PREFS);
  const audioContextRef = useRef<AudioContext | null>(null);
  const alertsRef = useRef(alerts);
  alertsRef.current = alerts;
  const prefsRef = useRef(prefs);
  prefsRef.current = prefs;
  // The save effect below also fires on mount with the empty/default initial
  // state, which would overwrite stored alerts before the load effect's state
  // lands — and under StrictMode the mount runs twice, so the second load would
  // read the clobbered value. Skip exactly one write. (Same guard as the theme
  // and drawings persistence.)
  const skipNextSaveRef = useRef(true);

  // Hydrate after mount so server and client markup match
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          setAlerts(parsed.filter((a) => a && typeof a.price === "number"));
        }
      }
      const rawPrefs = window.localStorage.getItem(PREFS_KEY);
      if (rawPrefs) {
        const parsed = JSON.parse(rawPrefs);
        setPrefs({
          sound: typeof parsed.sound === "boolean" ? parsed.sound : DEFAULT_PREFS.sound,
          volume:
            typeof parsed.volume === "number" && parsed.volume >= 0 && parsed.volume <= 1
              ? parsed.volume
              : DEFAULT_PREFS.volume,
          desktop: typeof parsed.desktop === "boolean" ? parsed.desktop : DEFAULT_PREFS.desktop,
        });
      }
    } catch {
      /* corrupt payload — start with no alerts and default prefs */
    }
  }, []);

  useEffect(() => {
    if (skipNextSaveRef.current) {
      skipNextSaveRef.current = false;
      return;
    }
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(alerts));
      window.localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
    } catch {
      /* private mode — alerts just won't survive a refresh */
    }
  }, [alerts, prefs]);

  const updatePrefs = useCallback((patch: Partial<AlertPrefs>) => {
    setPrefs((prev) => ({ ...prev, ...patch }));
  }, []);

  /**
   * Browsers block audio until the page has been interacted with. Returns false
   * so the UI can prompt instead of silently producing no sound.
   */
  const primeAudio = useCallback((): boolean => {
    try {
      const Ctor = window.AudioContext ?? (window as any).webkitAudioContext;
      if (!Ctor) return false;
      if (!audioContextRef.current) audioContextRef.current = new Ctor();
      if (audioContextRef.current.state === "suspended") {
        void audioContextRef.current.resume();
      }
      return audioContextRef.current.state !== "suspended";
    } catch {
      return false;
    }
  }, []);

  const playAlertSound = useCallback(() => {
    try {
      const ctx = audioContextRef.current;
      if (!ctx) return;
      if (ctx.state === "suspended") {
        void ctx.resume();
        // Resuming is async; skip this chime rather than fire it into a dead context
        if (ctx.state === "suspended") return;
      }

      const now = ctx.currentTime;
      const peak = Math.max(0.0001, prefs.volume);

      const gain = ctx.createGain();
      gain.connect(ctx.destination);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(peak, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.5);

      // Two-tone chime reads as an alert without being harsh
      [880, 660].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, now + i * 0.14);
        osc.connect(gain);
        osc.start(now + i * 0.14);
        osc.stop(now + 0.5);
      });
    } catch {
      /* autoplay blocked or no audio device */
    }
  }, [prefs.volume]);

  const requestDesktopNotification = useCallback(async (): Promise<boolean> => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      return false;
    }
    if (Notification.permission === "granted") {
      setPrefs((prev) => ({ ...prev, desktop: true }));
      return true;
    }
    if (Notification.permission !== "denied") {
      try {
        const permission = await Notification.requestPermission();
        if (permission === "granted") {
          setPrefs((prev) => ({ ...prev, desktop: true }));
          return true;
        }
      } catch {
        return false;
      }
    }
    setPrefs((prev) => ({ ...prev, desktop: false }));
    return false;
  }, []);

  const spawnDesktopNotification = useCallback((alert: PriceAlert) => {
    if (
      typeof window === "undefined" ||
      !("Notification" in window) ||
      Notification.permission !== "granted"
    ) {
      return;
    }
    try {
      const symbolLabel = toLabel(alert.symbol);
      const op = alert.condition === "above" ? "≥" : "≤";
      const formattedPrice = alert.price.toLocaleString("en-US", {
        maximumFractionDigits: alert.price < 1 ? 4 : 2,
      });
      new Notification(`PRICE ALERT: ${symbolLabel}`, {
        body: `${symbolLabel} reached ${op} $${formattedPrice}`,
        icon: "/icon.svg",
      });
    } catch {
      /* desktop notifications blocked or unsupported */
    }
  }, []);

  // Evaluate alerts imperatively on store updates (per-symbol evaluation)
  useEffect(() => {
    const evaluate = (explicitP?: number) => {
      const state = marketStore.getState();
      const tickers = state.tickers;
      const currentAlerts = alertsRef.current;
      if (currentAlerts.length === 0) return;

      const triggeredAlerts: PriceAlert[] = [];

      for (const a of currentAlerts) {
        if (!a.active || a.triggered) continue;

        const bSymbol = toBinanceSymbol(a.symbol) || a.symbol.toUpperCase().replace(/[\/\s]/g, "");
        let symPrice = tickers[bSymbol] ?? tickers[a.symbol];

        // Fallback: if alert is for active chart symbol and not in tickers yet, use state.price or explicitP
        if (
          (!symPrice || symPrice <= 0) &&
          (state.symbol === bSymbol || toLabel(state.symbol) === a.symbol)
        ) {
          symPrice = typeof explicitP === "number" && explicitP > 0 ? explicitP : state.price;
        }

        if (!symPrice || symPrice <= 0) continue;

        const isHit =
          (a.condition === "above" && symPrice >= a.price) ||
          (a.condition === "below" && symPrice <= a.price);

        if (isHit) {
          triggeredAlerts.push(a);
        }
      }

      if (triggeredAlerts.length === 0) return;

      const hit = triggeredAlerts[0];
      if (prefsRef.current.sound) playAlertSound();
      if (prefsRef.current.desktop) spawnDesktopNotification(hit);
      setShowNotification({ ...hit, triggered: true });

      const hitIds = new Set(triggeredAlerts.map((a) => a.id));
      setAlerts((prev) =>
        prev.map((a) => (hitIds.has(a.id) ? { ...a, triggered: true, active: false } : a))
      );
    };

    if (typeof explicitPrice === "number" && explicitPrice > 0) {
      evaluate(explicitPrice);
    }

    const unsubscribe = marketStore.subscribe(() => {
      evaluate();
    });

    return unsubscribe;
  }, [explicitPrice, playAlertSound, spawnDesktopNotification]);

  const addAlert = useCallback((symbol: string, condition: "above" | "below", price: number) => {
    setAlerts((prev) => [
      {
        id: Date.now() + Math.random(),
        symbol,
        condition,
        price,
        active: true,
        triggered: false,
        createdAt: Date.now(),
      },
      ...prev,
    ]);
  }, []);

  const removeAlert = useCallback((id: number) => {
    setAlerts((prev) => prev.filter((a) => a.id !== id));
  }, []);

  const dismissNotification = useCallback(() => setShowNotification(null), []);

  return {
    alerts,
    addAlert,
    removeAlert,
    showNotification,
    dismissNotification,
    prefs,
    updatePrefs,
    primeAudio,
    requestDesktopNotification,
  };
}
