/**
 * iOS PWA: на холодном старте layout viewport короче экрана.
 * После scroll/tap visualViewport пересчитывается — синхронизируем --viewport-height.
 */
export function syncViewportHeight(): void {
  if (typeof window === "undefined" || typeof document === "undefined") return;

  const height = window.visualViewport?.height ?? window.innerHeight;
  if (height > 0) {
    document.documentElement.style.setProperty("--viewport-height", `${Math.round(height)}px`);
  }
}

export function initViewport(): void {
  if (typeof window === "undefined") return;

  let frame = 0;

  const schedule = () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(syncViewportHeight);
  };

  syncViewportHeight();
  schedule();

  for (const delay of [50, 100, 250, 500, 1000]) {
    window.setTimeout(syncViewportHeight, delay);
  }

  window.addEventListener("resize", schedule);
  window.addEventListener("orientationchange", schedule);
  window.addEventListener("pageshow", syncViewportHeight);
  window.visualViewport?.addEventListener("resize", schedule);
  window.visualViewport?.addEventListener("scroll", schedule);
}
