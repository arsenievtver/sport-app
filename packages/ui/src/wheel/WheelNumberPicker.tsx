import { useEffect, useRef, useState } from "react";

export interface WheelNumberPickerProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  ariaLabel?: string;
  disabled?: boolean;
}

const ITEM_HEIGHT = 26;
const RUBBER_BAND = 0.35;
const SETTLE_MS = 220;

function clampValue(value: number, min: number, max: number, step: number): number {
  const snapped = Math.round(value / step) * step;
  return Math.min(max, Math.max(min, snapped));
}

function formatWheelValue(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1).replace(".", ",");
}

interface WheelDragState {
  value: number;
  offsetPx: number;
}

/**
 * iOS-style wheel: keep offset within one row height by shifting the value
 * instead of jumping the track back to center.
 */
function applyWheelRecycle(
  value: number,
  offsetPx: number,
  min: number,
  max: number,
  step: number,
): WheelDragState {
  const half = ITEM_HEIGHT / 2;
  let nextValue = value;
  let nextOffset = offsetPx;

  while (nextOffset < -half) {
    const candidate = clampValue(nextValue + step, min, max, step);
    if (candidate === nextValue) {
      nextOffset = -half + (nextOffset + half) * RUBBER_BAND;
      break;
    }
    nextValue = candidate;
    nextOffset += ITEM_HEIGHT;
  }

  while (nextOffset > half) {
    const candidate = clampValue(nextValue - step, min, max, step);
    if (candidate === nextValue) {
      nextOffset = half + (nextOffset - half) * RUBBER_BAND;
      break;
    }
    nextValue = candidate;
    nextOffset -= ITEM_HEIGHT;
  }

  return { value: nextValue, offsetPx: nextOffset };
}

