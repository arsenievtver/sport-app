import { formatActivityMajorHeading } from "./activity-compendium";

export type ActivityCategory =
  | "cardio"
  | "strength"
  | "flexibility"
  | "team_sport"
  | "combat"
  | "other";

export const ACTIVITY_CATEGORY_LABELS: Record<ActivityCategory, string> = {
  cardio: "Кардио",
  strength: "Силовые",
  flexibility: "Гибкость и баланс",
  team_sport: "Игровые виды",
  combat: "Единоборства",
  other: "Другое",
};

export interface ActivityType {
  id: string;
  compendium_code: string;
  name_ru: string;
  name_en: string;
  major_heading?: string | null;
  category: ActivityCategory;
  met_value: number;
  sort_order: number;
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

export function groupActivityTypesByMajorHeading(
  items: ActivityType[],
  labels: Record<string, string> = {},
  options?: { excludeIds?: Iterable<string> },
): ActivityTypeMajorHeadingGroup[] {
  const excludeIds = new Set(options?.excludeIds ?? []);
  const groups = new Map<string, ActivityType[]>();

  for (const item of items) {
    if (excludeIds.has(item.id)) {
      continue;
    }
    const heading = item.major_heading?.trim() ?? "";
    const bucket = groups.get(heading) ?? [];
    bucket.push(item);
    groups.set(heading, bucket);
  }

  return [...groups.entries()]
    .sort(([left], [right]) =>
      formatActivityMajorHeading(left || null, labels).localeCompare(
        formatActivityMajorHeading(right || null, labels),
        "ru",
      ),
    )
    .map(([heading, groupItems]) => ({
      heading,
      label: formatActivityMajorHeading(heading || null, labels),
      items: groupItems,
    }));
}
