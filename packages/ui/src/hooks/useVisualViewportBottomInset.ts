import { useEffect, useState } from "react";

/**
 * Android Chrome often keeps layout `vh` unchanged when the keyboard opens.
 * Track the covered bottom inset via visualViewport so sheets can shrink above it.
 */
export function useVisualViewportBottomInset(active = true): number {
  const [inset, setInset] = useState(0);

  useEffect(() => {
    if (!active) {
      setInset(0);
      return;
    }

    const vv = window.visualViewport;
    if (!vv) return;

    const update = () => {
      const next = Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop));
      setInset(next);
    };

    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    window.addEventListener("resize", update);

    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [active]);

  return inset;
}
