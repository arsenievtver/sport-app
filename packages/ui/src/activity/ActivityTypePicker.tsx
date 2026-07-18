import { useCallback, useMemo } from "react";
import type { ActivityType } from "@sport-app/shared";
import {
  CUSTOM_WORKOUT_MAJOR_HEADING,
  RECENT_ACTIVITY_TYPES_LABEL,
  SUGGESTED_ACTIVITY_TYPES_LABEL,
  activitySearchMatches,
  buildActivitySearchHaystack,
  groupActivityTypesByMajorHeading,
  pickSuggestedActivityTypes,
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

  const suggestedActivityTypes = useMemo(() => {
    // Constructor has no recent/custom pins — seed a short list so the dropdown is usable.
    if (!compendiumOnly && recentActivityTypes.length > 0) return [];
    return pickSuggestedActivityTypes(activityTypes);
  }, [activityTypes, compendiumOnly, recentActivityTypes.length]);

  const excludeIds = useMemo(() => {
    const ids = new Set(recentActivityTypes.map((item) => item.id));
    for (const item of suggestedActivityTypes) {
      ids.add(item.id);
    }
    return ids;
  }, [recentActivityTypes, suggestedActivityTypes]);

  const groupedActivityTypes = useMemo(
    () =>
      groupActivityTypesByMajorHeading(activityTypes, headingLabels, {
        excludeIds,
        compendiumOnly,
      }),
    [activityTypes, headingLabels, excludeIds, compendiumOnly],
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

    if (suggestedActivityTypes.length > 0) {
      result.push({
        id: "suggested",
        label: SUGGESTED_ACTIVITY_TYPES_LABEL,
        pinned: true,
        options: suggestedActivityTypes.map(toOption),
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
  }, [recentActivityTypes, suggestedActivityTypes, groupedActivityTypes, compendiumOnly]);

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
      maxVisibleOptions={40}
      matchOption={matchOption}
      onChange={onChange}
    />
  );
}
