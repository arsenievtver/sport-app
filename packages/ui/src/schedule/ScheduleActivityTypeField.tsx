import { useMemo } from "react";
import type { ActivityType } from "@sport-app/shared";
import { groupActivityTypesByMajorHeading } from "@sport-app/shared";

interface ScheduleActivityTypeFieldProps {
  activityTypes: ActivityType[];
  headingLabels?: Record<string, string>;
  value: string;
  disabled?: boolean;
  onChange: (activityTypeId: string) => void;
}

export function ScheduleActivityTypeField({
  activityTypes,
  headingLabels = {},
  value,
  disabled = false,
  onChange,
}: ScheduleActivityTypeFieldProps) {
  const groupedActivityTypes = useMemo(
    () => groupActivityTypesByMajorHeading(activityTypes, headingLabels),
    [activityTypes, headingLabels],
  );

  return (
    <label className="schedule-sheet__field">
      <span className="schedule-sheet__field-label text-secondary">Вид тренировки</span>
      <select
        className="schedule-sheet__select"
        value={value}
        disabled={disabled || activityTypes.length === 0}
        onChange={(event) => onChange(event.target.value)}
      >
        {activityTypes.length === 0 ? (
          <option value="">Нет видов тренировок</option>
        ) : null}
        {groupedActivityTypes.map((group) => (
          <optgroup key={group.heading || "__ungrouped__"} label={group.label}>
            {group.items.map((item) => (
              <option key={item.id} value={item.id} title={item.name_en}>
                {item.name_ru} · MET {item.met_value}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
    </label>
  );
}
