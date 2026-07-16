import { useMemo, useState } from "react";
import type { CoachScheduleSettings } from "@sport-app/shared";
import { WEEKDAY_OPTIONS } from "@sport-app/shared";
import { WheelNumberPicker } from "../wheel/WheelNumberPicker";
import {
  displayHhMm,
  snapHhMm,
  WheelTimePicker,
} from "../wheel/WheelTimePicker";

interface CoachScheduleSettingsFormProps {
  settings: CoachScheduleSettings;
  saving?: boolean;
  onSave: (settings: CoachScheduleSettings) => void;
}

type TimeFieldId = "slot_start" | "slot_end" | "lunch_start" | "lunch_end" | "duration";

const DEFAULT_LUNCH_START = "13:00";
const DEFAULT_LUNCH_END = "14:00";
const DURATION_MIN = 15;
const DURATION_MAX = 240;
const DURATION_STEP = 15;

function normalizeSettings(settings: CoachScheduleSettings): CoachScheduleSettings {
  return {
    ...settings,
    slot_start: snapHhMm(settings.slot_start),
    slot_end: snapHhMm(settings.slot_end),
    lunch_start: settings.lunch_start ? snapHhMm(settings.lunch_start) : null,
    lunch_end: settings.lunch_end ? snapHhMm(settings.lunch_end) : null,
    slot_duration_min: Math.min(
      DURATION_MAX,
      Math.max(
        DURATION_MIN,
        Math.round(settings.slot_duration_min / DURATION_STEP) * DURATION_STEP || DURATION_MIN,
      ),
    ),
  };
}

function TimeChip({
  label,
  value,
  emptyLabel,
  active,
  disabled,
  onClick,
}: {
  label: string;
  value: string | null;
  emptyLabel?: string;
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={`schedule-settings-form__time-chip${
        active ? " schedule-settings-form__time-chip--active" : ""
      }${!value ? " schedule-settings-form__time-chip--empty" : ""}`}
      disabled={disabled}
      aria-expanded={active}
      onClick={onClick}
    >
      <span className="schedule-settings-form__time-chip-label">{label}</span>
      <span className="schedule-settings-form__time-chip-value">
        {displayHhMm(value, emptyLabel ?? "—")}
      </span>
    </button>
  );
}

