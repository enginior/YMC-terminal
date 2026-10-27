"use client";

import { useRef } from "react";

/**
 * Dev-only hook to log component render counts when debug-renders flag is enabled in localStorage.
 *
 * Enable in browser DevTools:
 *   localStorage.setItem("btc-terminal:debug-renders", "1");
 * Disable:
 *   localStorage.removeItem("btc-terminal:debug-renders");
 */
export function useRenderCount(name: string) {
  const countRef = useRef(0);
  countRef.current++;

  if (process.env.NODE_ENV !== "production") {
    if (typeof window !== "undefined") {
      try {
        if (window.localStorage.getItem("btc-terminal:debug-renders") === "1") {
          console.count(`[render] ${name}`);
        }
      } catch {
        // storage blocked
      }
    }
  }
}
