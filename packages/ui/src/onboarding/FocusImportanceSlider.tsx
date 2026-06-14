import {
  FOCUS_IMPORTANCE_MAX,
  FOCUS_IMPORTANCE_MIN,
  clampFocusImportance,
} from "@sport-app/shared";

interface FocusImportanceSliderProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
}

export function FocusImportanceSlider({ label, value, onChange }: FocusImportanceSliderProps) {
  const clamped = clampFocusImportance(value);

  return (
    <div className="focus-importance">
      <div className="focus-importance__header">
        <span className="focus-importance__label">{label}</span>
        <span className="focus-importance__value">{clamped}</span>
      </div>
      <input
        type="range"
        className="focus-importance__input"
        min={FOCUS_IMPORTANCE_MIN}
        max={FOCUS_IMPORTANCE_MAX}
        step={1}
        value={clamped}
        onChange={(e) => onChange(clampFocusImportance(Number(e.target.value)))}
        aria-label={label}
      />
    </div>
  );
}
