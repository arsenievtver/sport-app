import { useEffect, useMemo, useRef, useState } from "react";

export interface WheelNumberPickerProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  ariaLabel?: string;
  disabled?: boolean;
  /** Override displayed labels (e.g. zero-padded hours/minutes). */
  formatValue?: (value: number) => string;
  className?: string;
}

const ITEM_HEIGHT = 28;
const VIEWPORT_HEIGHT_ITEMS = 2.75;
const RENDER_BUFFER = 5;
const RUBBER_BAND = 0.32;
const SETTLE_MS = 280;

function clampValue(value: number, min: number, max: number, step: number): number {
  const snapped = Math.round(value / step) * step;
  return Math.min(max, Math.max(min, snapped));
}

function formatWheelValue(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1).replace(".", ",");
}

function valueToScrollPos(value: number, min: number, step: number): number {
  return ((value - min) / step) * ITEM_HEIGHT;
}

function maxScrollPos(min: number, max: number, step: number): number {
  return ((max - min) / step) * ITEM_HEIGHT;
}

function scrollPosToValue(scrollPos: number, min: number, max: number, step: number): number {
  return clampValue(min + Math.round(scrollPos / ITEM_HEIGHT) * step, min, max, step);
}

function rubberBandScroll(scrollPos: number, maxScroll: number): number {
  if (scrollPos < 0) return scrollPos * RUBBER_BAND;
  if (scrollPos > maxScroll) return maxScroll + (scrollPos - maxScroll) * RUBBER_BAND;
  return scrollPos;
}

function clampScroll(scrollPos: number, maxScroll: number): number {
  return Math.min(maxScroll, Math.max(0, scrollPos));
}

function snapScroll(scrollPos: number, maxScroll: number): number {
  return clampScroll(Math.round(scrollPos / ITEM_HEIGHT) * ITEM_HEIGHT, maxScroll);
}

function smoothstep(t: number): number {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
}

interface ItemVisualStyle {
  transform: string;
  opacity: number;
  fontSize: string;
  fontWeight: number;
  color: string;
}

