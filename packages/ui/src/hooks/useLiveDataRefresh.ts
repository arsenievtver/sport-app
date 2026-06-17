import { useEffect, useRef } from "react";

interface UseLiveDataRefreshOptions {
  /** When false, no listeners or polling (e.g. tab hidden). */
  enabled?: boolean;
  /** Background poll while the page is visible. Default 60s. */
  pollIntervalMs?: number;
}

/**
 * PWA-friendly data refresh: refetch when the app returns to foreground
 * and optionally poll while visible (no manual browser reload needed).
 */
export function useLiveDataRefresh(
  onRefresh: () => void | Promise<void>,
  options: UseLiveDataRefreshOptions = {},
) {
  const { enabled = true, pollIntervalMs = 60_000 } = options;
  const onRefreshRef = useRef(onRefresh);
  onRefreshRef.current = onRefresh;

  useEffect(() => {
    if (!enabled) return;

    const run = () => {
      void onRefreshRef.current();
    };

    const onVisible = () => {
      if (document.visibilityState === "visible") run();
    };

    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", run);
    window.addEventListener("pageshow", run);

    const intervalId = window.setInterval(() => {
      if (document.visibilityState === "visible") run();
    }, pollIntervalMs);

    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", run);
      window.removeEventListener("pageshow", run);
      window.clearInterval(intervalId);
    };
  }, [enabled, pollIntervalMs]);
}
