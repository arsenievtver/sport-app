/**
 * iOS PWA: CSS dvh/svh often report a short viewport on cold start.
 * Tap then "fixes" layout until the next app launch. Sync --app-height from
 * visualViewport / innerHeight so shell fills the screen immediately.
 */
export function syncViewportHeight(): void {
  if (typeof window === "undefined" || typeof document === "undefined") return;

  const height = window.visualViewport?.height ?? window.innerHeight;
  if (height > 0) {
    document.documentElement.style.setProperty("--app-height", `${Math.round(height)}px`);
  }
}

export function initViewportHeight(): void {
  if (typeof window === "undefined" || typeof document === "undefined") return;

  let frame = 0;

  const schedule = () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(syncViewportHeight);
  };

  syncViewportHeight();
  schedule();

  // iOS standalone PWA may report the correct height only after a short delay.
  for (const delay of [50, 150, 400]) {
    window.setTimeout(syncViewportHeight, delay);
  }

  window.addEventListener("resize", schedule);
  window.addEventListener("orientationchange", schedule);
  window.addEventListener("pageshow", syncViewportHeight);
  window.visualViewport?.addEventListener("resize", schedule);
  window.visualViewport?.addEventListener("scroll", schedule);
}