export function CoachScheduleSettingsForm({
  settings,
  saving = false,
  onSave,
}: CoachScheduleSettingsFormProps) {
  const [draft, setDraft] = useState(() => normalizeSettings(settings));
  const [activeField, setActiveField] = useState<TimeFieldId | null>(null);

  const lunchSet = Boolean(draft.lunch_start || draft.lunch_end);

  const activeTimeValue = useMemo(() => {
    if (activeField === "slot_start") return draft.slot_start;
    if (activeField === "slot_end") return draft.slot_end;
    if (activeField === "lunch_start") return draft.lunch_start ?? DEFAULT_LUNCH_START;
    if (activeField === "lunch_end") return draft.lunch_end ?? DEFAULT_LUNCH_END;
    return null;
  }, [activeField, draft]);

  const toggleField = (field: TimeFieldId) => {
    const next = activeField === field ? null : field;
    if (next === "lunch_start" || next === "lunch_end") {
      setDraft((prev) => {
        if (prev.lunch_start && prev.lunch_end) return prev;
        return {
          ...prev,
          lunch_start: prev.lunch_start ?? DEFAULT_LUNCH_START,
          lunch_end: prev.lunch_end ?? DEFAULT_LUNCH_END,
        };
      });
    }
    setActiveField(next);
  };

  const setTimeField = (field: Exclude<TimeFieldId, "duration">, value: string) => {
    const snapped = snapHhMm(value);
    setDraft((prev) => {
      if (field === "slot_start") return { ...prev, slot_start: snapped };
      if (field === "slot_end") return { ...prev, slot_end: snapped };
      if (field === "lunch_start") {
        return {
          ...prev,
          lunch_start: snapped,
          lunch_end: prev.lunch_end ?? DEFAULT_LUNCH_END,
        };
      }
      return { ...prev, lunch_end: snapped, lunch_start: prev.lunch_start ?? DEFAULT_LUNCH_START };
    });
  };

  const clearLunch = () => {
    setDraft((prev) => ({ ...prev, lunch_start: null, lunch_end: null }));
    setActiveField((prev) => (prev === "lunch_start" || prev === "lunch_end" ? null : prev));
  };

  return (
    <form
      className="schedule-settings-form"
      onSubmit={(event) => {
        event.preventDefault();
        onSave(normalizeSettings(draft));
      }}
    >
      <div className="schedule-settings-form__row">
        <span className="schedule-settings-form__label">Рабочие дни</span>
        <div className="schedule-settings-form__chips">
          {WEEKDAY_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              className={`schedule-settings-form__chip${
                draft.work_days.includes(option.value) ? " schedule-settings-form__chip--active" : ""
              }`}
              disabled={saving}
              onClick={() => {
                setDraft((prev) => {
                  const hasDay = prev.work_days.includes(option.value);
                  const work_days = hasDay
                    ? prev.work_days.filter((value) => value !== option.value)
                    : [...prev.work_days, option.value].sort((a, b) => a - b);
                  return { ...prev, work_days: work_days.length > 0 ? work_days : prev.work_days };
                });
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="schedule-settings-form__row">
        <span className="schedule-settings-form__label">Окно слотов</span>
        <div className="schedule-settings-form__time-row">
          <TimeChip
            label="С"
            value={draft.slot_start}
            active={activeField === "slot_start"}
            disabled={saving}
            onClick={() => toggleField("slot_start")}
          />
          <TimeChip
            label="До"
            value={draft.slot_end}
            active={activeField === "slot_end"}
            disabled={saving}
            onClick={() => toggleField("slot_end")}
          />
        </div>
        {activeField === "slot_start" || activeField === "slot_end" ? (
          <WheelTimePicker
            value={activeTimeValue ?? draft.slot_start}
            onChange={(value) => setTimeField(activeField, value)}
            disabled={saving}
            ariaLabel={activeField === "slot_start" ? "Начало окна слотов" : "Конец окна слотов"}
          />
        ) : null}
      </div>

      <div className="schedule-settings-form__row">
        <div className="schedule-settings-form__label-row">
          <span className="schedule-settings-form__label">Обед (необязательно)</span>
          {lunchSet ? (
            <button
              type="button"
              className="schedule-settings-form__clear"
              disabled={saving}
              onClick={clearLunch}
            >
              Сбросить
            </button>
          ) : null}
        </div>
        <div className="schedule-settings-form__time-row">
          <TimeChip
            label="С"
            value={draft.lunch_start}
            emptyLabel="нет"
            active={activeField === "lunch_start"}
            disabled={saving}
            onClick={() => toggleField("lunch_start")}
          />
          <TimeChip
            label="До"
            value={draft.lunch_end}
            emptyLabel="нет"
            active={activeField === "lunch_end"}
            disabled={saving}
            onClick={() => toggleField("lunch_end")}
          />
        </div>
        {activeField === "lunch_start" || activeField === "lunch_end" ? (
          <WheelTimePicker
            value={activeTimeValue ?? DEFAULT_LUNCH_START}
            onChange={(value) => setTimeField(activeField, value)}
            disabled={saving}
            ariaLabel={activeField === "lunch_start" ? "Начало обеда" : "Конец обеда"}
          />
        ) : null}
      </div>

      <div className="schedule-settings-form__row">
        <span className="schedule-settings-form__label">Длительность слота</span>
        <button
          type="button"
          className={`schedule-settings-form__duration-chip${
            activeField === "duration" ? " schedule-settings-form__duration-chip--active" : ""
          }`}
          disabled={saving}
          aria-expanded={activeField === "duration"}
          onClick={() => toggleField("duration")}
        >
          {draft.slot_duration_min} мин
        </button>
        {activeField === "duration" ? (
          <div className="schedule-settings-form__duration-picker">
            <WheelNumberPicker
              value={draft.slot_duration_min}
              onChange={(slot_duration_min) => setDraft((prev) => ({ ...prev, slot_duration_min }))}
              min={DURATION_MIN}
              max={DURATION_MAX}
              step={DURATION_STEP}
              unit="мин"
              ariaLabel="Длительность слота в минутах"
              disabled={saving}
            />
          </div>
        ) : null}
      </div>

      <button type="submit" className="schedule-settings-form__save" disabled={saving}>
        {saving ? "Сохранение…" : "Сохранить"}
      </button>
    </form>
  );
}
