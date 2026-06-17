import { useState } from "react";
import type { CoachScheduleSettings } from "@sport-app/shared";
import { WEEKDAY_OPTIONS } from "@sport-app/shared";

interface CoachScheduleSettingsFormProps {
  settings: CoachScheduleSettings;
  saving?: boolean;
  onSave: (settings: CoachScheduleSettings) => void;
}

export function CoachScheduleSettingsForm({ settings, saving = false, onSave }: CoachScheduleSettingsFormProps) {
  const [draft, setDraft] = useState<CoachScheduleSettings>(settings);

  const toggleDay = (day: number) => {
    setDraft((prev) => {
      const hasDay = prev.work_days.includes(day);
      const work_days = hasDay
        ? prev.work_days.filter((value) => value !== day)
        : [...prev.work_days, day].sort((a, b) => a - b);
      return { ...prev, work_days: work_days.length > 0 ? work_days : prev.work_days };
    });
  };

  return (
    <form
      className="schedule-settings-form"
      onSubmit={(event) => {
        event.preventDefault();
        onSave(draft);
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
              onClick={() => toggleDay(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="schedule-settings-form__row">
        <span className="schedule-settings-form__label">Окно слотов</span>
        <div className="schedule-settings-form__inputs">
          <label>
            <span className="schedule-settings-form__label">С</span>
            <input
              className="schedule-settings-form__input"
              type="time"
              value={draft.slot_start}
              onChange={(event) => setDraft((prev) => ({ ...prev, slot_start: event.target.value }))}
            />
          </label>
          <label>
            <span className="schedule-settings-form__label">До</span>
            <input
              className="schedule-settings-form__input"
              type="time"
              value={draft.slot_end}
              onChange={(event) => setDraft((prev) => ({ ...prev, slot_end: event.target.value }))}
            />
          </label>
        </div>
      </div>

      <div className="schedule-settings-form__row">
        <span className="schedule-settings-form__label">Обед (необязательно)</span>
        <div className="schedule-settings-form__inputs">
          <label>
            <span className="schedule-settings-form__label">С</span>
            <input
              className="schedule-settings-form__input"
              type="time"
              value={draft.lunch_start ?? ""}
              onChange={(event) =>
                setDraft((prev) => ({
                  ...prev,
                  lunch_start: event.target.value || null,
                  lunch_end: event.target.value ? prev.lunch_end : null,
                }))
              }
            />
          </label>
          <label>
            <span className="schedule-settings-form__label">До</span>
            <input
              className="schedule-settings-form__input"
              type="time"
              value={draft.lunch_end ?? ""}
              onChange={(event) =>
                setDraft((prev) => ({
                  ...prev,
                  lunch_end: event.target.value || null,
                }))
              }
            />
          </label>
        </div>
      </div>

      <div className="schedule-settings-form__row">
        <span className="schedule-settings-form__label">Длительность слота (мин)</span>
        <input
          className="schedule-settings-form__input"
          type="number"
          min={15}
          max={240}
          step={15}
          value={draft.slot_duration_min}
          onChange={(event) =>
            setDraft((prev) => ({
              ...prev,
              slot_duration_min: Number(event.target.value) || prev.slot_duration_min,
            }))
          }
        />
      </div>

      <button type="submit" className="schedule-settings-form__save" disabled={saving}>
        {saving ? "Сохранение…" : "Сохранить"}
      </button>
    </form>
  );
}