function itemVisual(distanceFromCenter: number): ItemVisualStyle {
  const t = Math.min(1, Math.abs(distanceFromCenter) / ITEM_HEIGHT);
  const focus = smoothstep(1 - t);
  const scale = 0.76 + focus * 0.24;

  return {
    transform: `scale(${scale})`,
    opacity: 0.32 + focus * 0.68,
    fontSize: `${10 + focus * 6}px`,
    fontWeight: Math.round(400 + focus * 200),
    color: focus > 0.45 ? "var(--color-text)" : "var(--color-text-secondary)",
  };
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
  formatValue = formatWheelValue,
  className = "",
}: WheelNumberPickerProps) {
  const current = clampValue(value, min, max, step);
  const maxScroll = maxScrollPos(min, max, step);

  const [scrollPos, setScrollPos] = useState(() => valueToScrollPos(current, min, step));
  const [isDragging, setIsDragging] = useState(false);
  const [isSettling, setIsSettling] = useState(false);

  const scrollPosRef = useRef(scrollPos);
  const activePointerId = useRef<number | null>(null);
  const dragStartY = useRef(0);
  const dragStartScroll = useRef(0);
  const lastPointerY = useRef(0);
  const lastMoveTime = useRef(0);
  const velocityY = useRef(0);
  const animationFrame = useRef<number | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const wheelStateRef = useRef({ current, min, max, step, disabled, onChange });
  wheelStateRef.current = { current, min, max, step, disabled, onChange };

  const syncScroll = (next: number) => {
    scrollPosRef.current = next;
    setScrollPos(next);
  };

  useEffect(() => {
    if (!isDragging && !isSettling) {
      const next = valueToScrollPos(current, min, step);
      syncScroll(next);
    }
  }, [current, min, step, isDragging, isSettling]);

  useEffect(() => {
    return () => {
      if (animationFrame.current != null) {
        cancelAnimationFrame(animationFrame.current);
      }
    };
  }, []);

  // React registers onWheel as passive — preventDefault needs a native non-passive listener.
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;

    const onWheel = (event: WheelEvent) => {
      const state = wheelStateRef.current;
      if (state.disabled) return;
      event.preventDefault();
      const direction = event.deltaY > 0 ? -1 : 1;
      state.onChange(clampValue(state.current + direction * state.step, state.min, state.max, state.step));
    };

    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const stopAnimation = () => {
    if (animationFrame.current != null) {
      cancelAnimationFrame(animationFrame.current);
      animationFrame.current = null;
    }
  };

  const animateScrollTo = (target: number, onComplete: () => void) => {
    stopAnimation();
    const start = scrollPosRef.current;
    const startTime = performance.now();

    const frame = (now: number) => {
      const progress = Math.min(1, (now - startTime) / SETTLE_MS);
      const eased = 1 - (1 - progress) ** 3;
      syncScroll(start + (target - start) * eased);

      if (progress < 1) {
        animationFrame.current = requestAnimationFrame(frame);
        return;
      }

      animationFrame.current = null;
      onComplete();
    };

    animationFrame.current = requestAnimationFrame(frame);
  };

  const finishInteraction = (withInertia = false) => {
    if (withInertia && Math.abs(velocityY.current) > 0.45) {
      setIsDragging(false);
      let velocity = velocityY.current * 14;
      let lastFrame = performance.now();

      const tick = (time: number) => {
        const dt = Math.min(32, time - lastFrame);
        lastFrame = time;
        const next = scrollPosRef.current - velocity * (dt / 16);
        syncScroll(next);
        velocity *= 0.9;

        if (Math.abs(velocity) < 0.2) {
          animationFrame.current = null;
          const snapped = snapScroll(scrollPosRef.current, maxScroll);
          setIsSettling(true);
          animateScrollTo(snapped, () => {
            const finalValue = scrollPosToValue(snapped, min, max, step);
            onChange(finalValue);
            syncScroll(snapped);
            setIsSettling(false);
          });
          return;
        }

        animationFrame.current = requestAnimationFrame(tick);
      };

      animationFrame.current = requestAnimationFrame(tick);
      return;
    }

    const snapped = snapScroll(scrollPosRef.current, maxScroll);
    setIsDragging(false);
    setIsSettling(true);
    animateScrollTo(snapped, () => {
      const finalValue = scrollPosToValue(snapped, min, max, step);
      onChange(finalValue);
      syncScroll(snapped);
      setIsSettling(false);
    });
  };

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (disabled || activePointerId.current != null) return;

    stopAnimation();
    setIsSettling(false);

    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    activePointerId.current = event.pointerId;
    dragStartY.current = event.clientY;
    dragStartScroll.current = scrollPosRef.current;
    lastPointerY.current = event.clientY;
    lastMoveTime.current = performance.now();
    velocityY.current = 0;
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

    syncScroll(dragStartScroll.current - (event.clientY - dragStartY.current));
  };

  const onPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    if (activePointerId.current !== event.pointerId) return;
    event.preventDefault();
    activePointerId.current = null;
    finishInteraction(true);
  };

  const onPointerCancel = (event: React.PointerEvent<HTMLDivElement>) => {
    if (activePointerId.current !== event.pointerId) return;
    activePointerId.current = null;
    finishInteraction(false);
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

  const visualScroll = isDragging ? rubberBandScroll(scrollPos, maxScroll) : scrollPos;
  const shownValue = scrollPosToValue(clampScroll(visualScroll, maxScroll), min, max, step);

  const items = useMemo(() => {
    const centerIndex = visualScroll / ITEM_HEIGHT;
    const firstIndex = Math.floor(centerIndex) - RENDER_BUFFER;
    const lastIndex = Math.ceil(centerIndex) + RENDER_BUFFER;
    const viewportCenter = ITEM_HEIGHT * VIEWPORT_HEIGHT_ITEMS * 0.5;

    const rendered: Array<{
      key: number;
      value: number;
      top: number;
      style: ItemVisualStyle;
    }> = [];

    for (let index = firstIndex; index <= lastIndex; index += 1) {
      const itemValue = min + index * step;
      if (itemValue < min || itemValue > max) continue;

      const distanceFromCenter = index * ITEM_HEIGHT - visualScroll;
      const top = viewportCenter + distanceFromCenter - ITEM_HEIGHT / 2;

      rendered.push({
        key: index,
        value: itemValue,
        top,
        style: itemVisual(distanceFromCenter),
      });
    }

    return rendered;
  }, [visualScroll, min, max, step]);

  return (
    <div
      className={`wheel-number-picker${disabled ? " wheel-number-picker--disabled" : ""}${
        className ? ` ${className}` : ""
      }`}
    >
      {unit ? <span className="wheel-number-picker__unit">{unit}</span> : null}
      <div
        ref={viewportRef}
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
        onKeyDown={onKeyDown}
      >
        <div className="wheel-number-picker__fade wheel-number-picker__fade--top" aria-hidden="true" />
        <div className="wheel-number-picker__fade wheel-number-picker__fade--bottom" aria-hidden="true" />
        <div className="wheel-number-picker__highlight" aria-hidden="true" />

        <div className="wheel-number-picker__track">
          {items.map((item) => (
            <div
              key={item.key}
              className="wheel-number-picker__item"
              aria-hidden={item.value !== shownValue}
              style={{
                top: `${item.top}px`,
                transform: item.style.transform,
                opacity: item.style.opacity,
                fontSize: item.style.fontSize,
                fontWeight: item.style.fontWeight,
                color: item.style.color,
              }}
            >
              {formatValue(item.value)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
