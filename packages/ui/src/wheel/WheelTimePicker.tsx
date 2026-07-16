import { WheelNumberPicker } from "./WheelNumberPicker";

export const TIME_MINUTE_STEP = 10;

export interface WheelTimePickerProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  ariaLabel?: string;
}

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

/** Parse `HH:MM` / `HH:MM:SS`; null if empty or invalid. */
export function parseHhMm(value: string | null | undefined): { hours: number; minutes: number } | null {
  if (!value?.trim()) return null;
  const parts = value.trim().split(":");
  if (parts.length < 2) return null;
  const hours = Number(parts[0]);
  const minutes = Number(parts[1]);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return { hours, minutes };
}

export function formatHhMm(hours: number, minutes: number): string {
  return `${pad2(hours)}:${pad2(minutes)}`;
}

/** Snap total minutes to step; keeps result within 00:00–23:50 for step 10. */
export function snapHhMm(value: string, step = TIME_MINUTE_STEP): string {
  const parsed = parseHhMm(value);
  if (!parsed) return "09:00";
  let total = parsed.hours * 60 + parsed.minutes;
  total = Math.round(total / step) * step;
  const maxTotal = 23 * 60 + Math.floor(59 / step) * step;
  total = Math.min(maxTotal, Math.max(0, total));
  return formatHhMm(Math.floor(total / 60), total % 60);
}

export function displayHhMm(value: string | null | undefined, emptyLabel = "—"): string {
  if (!value?.trim()) return emptyLabel;
  return snapHhMm(value);
}

export function WheelTimePicker({
  value,
  onChange,
  disabled = false,
  ariaLabel = "Время",
}: WheelTimePickerProps) {
  const snapped = snapHhMm(value);
  const parsed = parseHhMm(snapped) ?? { hours: 9, minutes: 0 };

  const setHours = (hours: number) => {
    onChange(formatHhMm(hours, parsed.minutes));
  };

  const setMinutes = (minutes: number) => {
    onChange(formatHhMm(parsed.hours, minutes));
  };

  return (
    <div className="wheel-time-picker" role="group" aria-label={ariaLabel}>
      <WheelNumberPicker
        className="wheel-time-picker__column"
        value={parsed.hours}
        onChange={setHours}
        min={0}
        max={23}
        step={1}
        formatValue={pad2}
        ariaLabel={`${ariaLabel}: часы`}
        disabled={disabled}
      />
      <span className="wheel-time-picker__colon" aria-hidden="true">
        :
      </span>
      <WheelNumberPicker
        className="wheel-time-picker__column"
        value={parsed.minutes}
        onChange={setMinutes}
        min={0}
        max={50}
        step={TIME_MINUTE_STEP}
        formatValue={pad2}
        ariaLabel={`${ariaLabel}: минуты`}
        disabled={disabled}
      />
    </div>
  );
}
