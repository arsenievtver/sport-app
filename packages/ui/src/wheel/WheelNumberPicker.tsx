import { useRef, useState } from "react";

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
const RUBBER_BAND = 0.28;

function clampValue(value: number, min: number, max: number, step: number): number {
  const snapped = Math.round(value / step) * step;
  return Math.min(max, Math.max(min, snapped));
}

function formatWheelValue(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1).replace(".", ",");
}

function computeDragVisual(
  startValue: number,
  totalDragPx: number,
  min: number,
  max: number,
  step: number,
): { value: number; visualOffset: number } {
  const rawSteps = -totalDragPx / ITEM_HEIGHT;
  let steps = rawSteps > 0 ? Math.floor(rawSteps) : Math.ceil(rawSteps);
  const value = clampValue(startValue + steps * step, min, max, step);
  const appliedSteps = (value - startValue) / step;
  const committedOffset = -appliedSteps * ITEM_HEIGHT;
  let visualOffset = totalDragPx - committedOffset;

  const maxStepsUp = (max - startValue) / step;
  const maxStepsDown = (startValue - min) / step;
  const atUpper = rawSteps > maxStepsUp;
  const atLower = rawSteps < -maxStepsDown;

  if (atUpper || atLower) {
    const limitSteps = atUpper ? maxStepsUp : -maxStepsDown;
    const limitOffset = -limitSteps * ITEM_HEIGHT;
    visualOffset = limitOffset + (totalDragPx - limitOffset) * RUBBER_BAND;
  }

  return { value, visualOffset };
}

function snapDragValue(
  startValue: number,
  totalDragPx: number,
  min: number,
  max: number,
  step: number,
): number {
  const roundedSteps = Math.round(-totalDragPx / ITEM_HEIGHT);
  return clampValue(startValue + roundedSteps * step, min, max, step);
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
  const [visualOffset, setVisualOffset] = useState(0);
  const [previewValue, setPreviewValue] = useState(current);

  const dragStartValue = useRef(current);
  const totalDragPx = useRef(0);
  const lastPointerY = useRef(0);
  const activePointerId = useRef<number | null>(null);

  const shownValue = isDragging ? previewValue : current;
  const prevValue = shownValue - step >= min ? shownValue - step : null;
  const nextValue = shownValue + step <= max ? shownValue + step : null;

  const finishDrag = (commit: boolean) => {
    if (activePointerId.current == null) return;

    let finalValue = dragStartValue.current;
    if (commit) {
      finalValue = snapDragValue(dragStartValue.current, totalDragPx.current, min, max, step);
      onChange(finalValue);
    }

    activePointerId.current = null;
    totalDragPx.current = 0;
    setIsDragging(false);
    setVisualOffset(0);
    setPreviewValue(finalValue);
  };

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (disabled || activePointerId.current != null) return;

    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    activePointerId.current = event.pointerId;
    dragStartValue.current = current;
    totalDragPx.current = 0;
    lastPointerY.current = event.clientY;
    setPreviewValue(current);
    setVisualOffset(0);
    setIsDragging(true);
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (disabled || activePointerId.current !== event.pointerId) return;

    event.preventDefault();
    const deltaY = event.clientY - lastPointerY.current;
    lastPointerY.current = event.clientY;
    totalDragPx.current += deltaY;

    const next = computeDragVisual(dragStartValue.current, totalDragPx.current, min, max, step);
    setPreviewValue(next.value);
    setVisualOffset(next.visualOffset);
  };

  const onPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    if (activePointerId.current !== event.pointerId) return;
    event.preventDefault();
    finishDrag(true);
  };

  const onPointerCancel = (event: React.PointerEvent<HTMLDivElement>) => {
    if (activePointerId.current !== event.pointerId) return;
    finishDrag(true);
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
          className={`wheel-number-picker__track${isDragging ? " wheel-number-picker__track--dragging" : ""}`}
          style={{
            transform: `translateY(calc(var(--wheel-item-height, 48px) * -0.5 + ${visualOffset}px))`,
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
}
