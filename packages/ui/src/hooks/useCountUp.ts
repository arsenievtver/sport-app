import { useEffect, useRef, useState } from "react";

function easeOutCubic(t: number): number {
  return 1 - (1 - t) ** 3;
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

interface UseCountUpOptions {
  duration?: number;
  delay?: number;
  enabled?: boolean;
  decimals?: number;
}

export function useCountUp(target: number, options: UseCountUpOptions = {}): number {
  const { duration = 1000, delay = 0, enabled = true, decimals = 0 } = options;
  const [value, setValue] = useState(0);
  const hasAnimatedRef = useRef(false);
  const lastTargetRef = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled) {
      setValue(0);
      hasAnimatedRef.current = false;
      lastTargetRef.current = null;
      return;
    }

    if (prefersReducedMotion()) {
      setValue(target);
      hasAnimatedRef.current = true;
      lastTargetRef.current = target;
      return;
    }

    if (hasAnimatedRef.current && lastTargetRef.current !== target) {
      setValue(target);
      lastTargetRef.current = target;
      return;
    }

    if (hasAnimatedRef.current && lastTargetRef.current === target) {
      return;
    }

    let raf = 0;
    let timeout = 0;
    setValue(0);

    const run = () => {
      let start: number | null = null;

      const step = (timestamp: number) => {
        if (start === null) start = timestamp;
        const progress = Math.min((timestamp - start) / duration, 1);
        const current = target * easeOutCubic(progress);
        const rounded =
          decimals > 0
            ? Math.round(current * 10 ** decimals) / 10 ** decimals
            : Math.round(current);
        setValue(rounded);
        if (progress < 1) {
          raf = requestAnimationFrame(step);
        } else {
          setValue(target);
          hasAnimatedRef.current = true;
          lastTargetRef.current = target;
        }
      };

      raf = requestAnimationFrame(step);
    };

    if (delay > 0) {
      timeout = window.setTimeout(run, delay);
    } else {
      run();
    }

    return () => {
      window.clearTimeout(timeout);
      cancelAnimationFrame(raf);
    };
  }, [target, duration, delay, enabled, decimals]);

  return value;
}
