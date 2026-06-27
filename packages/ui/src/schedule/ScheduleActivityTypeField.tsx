import { ActivityTypePicker } from "../activity/ActivityTypePicker";
import type { ActivityType } from "@sport-app/shared";

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
  return (
    <label className="schedule-sheet__field">
      <span className="schedule-sheet__field-label text-secondary">Вид тренировки</span>
      <ActivityTypePicker
        activityTypes={activityTypes}
        headingLabels={headingLabels}
        value={value}
        disabled={disabled}
        emptyLabel="Нет видов тренировок"
        triggerClassName="schedule-sheet__select select-picker__trigger"
        onChange={onChange}
      />
    </label>
  );
}
