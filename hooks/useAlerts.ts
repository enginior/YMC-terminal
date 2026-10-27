"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { marketStore } from "@/lib/marketStore";

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
}

const DEFAULT_PREFS: AlertPrefs = { sound: true, volume: 0.25 };

export function useAlerts(explicitPrice?: number) {
  const [alerts, setAlerts] = useState<PriceAlert[]>([]);
  const [showNotification, setShowNotification] = useState<PriceAlert | null>(null);
  const [prefs, setPrefs] = useState<AlertPrefs>(DEFAULT_PREFS);
  const audioContextRef = useRef<AudioContext | null>(null);
  const lastEvaluatedPriceRef = useRef(0);
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

  // Evaluate alerts imperatively on store updates (or explicitPrice if provided)
  // so Home does not need to subscribe or pass down price.
  useEffect(() => {
    const evaluate = (currentPrice: number) => {
      if (currentPrice <= 0 || currentPrice === lastEvaluatedPriceRef.current) return;
      lastEvaluatedPriceRef.current = currentPrice;

      const currentAlerts = alertsRef.current;
      const hit = currentAlerts.find(
        (a) =>
          a.active &&
          !a.triggered &&
          ((a.condition === "above" && currentPrice >= a.price) ||
            (a.condition === "below" && currentPrice <= a.price))
      );
      if (!hit) return;

      if (prefsRef.current.sound) playAlertSound();
      setShowNotification({ ...hit, triggered: true });
      setAlerts((prev) =>
        prev.map((a) => (a.id === hit.id ? { ...a, triggered: true, active: false } : a))
      );
    };

    if (typeof explicitPrice === "number" && explicitPrice > 0) {
      evaluate(explicitPrice);
    }

    const unsubscribe = marketStore.subscribe(() => {
      const p = marketStore.getState().price;
      evaluate(p);
    });

    return unsubscribe;
  }, [explicitPrice, playAlertSound]);

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
  };
}
