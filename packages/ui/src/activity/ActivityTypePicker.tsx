import { useMemo } from "react";
import type { ActivityType } from "@sport-app/shared";
import {
  RECENT_ACTIVITY_TYPES_LABEL,
  groupActivityTypesByMajorHeading,
} from "@sport-app/shared";
import { SelectPicker, type SelectPickerGroup } from "../select/SelectPicker";

interface ActivityTypePickerProps {
  id?: string;
  activityTypes: ActivityType[];
  headingLabels?: Record<string, string>;
  recentActivityTypeIds?: string[];
  value: string;
  disabled?: boolean;
  emptyLabel?: string;
  triggerClassName?: string;
  onChange: (activityTypeId: string) => void;
}

function formatActivityLabel(item: ActivityType): string {
  return `${item.name_ru} · MET ${item.met_value}`;
}

export function ActivityTypePicker({
  id,
  activityTypes,
  headingLabels = {},
  recentActivityTypeIds = [],
  value,
  disabled = false,
  emptyLabel = "Выберите вид",
  triggerClassName = "select-picker__trigger",
  onChange,
}: ActivityTypePickerProps) {
  const recentActivityTypes = useMemo(
    () =>
      recentActivityTypeIds
        .map((activityId) => activityTypes.find((item) => item.id === activityId))
        .filter((item): item is ActivityType => item != null),
    [activityTypes, recentActivityTypeIds],
  );

  const recentActivityTypeIdSet = useMemo(
    () => new Set(recentActivityTypes.map((item) => item.id)),
    [recentActivityTypes],
  );

  const groupedActivityTypes = useMemo(
    () =>
      groupActivityTypesByMajorHeading(activityTypes, headingLabels, {
        excludeIds: recentActivityTypeIdSet,
      }),
    [activityTypes, headingLabels, recentActivityTypeIdSet],
  );

  const groups = useMemo(() => {
    const result: SelectPickerGroup[] = [];

    if (recentActivityTypes.length > 0) {
      result.push({
        id: "recent",
        label: RECENT_ACTIVITY_TYPES_LABEL,
        options: recentActivityTypes.map((item) => ({
          value: item.id,
          label: formatActivityLabel(item),
        })),
      });
    }

    for (const group of groupedActivityTypes) {
      result.push({
        id: group.heading || "__ungrouped__",
        label: group.label,
        options: group.items.map((item) => ({
          value: item.id,
          label: formatActivityLabel(item),
        })),
      });
    }

    return result;
  }, [recentActivityTypes, groupedActivityTypes]);

  return (
    <SelectPicker
      id={id}
      value={value}
      groups={groups}
      disabled={disabled || activityTypes.length === 0}
      emptyLabel={emptyLabel}
      triggerClassName={triggerClassName}
      onChange={onChange}
    />
  );
}
