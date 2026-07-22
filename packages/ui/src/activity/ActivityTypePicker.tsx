import { useCallback, useMemo } from "react";
import type { ActivityType } from "@sport-app/shared";
import {
  CUSTOM_WORKOUT_HEADING_LABEL,
  CUSTOM_WORKOUT_MAJOR_HEADING,
  PICKER_ALLOWED_MAJOR_HEADINGS,
  RECENT_ACTIVITY_TYPES_LABEL,
  SUGGESTED_ACTIVITY_TYPES_LABEL,
  activitySearchMatches,
  buildActivitySearchHaystack,
  filterActivityTypesForPicker,
  groupActivityTypesByMajorHeading,
  isCustomWorkoutActivity,
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
  const catalog = useMemo(() => filterActivityTypesForPicker(activityTypes), [activityTypes]);

  const customWorkouts = useMemo(
    () =>
      catalog
        .filter((item) => !compendiumOnly && isCustomWorkoutActivity(item))
        .slice()
        .sort((a, b) => (a.name_ru || a.name_en).localeCompare(b.name_ru || b.name_en, "ru")),
    [catalog, compendiumOnly],
  );

  const recentActivityTypes = useMemo(
    () =>
      recentActivityTypeIds
        .map((activityId) => catalog.find((item) => item.id === activityId))
        .filter((item): item is ActivityType => item != null),
    [catalog, recentActivityTypeIds],
  );

  const suggestedActivityTypes = useMemo(() => {
    // Constructor has no recent/custom pins — seed a short list so the dropdown is usable.
    if (!compendiumOnly && recentActivityTypes.length > 0) return [];
    return pickSuggestedActivityTypes(catalog);
  }, [catalog, compendiumOnly, recentActivityTypes.length]);

  const excludeIds = useMemo(() => {
    const ids = new Set(recentActivityTypes.map((item) => item.id));
    for (const item of suggestedActivityTypes) {
      ids.add(item.id);
    }
    for (const item of customWorkouts) {
      ids.add(item.id);
    }
    return ids;
  }, [recentActivityTypes, suggestedActivityTypes, customWorkouts]);

  const groupedActivityTypes = useMemo(
    () =>
      groupActivityTypesByMajorHeading(catalog, headingLabels, {
        excludeIds,
        compendiumOnly,
        allowedHeadings: PICKER_ALLOWED_MAJOR_HEADINGS,
      }),
    [catalog, headingLabels, excludeIds, compendiumOnly],
  );

  const groups = useMemo(() => {
    const result: SelectPickerGroup[] = [];

    // Coach-composed workouts first when assigning (schedule / home complete).
    if (customWorkouts.length > 0) {
      result.push({
        id: CUSTOM_WORKOUT_MAJOR_HEADING,
        label: headingLabels[CUSTOM_WORKOUT_MAJOR_HEADING] ?? CUSTOM_WORKOUT_HEADING_LABEL,
        pinned: true,
        options: customWorkouts.map(toOption),
      });
    }

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
      if (group.heading === CUSTOM_WORKOUT_MAJOR_HEADING) continue;
      result.push({
        id: group.heading || "__ungrouped__",
        label: group.label,
        pinned: false,
        options: group.items.map(toOption),
      });
    }

    return result;
  }, [
    customWorkouts,
    recentActivityTypes,
    suggestedActivityTypes,
    groupedActivityTypes,
    compendiumOnly,
    headingLabels,
  ]);

  const matchOption = useCallback((option: SelectPickerOption, query: string) => {
    return activitySearchMatches(`${option.label} ${option.searchText ?? ""}`, query);
  }, []);

  return (
    <SelectPicker
      id={id}
      value={value}
      groups={groups}
      disabled={disabled || catalog.length === 0}
      emptyLabel={emptyLabel}
      triggerClassName={triggerClassName}
      searchable={searchable}
      searchPlaceholder="Поиск: бег, велосипед, плавание…"
      searchRequireQueryAbove={20}
      maxVisibleOptions={36}
      matchOption={matchOption}
      onChange={onChange}
    />
  );
}
