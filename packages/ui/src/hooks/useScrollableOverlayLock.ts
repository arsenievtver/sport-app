import { useEffect, type RefObject } from "react";

import { canScrollY, findScrollableAncestor } from "./scroll-lock-utils";

/**
 * Keeps wheel/touch scroll inside `scrollRef` while active — stops chaining to page, modals, sheets.
 * `strict`: block all scroll outside the element (portaled dropdowns). Otherwise only stop at scroll edges.
 */
export function useScrollableOverlayLock(
  scrollRef: RefObject<HTMLElement | null>,
  active: boolean,
  strict = true,
) {
  useEffect(() => {
    if (!active) return;

    const onWheel = (event: WheelEvent) => {
      const scrollEl = scrollRef.current;
      if (!scrollEl) return;

      if (!scrollEl.contains(event.target as Node)) {
        if (strict) event.preventDefault();
        return;
      }

      event.stopPropagation();

      const deltaY = event.deltaY;
      if (deltaY === 0) return;

      const scrollable = findScrollableAncestor(event.target as Node) ?? scrollEl;
      if (!canScrollY(scrollable, deltaY)) {
        event.preventDefault();
      }
    };

    let touchStartY = 0;

    const onTouchStart = (event: TouchEvent) => {
      touchStartY = event.touches[0]?.clientY ?? 0;
    };

    const onTouchMove = (event: TouchEvent) => {
      const scrollEl = scrollRef.current;
      if (!scrollEl) return;

      const target = event.target;
      if (!(target instanceof Node) || !scrollEl.contains(target)) {
        if (strict) event.preventDefault();
        return;
      }

      const touchY = event.touches[0]?.clientY ?? touchStartY;
      const deltaY = touchStartY - touchY;
      touchStartY = touchY;

      if (deltaY === 0) return;

      const scrollable = findScrollableAncestor(target) ?? scrollEl;
      if (!canScrollY(scrollable, deltaY)) {
        event.preventDefault();
      }

      event.stopPropagation();
    };

    const options: AddEventListenerOptions = { passive: false, capture: true };
    const scrollEl = scrollRef.current;

    if (strict) {
      document.addEventListener("wheel", onWheel, options);
      document.addEventListener("touchstart", onTouchStart, { passive: true, capture: true });
      document.addEventListener("touchmove", onTouchMove, options);

      return () => {
        document.removeEventListener("wheel", onWheel, options);
        document.removeEventListener("touchstart", onTouchStart, { capture: true });
        document.removeEventListener("touchmove", onTouchMove, options);
      };
    }

    if (!scrollEl) return;

    const localOptions: AddEventListenerOptions = { passive: false };
    scrollEl.addEventListener("wheel", onWheel, localOptions);
    scrollEl.addEventListener("touchstart", onTouchStart, { passive: true });
    scrollEl.addEventListener("touchmove", onTouchMove, localOptions);

    return () => {
      scrollEl.removeEventListener("wheel", onWheel, localOptions);
      scrollEl.removeEventListener("touchstart", onTouchStart);
      scrollEl.removeEventListener("touchmove", onTouchMove, localOptions);
    };
  }, [active, scrollRef, strict]);
}