export function WheelNumberPicker({
  value,
  onChange,
  min = 0,
  max = 2000,
  step = 1,
  unit,
  ariaLabel = "Значение",
  disabled = false,
}: WheelNumberPickerProps) {
  const current = clampValue(value, min, max, step);
  const [isDragging, setIsDragging] = useState(false);
  const [isSettling, setIsSettling] = useState(false);
  const [wheelValue, setWheelValue] = useState(current);
  const [wheelOffset, setWheelOffset] = useState(0);

  const activePointerId = useRef<number | null>(null);
  const dragState = useRef<WheelDragState>({ value: current, offsetPx: 0 });
  const lastPointerY = useRef(0);
  const lastMoveTime = useRef(0);
  const velocityY = useRef(0);
  const inertiaFrame = useRef<number | null>(null);
  const settleTimer = useRef<number | null>(null);

  const syncDragToState = (state: WheelDragState) => {
    dragState.current = state;
    setWheelValue(state.value);
    setWheelOffset(state.offsetPx);
  };

  useEffect(() => {
    if (!isDragging && !isSettling) {
      dragState.current = { value: current, offsetPx: 0 };
      setWheelValue(current);
      setWheelOffset(0);
    }
  }, [current, isDragging, isSettling]);

  useEffect(() => {
    return () => {
      if (inertiaFrame.current != null) {
        cancelAnimationFrame(inertiaFrame.current);
      }
      if (settleTimer.current != null) {
        window.clearTimeout(settleTimer.current);
      }
    };
  }, []);

  const stopInertia = () => {
    if (inertiaFrame.current != null) {
      cancelAnimationFrame(inertiaFrame.current);
      inertiaFrame.current = null;
    }
  };

  const beginSettle = (finalValue: number) => {
    stopInertia();
    onChange(finalValue);
    dragState.current = { value: finalValue, offsetPx: 0 };
    setWheelValue(finalValue);
    setIsDragging(false);
    setIsSettling(true);
    setWheelOffset(0);

    if (settleTimer.current != null) {
      window.clearTimeout(settleTimer.current);
    }
    settleTimer.current = window.setTimeout(() => {
      setIsSettling(false);
      settleTimer.current = null;
    }, SETTLE_MS);
  };

  const runInertia = (initialVelocity: number) => {
    let velocity = initialVelocity;
    let lastFrame = performance.now();

    const tick = (time: number) => {
      const dt = Math.min(32, time - lastFrame);
      lastFrame = time;

      const delta = velocity * (dt / 16);
      const next = applyWheelRecycle(
        dragState.current.value,
        dragState.current.offsetPx + delta,
        min,
        max,
        step,
      );
      syncDragToState(next);
      velocity *= 0.9;

      if (Math.abs(velocity) < 0.2) {
        inertiaFrame.current = null;
        beginSettle(dragState.current.value);
        return;
      }

      inertiaFrame.current = requestAnimationFrame(tick);
    };

    inertiaFrame.current = requestAnimationFrame(tick);
  };

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (disabled || activePointerId.current != null) return;

    stopInertia();
    if (settleTimer.current != null) {
      window.clearTimeout(settleTimer.current);
      settleTimer.current = null;
    }
    setIsSettling(false);

    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    activePointerId.current = event.pointerId;
    lastPointerY.current = event.clientY;
    lastMoveTime.current = performance.now();
    velocityY.current = 0;
    syncDragToState({ value: current, offsetPx: 0 });
    setIsDragging(true);
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (disabled || activePointerId.current !== event.pointerId) return;

    event.preventDefault();
    const now = performance.now();
    const deltaY = event.clientY - lastPointerY.current;
    const dt = Math.max(1, now - lastMoveTime.current);
    velocityY.current = deltaY / dt;
    lastPointerY.current = event.clientY;
    lastMoveTime.current = now;

    const next = applyWheelRecycle(
      dragState.current.value,
      dragState.current.offsetPx + deltaY,
      min,
      max,
      step,
    );
    syncDragToState(next);
  };

  const onPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    if (activePointerId.current !== event.pointerId) return;
    event.preventDefault();
    activePointerId.current = null;

    if (Math.abs(velocityY.current) > 0.45) {
      setIsDragging(false);
      runInertia(velocityY.current * 14);
      return;
    }

    beginSettle(dragState.current.value);
  };

  const onPointerCancel = (event: React.PointerEvent<HTMLDivElement>) => {
    if (activePointerId.current !== event.pointerId) return;
    activePointerId.current = null;
    beginSettle(dragState.current.value);
  };

  const onWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    if (disabled) return;
    event.preventDefault();
    const direction = event.deltaY > 0 ? -1 : 1;
    onChange(clampValue(current + direction * step, min, max, step));
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (disabled) return;
    if (event.key === "ArrowUp") {
      event.preventDefault();
      onChange(clampValue(current + step, min, max, step));
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      onChange(clampValue(current - step, min, max, step));
    }
  };

  const shownValue = isDragging || isSettling ? wheelValue : current;
  const offset = isDragging || isSettling ? wheelOffset : 0;
  const prevValue = shownValue - step >= min ? shownValue - step : null;
  const nextValue = shownValue + step <= max ? shownValue + step : null;
  const trackAnimating = isSettling && !isDragging;

  return (
    <div className={`wheel-number-picker${disabled ? " wheel-number-picker--disabled" : ""}`}>
      {unit ? <span className="wheel-number-picker__unit">{unit}</span> : null}
      <div
        className={`wheel-number-picker__viewport${isDragging ? " wheel-number-picker__viewport--dragging" : ""}`}
        role="spinbutton"
        aria-label={ariaLabel}
        aria-valuenow={shownValue}
        aria-valuemin={min}
        aria-valuemax={max}
        tabIndex={disabled ? -1 : 0}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        onWheel={onWheel}
        onKeyDown={onKeyDown}
      >
        <div className="wheel-number-picker__fade wheel-number-picker__fade--top" aria-hidden="true" />
        <div className="wheel-number-picker__fade wheel-number-picker__fade--bottom" aria-hidden="true" />

        <div
          className={`wheel-number-picker__track${isDragging ? " wheel-number-picker__track--dragging" : ""}${
            trackAnimating ? " wheel-number-picker__track--settling" : ""
          }`}
          style={{
            transform: `translateY(calc(var(--wheel-item-height) * -0.5 + ${offset}px))`,
          }}
        >
          <div className="wheel-number-picker__item wheel-number-picker__item--prev" aria-hidden="true">
            {prevValue != null ? formatWheelValue(prevValue) : ""}
          </div>
          <div className="wheel-number-picker__item wheel-number-picker__item--active">
            {formatWheelValue(shownValue)}
          </div>
          <div className="wheel-number-picker__item wheel-number-picker__item--next" aria-hidden="true">
            {nextValue != null ? formatWheelValue(nextValue) : ""}
          </div>
        </div>
      </div>
    </div>
  );
};
