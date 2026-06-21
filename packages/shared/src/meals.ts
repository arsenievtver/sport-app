export type MealSource = "manual" | "ai";

export interface MealDishPreview {
  name: string;
  confidence?: number | null;
}

export interface MealAnalysisResult {
  logmeal_image_id?: number | null;
  title: string;
  calories_kcal: number;
  weight_g?: number | null;
  protein_g?: number | null;
  carbs_g?: number | null;
  fat_g?: number | null;
  dishes: MealDishPreview[];
  summary: string;
  raw: Record<string, unknown>;
}

export interface AthleteMealEntry {
  id: string;
  entry_at: string;
  calories_kcal: number;
  title?: string | null;
  weight_g?: number | null;
  protein_g?: number | null;
  carbs_g?: number | null;
  fat_g?: number | null;
  source: MealSource;
  logmeal_image_id?: number | null;
  ai_analysis?: Record<string, unknown> | null;
  notes?: string | null;
}

export interface AthleteMealList {
  entries: AthleteMealEntry[];
}

export interface AthleteMealCreatePayload {
  entry_at?: string;
  title?: string | null;
  calories_kcal: number;
  weight_g?: number | null;
  protein_g?: number | null;
  carbs_g?: number | null;
  fat_g?: number | null;
  source?: MealSource;
  logmeal_image_id?: number | null;
  ai_analysis?: Record<string, unknown> | null;
  notes?: string | null;
}

export function formatMealCalories(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  return `${Math.round(value)}`;
}

export function formatMealDateTime(isoDateTime: string): string {
  const date = new Date(isoDateTime);
  if (Number.isNaN(date.getTime())) return isoDateTime;
  return date.toLocaleString("ru-RU", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function parseMealNumberInput(raw: string): number | null {
  const trimmed = raw.trim().replace(",", ".");
  if (!trimmed) return null;
  const value = Number(trimmed);
  if (!Number.isFinite(value)) return null;
  return value;
}

export function isValidMealCalories(value: number): boolean {
  return value >= 0 && value <= 10000;
}

export async function compressMealPhoto(file: File, maxSide = 1280, quality = 0.82): Promise<Blob> {
  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Не удалось прочитать фото"));
      img.src = objectUrl;
    });

    const longest = Math.max(image.width, image.height);
    const scale = longest > maxSide ? maxSide / longest : 1;
    const width = Math.max(1, Math.round(image.width * scale));
    const height = Math.max(1, Math.round(image.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Canvas unavailable");
    }
    ctx.drawImage(image, 0, 0, width, height);

    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error("Не удалось сжать фото"));
            return;
          }
          resolve(blob);
        },
        "image/jpeg",
        quality,
      );
    });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
