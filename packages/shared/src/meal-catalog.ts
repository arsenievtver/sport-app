export type MealCatalogJobStatus = "idle" | "running" | "failed" | "completed";
export type MealCatalogJobType = "none" | "sync" | "translate" | "full";

export interface MealCatalogJobState {
  status: MealCatalogJobStatus;
  job_type: MealCatalogJobType;
  phase: string;
  current: number;
  total: number;
  message: string;
  error?: string | null;
  started_at?: string | null;
  finished_at?: string | null;
}

export interface MealCatalogStats {
  dish_count: number;
  translated_count: number;
  untranslated_count: number;
  synced_at?: string | null;
  search_ready: boolean;
  translator_enabled: boolean;
}

export interface AdminMealCatalogStatus extends MealCatalogStats {
  job: MealCatalogJobState;
}

export interface AdminMealCatalogDish {
  logmeal_id: number;
  name_en: string;
  name_ru?: string | null;
  portion_size_g?: number | null;
  dish_type: string;
  created_at: string;
  updated_at: string;
}

export interface AdminMealCatalogDishList {
  items: AdminMealCatalogDish[];
  total: number;
  page: number;
  page_size: number;
}

export interface AdminMealCatalogDishUpdatePayload {
  name_ru?: string | null;
  portion_size_g?: number | null;
}

export const MEAL_CATALOG_DISH_PAGE_SIZE = 100;

export const MEAL_CATALOG_DISH_TYPE_LABELS: Record<string, string> = {
  food: "Еда",
  drinks: "Напитки",
  combo: "Комбо",
  customRecipe: "Рецепт",
  ingredients: "Ингредиент",
  sauces: "Соус",
};

export function formatMealCatalogDishType(dishType: string): string {
  return MEAL_CATALOG_DISH_TYPE_LABELS[dishType] ?? dishType;
}

export function formatMealCatalogSyncedAt(isoDateTime?: string | null): string {
  if (!isoDateTime) return "ещё не обновлялся";
  const date = new Date(isoDateTime);
  if (Number.isNaN(date.getTime())) return isoDateTime;
  return date.toLocaleString("ru-RU", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function mealCatalogJobProgressPercent(job: MealCatalogJobState): number {
  if (job.total <= 0) return job.status === "completed" ? 100 : 0;
  return Math.min(100, Math.round((job.current / job.total) * 100));
}
