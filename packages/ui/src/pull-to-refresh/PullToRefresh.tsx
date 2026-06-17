import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

const THRESHOLD = 72;
const MAX_PULL = 128;
const RESISTANCE = 0.52;
const MIN_REFRESH_MS = 500;

type PullPhase = "idle" | "pulling" | "ready" | "refreshing";

interface PullToRefreshContextValue {
  register: (refresh: () => void | Promise<void>) => () => void;
}

const PullToRefreshContext = createContext<PullToRefreshContextValue | null>(null);

function getScrollTop(): number {
  return window.scrollY || document.documentElement.scrollTop || 0;
}

function getTouchPoint(event: TouchEvent) {
  return { x: event.touches[0]?.clientX ?? 0, y: event.touches[0]?.clientY ?? 0 };
}

interface PullToRefreshProps {
  children: ReactNode;
  onRefresh?: () => void | Promise<void>;
  disabled?: boolean;
}

export function PullToRefresh({ children, onRefresh, disabled = false }: PullToRefreshProps) {
  const refreshersRef = useRef(new Set<() => void | Promise<void>>());
  const [pullDistance, setPullDistance] = useState(0);
  const [phase, setPhase] = useState<PullPhase>("idle");

  const pullDistanceRef = useRef(0);
  const phaseRef = useRef<PullPhase>("idle");

  const tracking = useRef({
    active: false,
    committed: false,
    startX: 0,
    startY: 0,
    readyHaptic: false,
  });

  pullDistanceRef.current = pullDistance;
  phaseRef.current = phase;

  const register = useCallback((refresh: () => void | Promise<void>) => {
    refreshersRef.current.add(refresh);
    return () => refreshersRef.current.delete(refresh);
  }, []);

  const runRefresh = useCallback(async () => {
    const tasks: Array<void | Promise<void>> = [];
    if (onRefresh) tasks.push(onRefresh());
    for (const refresh of refreshersRef.current) {
      tasks.push(refresh());
    }
    await Promise.all(tasks.map((task) => Promise.resolve(task)));
  }, [onRefresh]);

  const resetPull = useCallback(() => {
    tracking.current = {
      active: false,
      committed: false,
      startX: 0,
      startY: 0,
      readyHaptic: false,
    };
    setPullDistance(0);
    setPhase("idle");
  }, []);

  const triggerRefresh = useCallback(async () => {
    setPhase("refreshing");
    setPullDistance(THRESHOLD * 0.85);
    const started = performance.now();
    try {
      await runRefresh();
    } finally {
      const elapsed = performance.now() - started;
      if (elapsed < MIN_REFRESH_MS) {
        await new Promise((resolve) => window.setTimeout(resolve, MIN_REFRESH_MS - elapsed));
      }
      resetPull();
    }
  }, [runRefresh, resetPull]);

  useEffect(() => {
    if (disabled) return;

    const onTouchStart = (event: TouchEvent) => {
      if (phaseRef.current === "refreshing") return;
      if (getScrollTop() > 2) return;

      const point = getTouchPoint(event);
      tracking.current = {
        active: true,
        committed: false,
        startX: point.x,
        startY: point.y,
        readyHaptic: false,
      };
    };

    const onTouchMove = (event: TouchEvent) => {
      const state = tracking.current;
      if (!state.active || phaseRef.current === "refreshing") return;

      const point = getTouchPoint(event);
      const deltaX = point.x - state.startX;
      const deltaY = point.y - state.startY;

      if (!state.committed) {
        if (deltaY <= 0) return;
        if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 8) {
          state.active = false;
          return;
        }
        if (deltaY < 10) return;
        if (getScrollTop() > 2) {
          state.active = false;
          return;
        }
        state.committed = true;
      }

      if (getScrollTop() > 2) {
        resetPull();
        return;
      }

      event.preventDefault();

      const nextPull = Math.min(MAX_PULL, deltaY * RESISTANCE);
      setPullDistance(nextPull);

      if (nextPull >= THRESHOLD) {
        setPhase("ready");
        if (!state.readyHaptic && navigator.vibrate) {
          navigator.vibrate(12);
          state.readyHaptic = true;
        }
      } else {
        setPhase("pulling");
        state.readyHaptic = false;
      }
    };

    const onTouchEnd = () => {
      const state = tracking.current;
      if (!state.active && phaseRef.current === "idle") return;

      if (state.committed && pullDistanceRef.current >= THRESHOLD) {
        void triggerRefresh();
        return;
      }

      resetPull();
    };

    document.addEventListener("touchstart", onTouchStart, { passive: true });
    document.addEventListener("touchmove", onTouchMove, { passive: false });
    document.addEventListener("touchend", onTouchEnd, { passive: true });
    document.addEventListener("touchcancel", onTouchEnd, { passive: true });

    return () => {
      document.removeEventListener("touchstart", onTouchStart);
      document.removeEventListener("touchmove", onTouchMove);
      document.removeEventListener("touchend", onTouchEnd);
      document.removeEventListener("touchcancel", onTouchEnd);
    };
  }, [disabled, resetPull, triggerRefresh]);

  const contextValue = useMemo(() => ({ register }), [register]);

  const indicatorClass = [
    "pull-to-refresh__indicator",
    phase !== "idle" ? "pull-to-refresh__indicator--visible" : "",
    phase === "ready" ? "pull-to-refresh__indicator--ready" : "",
    phase === "refreshing" ? "pull-to-refresh__indicator--refreshing" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const surfaceClass = [
    "pull-to-refresh__surface",
    phase === "pulling" || phase === "ready" ? "pull-to-refresh__surface--dragging" : "",
    phase === "refreshing" ? "pull-to-refresh__surface--refreshing" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const indicatorStyle =
    phase === "refreshing"
      ? undefined
      : { transform: `translateY(${Math.max(0, pullDistance - 28)}px) scale(${0.82 + Math.min(pullDistance / THRESHOLD, 1) * 0.18})` };

  const surfaceStyle =
    phase === "idle" ? undefined : { transform: `translateY(${phase === "refreshing" ? THRESHOLD * 0.55 : pullDistance}px)` };

  return (
    <PullToRefreshContext.Provider value={contextValue}>
      <div className="pull-to-refresh">
        <div className={indicatorClass} style={indicatorStyle} aria-hidden="true">
          {phase === "refreshing" ? (
            <div className="pull-to-refresh__spinner" />
          ) : (
            <svg className="pull-to-refresh__arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 5v14" strokeLinecap="round" />
              <path d="m6 11 6-6 6 6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </div>
        <div className={surfaceClass} style={surfaceStyle}>
          {children}
        </div>
      </div>
    </PullToRefreshContext.Provider>
  );
}

export function usePullToRefresh(refresh: () => void | Promise<void>) {
  const context = useContext(PullToRefreshContext);
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;

  useEffect(() => {
    if (!context) return;
    return context.register(() => refreshRef.current());
  }, [context]);
}
