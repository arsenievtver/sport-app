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

export interface ActivityTypesList {
  items: ActivityType[];
  recent_ids: string[];
}

export const RECENT_ACTIVITY_TYPES_MAX = 6;
export const RECENT_ACTIVITY_TYPES_LABEL = "Недавние";

export interface ActivityType {
  id: string;
  compendium_code: string;
  name_ru: string;
  name_en: string;
  category: ActivityCategory;
  met_value: number;
  sort_order: number;
}
