export type ActivityCompendiumJobStatus = "idle" | "running" | "failed" | "completed";
export type ActivityCompendiumJobType = "none" | "import" | "translate" | "full";

export interface ActivityCompendiumJobState {
  status: ActivityCompendiumJobStatus;
  job_type: ActivityCompendiumJobType;
  phase: string;
  current: number;
  total: number;
  message: string;
  error?: string | null;
  started_at?: string | null;
  finished_at?: string | null;
}

export interface ActivityCompendiumStats {
  activity_count: number;
  translated_count: number;
  untranslated_count: number;
  imported_at?: string | null;
  translator_enabled: boolean;
  major_headings: string[];
}

export interface AdminActivityCompendiumStatus extends ActivityCompendiumStats {
  job: ActivityCompendiumJobState;
}

export interface AdminActivityCompendiumItem {
  id: string;
  compendium_code: string;
  name_en: string;
  name_ru: string;
  major_heading?: string | null;
  met_value: number;
  is_active: boolean;
  updated_at: string;
}

export interface AdminActivityCompendiumList {
  items: AdminActivityCompendiumItem[];
  total: number;
  page: number;
  page_size: number;
}

export interface AdminActivityCompendiumItemUpdatePayload {
  name_ru?: string | null;
  is_active?: boolean | null;
}

export type ActivityCompendiumSortField =
  | "compendium_code"
  | "major_heading"
  | "name_en"
  | "name_ru"
  | "met_value"
  | "is_active"
  | "updated_at";

export type ActivityCompendiumSortDir = "asc" | "desc";

export const ACTIVITY_COMPENDIUM_DEFAULT_SORT_BY: ActivityCompendiumSortField = "major_heading";
export const ACTIVITY_COMPENDIUM_DEFAULT_SORT_DIR: ActivityCompendiumSortDir = "asc";

export function activityCompendiumSortIndicator(
  field: ActivityCompendiumSortField,
  activeField: ActivityCompendiumSortField,
  direction: ActivityCompendiumSortDir,
): string {
  if (field !== activeField) return "";
  return direction === "asc" ? " ↑" : " ↓";
}

export const ACTIVITY_COMPENDIUM_PAGE_SIZE = 100;

export const ACTIVITY_MAJOR_HEADING_LABELS: Record<string, string> = {
  Bicycling: "Велосипед",
  "Conditioning Exercise": "Оздоровительные упражнения",
  Dancing: "Танцы",
  "Fishing & Hunting": "Рыбалка и охота",
  "Home Activities": "Домашние дела",
  "Home Repair": "Ремонт дома",
  Inactivity: "Бездействие",
  "Lawn & Garden": "Газон и сад",
  Miscellaneous: "Разное",
  "Music Playing": "Игра на инструментах",
  Occupation: "Профессиональная деятельность",
  "Religious Activities": "Религиозная деятельность",
  Running: "Бег",
  "Self Care": "Уход за собой",
  "Sexual Activity": "Сексуальная активность",
  Sports: "Спорт",
  Transportation: "Транспорт",
  "Video Games": "Видеоигры",
  "Volunteer Activities": "Волонтёрство",
  Walking: "Ходьба",
  "Water Activities": "Водные активности",
  "Winter Activities": "Зимние активности",
};

export function formatActivityMajorHeading(heading?: string | null): string {
  if (!heading) return "—";
  return ACTIVITY_MAJOR_HEADING_LABELS[heading] ?? heading;
}

export function formatActivityCompendiumImportedAt(isoDateTime?: string | null): string {
  if (!isoDateTime) return "ещё не загружался";
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

export function activityCompendiumJobProgressPercent(job: ActivityCompendiumJobState): number {
  if (job.total <= 0) return job.status === "completed" ? 100 : 0;
  return Math.min(100, Math.round((job.current / job.total) * 100));
}

export function formatMetValue(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1).replace(".", ",");
}
