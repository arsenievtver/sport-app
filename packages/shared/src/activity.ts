import { formatActivityMajorHeading } from "./activity-compendium";

export type ActivityCategory =
  | "cardio"
  | "strength"
  | "flexibility"
  | "team_sport"
  | "combat"
  | "other"
  | "custom";

export const ACTIVITY_CATEGORY_LABELS: Record<ActivityCategory, string> = {
  cardio: "Кардио",
  strength: "Силовые",
  flexibility: "Гибкость и баланс",
  team_sport: "Игровые виды",
  combat: "Единоборства",
  other: "Другое",
  custom: "Мои тренировки",
};

export const CUSTOM_WORKOUT_MAJOR_HEADING = "custom";
export const CUSTOM_WORKOUT_HEADING_LABEL = "Мои тренировки";

export interface ActivityType {
  id: string;
  compendium_code: string;
  name_ru: string;
  name_en: string;
  major_heading?: string | null;
  category: ActivityCategory;
  met_value: number;
  sort_order: number;
  owner_coach_id?: string | null;
}

export interface ActivityTypesList {
  items: ActivityType[];
  recent_ids: string[];
  major_heading_labels: Record<string, string>;
}

export const RECENT_ACTIVITY_TYPES_MAX = 6;
export const RECENT_ACTIVITY_TYPES_LABEL = "Недавние";

export interface ActivityTypeMajorHeadingGroup {
  heading: string;
  label: string;
  items: ActivityType[];
}

export function isCustomWorkoutActivity(item: ActivityType): boolean {
  return item.owner_coach_id != null || item.major_heading === CUSTOM_WORKOUT_MAJOR_HEADING;
}

export function groupActivityTypesByMajorHeading(
  items: ActivityType[],
  labels: Record<string, string> = {},
  options?: { excludeIds?: Iterable<string>; compendiumOnly?: boolean },
): ActivityTypeMajorHeadingGroup[] {
  const excludeIds = new Set(options?.excludeIds ?? []);
  const groups = new Map<string, ActivityType[]>();

  for (const item of items) {
    if (excludeIds.has(item.id)) {
      continue;
    }
    if (options?.compendiumOnly && isCustomWorkoutActivity(item)) {
      continue;
    }
    const heading = item.major_heading?.trim() ?? "";
    const bucket = groups.get(heading) ?? [];
    bucket.push(item);
    groups.set(heading, bucket);
  }

  return [...groups.entries()]
    .sort(([left], [right]) => {
      if (left === CUSTOM_WORKOUT_MAJOR_HEADING) return -1;
      if (right === CUSTOM_WORKOUT_MAJOR_HEADING) return 1;
      return formatActivityMajorHeading(left || null, labels).localeCompare(
        formatActivityMajorHeading(right || null, labels),
        "ru",
      );
    })
    .map(([heading, groupItems]) => ({
      heading,
      label:
        heading === CUSTOM_WORKOUT_MAJOR_HEADING
          ? labels[CUSTOM_WORKOUT_MAJOR_HEADING] ?? CUSTOM_WORKOUT_HEADING_LABEL
          : formatActivityMajorHeading(heading || null, labels),
      items: groupItems,
    }));
}

export interface CustomWorkoutIntervalInput {
  source_activity_type_id: string;
  duration_min: number;
  label?: string | null;
}

export interface CustomWorkoutUpsertPayload {
  name: string;
  intervals: CustomWorkoutIntervalInput[];
}

export interface CustomWorkoutInterval {
  id: string;
  source_activity_type_id: string;
  source_activity_name: string;
  source_met_value: number;
  duration_min: number;
  sort_order: number;
  label?: string | null;
  load_met_minutes: number;
}

export interface CustomWorkout {
  id: string;
  name: string;
  average_met: number;
  total_duration_min: number;
  total_load_met_minutes: number;
  intervals: CustomWorkoutInterval[];
  coach_id?: string | null;
  coach_name?: string | null;
}

/** Duration-weighted average MET from interval drafts (Compendium MET × minutes). */
export function calculateCustomWorkoutSummary(
  intervals: Array<{ met_value: number; duration_min: number }>,
): { average_met: number; total_duration_min: number; total_load_met_minutes: number } {
  const total_duration_min = intervals.reduce((sum, item) => sum + item.duration_min, 0);
  if (total_duration_min <= 0) {
    return { average_met: 0, total_duration_min: 0, total_load_met_minutes: 0 };
  }
  const total_load_met_minutes =
    Math.round(intervals.reduce((sum, item) => sum + item.met_value * item.duration_min, 0) * 10) / 10;
  const average_met = Math.round((total_load_met_minutes / total_duration_min) * 100) / 100;
  return { average_met, total_duration_min, total_load_met_minutes };
}

/** Common RU↔EN / colloquial aliases for activity typeahead (expanded into match tokens). */
const ACTIVITY_SEARCH_ALIASES: Record<string, string[]> = {
  бег: ["run", "running", "jog", "jogging"],
  бегать: ["run", "running", "jog"],
  ходьба: ["walk", "walking"],
  ходить: ["walk", "walking"],
  велосипед: ["bike", "bicycling", "cycling", "cycle"],
  вело: ["bike", "bicycling", "cycling"],
  плавание: ["swim", "swimming"],
  плавать: ["swim", "swimming"],
  силовая: ["resistance", "weight", "strength", "lifting"],
  сила: ["resistance", "weight", "strength"],
  растяжка: ["stretch", "stretching", "flexibility"],
  йога: ["yoga"],
  бокс: ["box", "boxing", "punch"],
  груша: ["punching", "bag", "boxing"],
  единоборства: ["martial", "combat", "fight"],
  танцы: ["dance", "dancing"],
  футбол: ["soccer", "football"],
  баскетбол: ["basketball"],
  теннис: ["tennis"],
  лыжи: ["ski", "skiing"],
  коньки: ["skate", "skating", "ice"],
  эллипс: ["elliptical"],
  гребля: ["row", "rowing"],
  скакалка: ["jump", "rope"],
  run: ["бег", "running"],
  walk: ["ходьба", "walking"],
  bike: ["велосипед", "cycling", "bicycling"],
  swim: ["плавание", "swimming"],
  yoga: ["йога"],
  boxing: ["бокс", "груша"],
};

export function normalizeActivitySearchText(value: string): string {
  return value
    .trim()
    .toLocaleLowerCase("ru-RU")
    .replace(/ё/g, "е")
    .replace(/[^\p{L}\p{N}\s.+-]/gu, " ")
    .replace(/\s+/g, " ");
}

export function buildActivitySearchHaystack(item: ActivityType): string {
  return normalizeActivitySearchText(
    [item.name_ru, item.name_en, item.compendium_code, String(item.met_value)].filter(Boolean).join(" "),
  );
}

/** True if haystack matches query: every query word hits haystack or an alias expansion. */
export function activitySearchMatches(haystack: string, query: string): boolean {
  const normalizedHaystack = normalizeActivitySearchText(haystack);
  const words = normalizeActivitySearchText(query).split(" ").filter(Boolean);
  if (words.length === 0) return true;
  return words.every((word) => {
    if (normalizedHaystack.includes(word)) return true;
    const aliases = ACTIVITY_SEARCH_ALIASES[word] ?? [];
    return aliases.some((alias) => normalizedHaystack.includes(normalizeActivitySearchText(alias)));
  });
}

export function filterActivityTypesBySearch(items: ActivityType[], query: string): ActivityType[] {
  const trimmed = query.trim();
  if (!trimmed) return items;
  return items.filter((item) => activitySearchMatches(buildActivitySearchHaystack(item), trimmed));
}
