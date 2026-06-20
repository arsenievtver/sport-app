import { useMemo } from "react";
import type { ActivityCategory, ActivityType } from "@sport-app/shared";
import { ACTIVITY_CATEGORY_LABELS } from "@sport-app/shared";

interface ScheduleActivityTypeFieldProps {
  activityTypes: ActivityType[];
  value: string;
  disabled?: boolean;
  onChange: (activityTypeId: string) => void;
}

export function ScheduleActivityTypeField({
  activityTypes,
  value,
  disabled = false,
  onChange,
}: ScheduleActivityTypeFieldProps) {
  const groupedActivityTypes = useMemo(() => {
    const groups = new Map<ActivityCategory, ActivityType[]>();
    for (const item of activityTypes) {
      const bucket = groups.get(item.category) ?? [];
      bucket.push(item);
      groups.set(item.category, bucket);
    }
    return [...groups.entries()].sort(([left], [right]) =>
      ACTIVITY_CATEGORY_LABELS[left].localeCompare(ACTIVITY_CATEGORY_LABELS[right], "ru"),
    );
  }, [activityTypes]);

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
        {groupedActivityTypes.map(([category, items]) => (
          <optgroup key={category} label={ACTIVITY_CATEGORY_LABELS[category]}>
            {items.map((item) => (
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
