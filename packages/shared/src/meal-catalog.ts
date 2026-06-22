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
