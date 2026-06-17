/**
 * iOS PWA: layout viewport на холодном старте короче экрана.
 * scrollTo(0, 1) → scrollTo(0, 0) — тот же пересчёт, что при протягивании вниз.
 */
export function nudgeIosViewport(): void {
  if (typeof window === "undefined") return;

  const y = window.scrollY;
  if (y !== 0) return;

  window.scrollTo(0, 1);
  requestAnimationFrame(() => {
    window.scrollTo(0, y);
  });
}

export function initViewport(): void {
  if (typeof window === "undefined") return;

  nudgeIosViewport();

  window.addEventListener("pageshow", nudgeIosViewport);
  window.addEventListener("orientationchange", nudgeIosViewport);
  window.visualViewport?.addEventListener("resize", nudgeIosViewport);
}
