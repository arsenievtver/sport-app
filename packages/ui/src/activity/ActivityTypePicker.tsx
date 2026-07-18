import { useCallback, useMemo } from "react";
import type { ActivityType } from "@sport-app/shared";
import {
  CUSTOM_WORKOUT_MAJOR_HEADING,
  RECENT_ACTIVITY_TYPES_LABEL,
  activitySearchMatches,
  buildActivitySearchHaystack,
  groupActivityTypesByMajorHeading,
} from "@sport-app/shared";
import { SelectPicker, type SelectPickerGroup, type SelectPickerOption } from "../select/SelectPicker";

interface ActivityTypePickerProps {
  id?: string;
  activityTypes: ActivityType[];
  headingLabels?: Record<string, string>;
  recentActivityTypeIds?: string[];
  value: string;
  disabled?: boolean;
  emptyLabel?: string;
  triggerClassName?: string;
  /** Hide coach-owned composite workouts (constructor interval picker). */
  compendiumOnly?: boolean;
  searchable?: boolean;
  onChange: (activityTypeId: string) => void;
}

function formatActivityLabel(item: ActivityType): string {
  return `${item.name_ru || item.name_en} · MET ${item.met_value}`;
}

function toOption(item: ActivityType): SelectPickerOption {
  return {
    value: item.id,
    label: formatActivityLabel(item),
    searchText: buildActivitySearchHaystack(item),
  };
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
  compendiumOnly = false,
  searchable = true,
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
        compendiumOnly,
      }),
    [activityTypes, headingLabels, recentActivityTypeIdSet, compendiumOnly],
  );

  const groups = useMemo(() => {
    const result: SelectPickerGroup[] = [];

    if (!compendiumOnly && recentActivityTypes.length > 0) {
      result.push({
        id: "recent",
        label: RECENT_ACTIVITY_TYPES_LABEL,
        pinned: true,
        options: recentActivityTypes.map(toOption),
      });
    }

    for (const group of groupedActivityTypes) {
      result.push({
        id: group.heading || "__ungrouped__",
        label: group.label,
        pinned: group.heading === CUSTOM_WORKOUT_MAJOR_HEADING,
        options: group.items.map(toOption),
      });
    }

    return result;
  }, [recentActivityTypes, groupedActivityTypes, compendiumOnly]);

  const matchOption = useCallback((option: SelectPickerOption, query: string) => {
    return activitySearchMatches(`${option.label} ${option.searchText ?? ""}`, query);
  }, []);

  return (
    <SelectPicker
      id={id}
      value={value}
      groups={groups}
      disabled={disabled || activityTypes.length === 0}
      emptyLabel={emptyLabel}
      triggerClassName={triggerClassName}
      searchable={searchable}
      searchPlaceholder="Поиск: бег, boxing, йога…"
      searchRequireQueryAbove={20}
      matchOption={matchOption}
      onChange={onChange}
    />
  );
}
