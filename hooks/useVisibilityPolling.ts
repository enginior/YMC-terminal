"use client";

import { useEffect, useRef } from "react";

interface VisibilityPollingOptions {
  /** Whether to run callback immediately on mount. Default true. */
  immediate?: boolean;
  /** Whether to run callback immediately when tab becomes visible after being hidden. Default true. */
  immediateOnVisible?: boolean;
  /** Whether polling is enabled. Default true. */
  enabled?: boolean;
}

/**
 * Periodically executes a callback while the document/browser tab is visible.
 * Automatically halts polling when the tab is hidden to conserve CPU, battery,
 * and server bandwidth, and immediately re-executes on focus.
 */
export function useVisibilityPolling(
  callback: () => void | Promise<void>,
  intervalMs: number,
  options: VisibilityPollingOptions = {}
): void {
  const { immediate = true, immediateOnVisible = true, enabled = true } = options;

  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  useEffect(() => {
    if (!enabled || typeof document === "undefined") return;

    let timerId: NodeJS.Timeout | null = null;
    let isMounted = true;

    const execute = () => {
      if (!isMounted) return;
      try {
        callbackRef.current();
      } catch (err) {
        console.error("Visibility polling error:", err);
      }
    };

    const startTimer = () => {
      if (timerId !== null) clearInterval(timerId);
      timerId = setInterval(execute, intervalMs);
    };

    const stopTimer = () => {
      if (timerId !== null) {
        clearInterval(timerId);
        timerId = null;
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        if (immediateOnVisible) {
          execute();
        }
        startTimer();
      } else {
        stopTimer();
      }
    };

    // If currently visible, run immediate and start polling
    if (document.visibilityState === "visible") {
      if (immediate) {
        execute();
      }
      startTimer();
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      isMounted = false;
      stopTimer();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [intervalMs, immediate, immediateOnVisible, enabled]);
}
