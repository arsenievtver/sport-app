import { useEffect, type RefObject } from "react";

import { useBodyScrollLock } from "./useBodyScrollLock";
import { canScrollY, findOverlayScrollArea, findScrollableAncestor, isTouchInteractiveTarget } from "./scroll-lock-utils";

/** Locks page scroll and keeps touch/wheel inside modal scroll areas only. */
export function useModalScrollIsolation(
  active: boolean,
  modalRef: RefObject<HTMLElement | null>,
) {
  useBodyScrollLock(active);

  useEffect(() => {
    if (!active) return;

    let touchStartY = 0;

    const onTouchStart = (event: TouchEvent) => {
      touchStartY = event.touches[0]?.clientY ?? 0;
    };

    const onTouchMove = (event: TouchEvent) => {
      const modal = modalRef.current;
      if (!modal) return;

      const target = event.target;
      if (!(target instanceof Node)) return;

      if (!modal.contains(target)) {
        const overlayScrollable = findOverlayScrollArea(target);
        if (overlayScrollable) {
          const touchY = event.touches[0]?.clientY ?? touchStartY;
          const deltaY = touchStartY - touchY;
          touchStartY = touchY;
          if (!canScrollY(overlayScrollable, deltaY)) {
            event.preventDefault();
          }
          return;
        }

        event.preventDefault();
        return;
      }

      if (isTouchInteractiveTarget(target)) {
        return;
      }

      const scrollable = findScrollableAncestor(target, modal);
      if (!scrollable) {
        event.preventDefault();
        return;
      }

      const touchY = event.touches[0]?.clientY ?? touchStartY;
      const deltaY = touchStartY - touchY;
      touchStartY = touchY;

      if (!canScrollY(scrollable, deltaY)) {
        event.preventDefault();
      }
    };

    const onWheel = (event: WheelEvent) => {
      const modal = modalRef.current;
      if (!modal) return;

      const target = event.target;
      if (!(target instanceof Node)) return;

      if (!modal.contains(target)) {
        const overlayScrollable = findOverlayScrollArea(target);
        if (!overlayScrollable || !canScrollY(overlayScrollable, event.deltaY)) {
          event.preventDefault();
        }
        return;
      }

      if (isTouchInteractiveTarget(target)) {
        return;
      }

      const scrollable = findScrollableAncestor(target, modal);
      if (!scrollable) {
        event.preventDefault();
        return;
      }

      if (!canScrollY(scrollable, event.deltaY)) {
        event.preventDefault();
      }
    };

    const options: AddEventListenerOptions = { passive: false, capture: true };
    document.addEventListener("touchstart", onTouchStart, { passive: true, capture: true });
    document.addEventListener("touchmove", onTouchMove, options);
    document.addEventListener("wheel", onWheel, options);

    return () => {
      document.removeEventListener("touchstart", onTouchStart, { capture: true });
      document.removeEventListener("touchmove", onTouchMove, options);
      document.removeEventListener("wheel", onWheel, options);
    };
  }, [active, modalRef]);
}
