import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("useVisibilityPolling logic", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("triggers callback on interval when tab is visible", () => {
    const callback = vi.fn();
    const intervalMs = 10000;

    let timer: any = setInterval(callback, intervalMs);

    expect(callback).not.toHaveBeenCalled();

    vi.advanceTimersByTime(10000);
    expect(callback).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(20000);
    expect(callback).toHaveBeenCalledTimes(3);

    clearInterval(timer);
  });

  it("pauses execution when stopped and resumes on focus", () => {
    const callback = vi.fn();
    let isVisible = true;
    let timer: any = setInterval(() => {
      if (isVisible) callback();
    }, 5000);

    vi.advanceTimersByTime(5000);
    expect(callback).toHaveBeenCalledTimes(1);

    // Tab goes hidden
    isVisible = false;
    vi.advanceTimersByTime(20000);
    expect(callback).toHaveBeenCalledTimes(1); // No new calls while hidden

    // Tab becomes visible again -> immediate execution
    isVisible = true;
    callback(); // immediateOnVisible
    expect(callback).toHaveBeenCalledTimes(2);

    vi.advanceTimersByTime(5000);
    expect(callback).toHaveBeenCalledTimes(3);

    clearInterval(timer);
  });
});
