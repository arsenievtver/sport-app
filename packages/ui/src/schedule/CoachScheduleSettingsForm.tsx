import { useState } from "react";
import type { CoachScheduleSettings } from "@sport-app/shared";
import { WEEKDAY_OPTIONS } from "@sport-app/shared";
import { NativeTemporalInput } from "../native-temporal/NativeTemporalInput";

interface CoachScheduleSettingsFormProps {
  settings: CoachScheduleSettings;
  saving?: boolean;
  onSave: (settings: CoachScheduleSettings) => void;
}

function TimeRangeRow({
  start,
  end,
  onStartChange,
  onEndChange,
}: {
  start: string;
  end: string;
  onStartChange: (value: string) => void;
  onEndChange: (value: string) => void;
}) {
  return (
    <div className="schedule-settings-form__time-row">
      <label className="schedule-settings-form__time-pair">
        <span className="schedule-settings-form__time-label">С</span>
        <NativeTemporalInput
          type="time"
          wrapperClassName="native-temporal--schedule"
          value={start}
          onChange={(event) => onStartChange(event.target.value)}
        />
      </label>
      <label className="schedule-settings-form__time-pair">
        <span className="schedule-settings-form__time-label">До</span>
        <NativeTemporalInput
          type="time"
          wrapperClassName="native-temporal--schedule"
          value={end}
          onChange={(event) => onEndChange(event.target.value)}
        />
      </label>
    </div>
  );
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
        <TimeRangeRow
          start={draft.slot_start}
          end={draft.slot_end}
          onStartChange={(slot_start) => setDraft((prev) => ({ ...prev, slot_start }))}
          onEndChange={(slot_end) => setDraft((prev) => ({ ...prev, slot_end }))}
        />
      </div>

      <div className="schedule-settings-form__row">
        <span className="schedule-settings-form__label">Обед (необязательно)</span>
        <TimeRangeRow
          start={draft.lunch_start ?? ""}
          end={draft.lunch_end ?? ""}
          onStartChange={(lunch_start) =>
            setDraft((prev) => ({
              ...prev,
              lunch_start: lunch_start || null,
              lunch_end: lunch_start ? prev.lunch_end : null,
            }))
          }
          onEndChange={(lunch_end) =>
            setDraft((prev) => ({
              ...prev,
              lunch_end: lunch_end || null,
            }))
          }
        />
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
