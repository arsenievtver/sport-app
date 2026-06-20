import { useEffect, useRef } from "react";

function getScrollTop(): number {
  return window.scrollY || document.documentElement.scrollTop || 0;
}

export function useCollapsingAppShellHeader(enabled = true) {
  const shellRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const shell = shellRef.current;
    const header = headerRef.current;
    if (!enabled || !shell || !header) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (reducedMotion.matches) return;

    let maxCollapse = 0;
    let collapse = 0;
    let lastScrollY = getScrollTop();
    let rafId = 0;

    const headerBar = header.querySelector<HTMLElement>(".app-shell__header-bar");

    let lastRatio = 0;

    const applyCollapse = (value: number) => {
      const next = Math.min(Math.max(value, 0), maxCollapse);
      const ratio = maxCollapse > 0 ? next / maxCollapse : 0;
      if (next === collapse && ratio === lastRatio) return;
      collapse = next;
      lastRatio = ratio;
      shell.style.setProperty("--shell-header-collapse", `${next}px`);
      shell.style.setProperty("--shell-header-collapse-ratio", String(ratio));
      shell.classList.toggle("app-shell--header-collapsed", next >= maxCollapse && maxCollapse > 0);
    };

    const measureFullHeight = () => {
      const fullHeight = headerBar?.offsetHeight ?? header.offsetHeight;
      maxCollapse = fullHeight;
      shell.style.setProperty("--shell-header-full-height", `${fullHeight}px`);
      applyCollapse(Math.min(collapse, maxCollapse));
    };

    const onScroll = () => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        const scrollY = getScrollTop();

        if (scrollY <= 0) {
          applyCollapse(0);
        } else {
          applyCollapse(collapse + scrollY - lastScrollY);
        }

        lastScrollY = scrollY;
      });
    };

    const remeasure = () => {
      measureFullHeight();
    };

    shell.classList.add("app-shell--collapsing-header");
    shell.style.setProperty("--shell-header-collapse", "0px");
    shell.style.setProperty("--shell-header-collapse-ratio", "0");
    measureFullHeight();
    lastScrollY = getScrollTop();

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", remeasure, { passive: true });

    const resizeObserver = typeof ResizeObserver !== "undefined" ? new ResizeObserver(remeasure) : null;
    if (headerBar) {
      resizeObserver?.observe(headerBar);
    } else {
      resizeObserver?.observe(header);
    }

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", remeasure);
      resizeObserver?.disconnect();
      shell.classList.remove("app-shell--collapsing-header", "app-shell--header-collapsed");
      shell.style.removeProperty("--shell-header-collapse");
      shell.style.removeProperty("--shell-header-collapse-ratio");
      shell.style.removeProperty("--shell-header-full-height");
    };
  }, [enabled]);

  return { shellRef, headerRef };
}
