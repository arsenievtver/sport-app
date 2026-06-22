export type MealSource = "manual" | "ai";

export const MEAL_HISTORY_DAYS = 30;

/** Playful status lines while LogMeal + translation run (shown in rotation). */
export const MEAL_ANALYSIS_LOADING_MESSAGES = [
  "Смотрим на ваше фото…",
  "Ищем на нём что-нибудь съедобное…",
  "Отделяем тарелку от фона…",
  "Разбираем блюдо на компоненты…",
  "Считаем калории — весы пока в отпуске…",
  "Взвешиваем белки, жиры и углеводы…",
  "Сверяем с базой блюд…",
  "Переводим названия на русский…",
  "Почти готово — уточняем порции…",
] as const;

export const MEAL_ANALYSIS_LOADING_INTERVAL_MS = 2800;

export interface MealDishCandidate {
  logmeal_dish_id: number;
  name: string;
  name_en?: string | null;
  confidence?: number | null;
}

export interface MealDishPreview {
  name: string;
  name_en?: string | null;
  logmeal_dish_id?: number | null;
  food_item_position?: number | string | null;
  confidence?: number | null;
  candidates?: MealDishCandidate[];
  weight_g?: number | null;
  calories_kcal?: number | null;
  protein_g?: number | null;
  carbs_g?: number | null;
  fat_g?: number | null;
}

export interface MealDishSearchItem {
  logmeal_dish_id: number;
  name: string;
  name_en: string;
  portion_size_g?: number | null;
  dish_type: string;
}

export interface MealDishSearchResult {
  items: MealDishSearchItem[];
  catalog_synced_at?: string | null;
  catalog_dish_count?: number;
}

export interface MealConfirmItem {
  food_item_position: number | string;
  logmeal_dish_id: number;
}

export interface MealConfirmPayload {
  logmeal_image_id: number;
  segmentation: Record<string, unknown>;
  items: MealConfirmItem[];
}

export interface MealDishEditorRow {
  key: string;
  name: string;
  name_en?: string | null;
  logmeal_dish_id?: number | null;
  food_item_position?: number | string | null;
  candidates?: MealDishCandidate[];
  weightInput: string;
  baseline: MealNutritionBaseline;
}

export interface MealNutritionBaseline {
  weight_g: number;
  calories_kcal: number;
  protein_g?: number | null;
  carbs_g?: number | null;
  fat_g?: number | null;
}

export interface MealAnalysisResult {
  logmeal_image_id?: number | null;
  title: string;
  calories_kcal: number;
  weight_g?: number | null;
  weight_is_estimated?: boolean;
  protein_g?: number | null;
  carbs_g?: number | null;
  fat_g?: number | null;
  logmeal_raw_calories_kcal?: number | null;
  baseline_weight_g?: number | null;
  baseline_calories_kcal?: number | null;
  baseline_protein_g?: number | null;
  baseline_carbs_g?: number | null;
  baseline_fat_g?: number | null;
  calories_derived_from_weight?: boolean;
  dishes: MealDishPreview[];
  summary: string;
  portion_note?: string | null;
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

function roundMealMacro(value: number): number {
  return Math.round(value * 10) / 10;
}

export function mealAnalysisBaseline(analysis: MealAnalysisResult): MealNutritionBaseline | null {
  if (analysis.baseline_weight_g == null || analysis.baseline_weight_g <= 0) {
    return null;
  }
  return {
    weight_g: analysis.baseline_weight_g,
    calories_kcal: analysis.baseline_calories_kcal ?? analysis.calories_kcal,
    protein_g: analysis.baseline_protein_g ?? analysis.protein_g,
    carbs_g: analysis.baseline_carbs_g ?? analysis.carbs_g,
    fat_g: analysis.baseline_fat_g ?? analysis.fat_g,
  };
}

export function scaleMealNutritionByWeight(
  baseline: MealNutritionBaseline,
  weightG: number,
): MealNutritionBaseline {
  if (weightG <= 0 || baseline.weight_g <= 0) {
    return baseline;
  }
  const ratio = weightG / baseline.weight_g;
  return {
    weight_g: weightG,
    calories_kcal: Math.max(0, Math.round(baseline.calories_kcal * ratio)),
    protein_g: baseline.protein_g != null ? roundMealMacro(baseline.protein_g * ratio) : null,
    carbs_g: baseline.carbs_g != null ? roundMealMacro(baseline.carbs_g * ratio) : null,
    fat_g: baseline.fat_g != null ? roundMealMacro(baseline.fat_g * ratio) : null,
  };
}

export function formatMealMacroInput(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "";
  return Number.isInteger(value) ? String(value) : value.toFixed(1).replace(".", ",");
}

export function formatMealWeightInput(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "";
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1).replace(".", ",");
}

export const MEAL_DISH_FALLBACK_WEIGHT_G = 100;

export function mealDishEditorRowFromPreview(dish: MealDishPreview, index: number): MealDishEditorRow | null {
  const name = dish.name?.trim();
  if (!name) return null;

  const weight_g =
    dish.weight_g != null && dish.weight_g > 0 ? dish.weight_g : MEAL_DISH_FALLBACK_WEIGHT_G;
  const calories_kcal = dish.calories_kcal != null ? Math.max(0, dish.calories_kcal) : 0;

  return {
    key: `${dish.logmeal_dish_id ?? name}-${index}`,
    name,
    name_en: dish.name_en ?? dish.name,
    logmeal_dish_id: dish.logmeal_dish_id ?? null,
    food_item_position: dish.food_item_position ?? null,
    candidates: dish.candidates ?? [],
    weightInput: formatMealWeightInput(weight_g),
    baseline: {
      weight_g,
      calories_kcal,
      protein_g: dish.protein_g,
      carbs_g: dish.carbs_g,
      fat_g: dish.fat_g,
    },
  };
}

export function mealDishEditorRowsFromAnalysis(dishes: MealDishPreview[]): MealDishEditorRow[] {
  return dishes
    .map((dish, index) => mealDishEditorRowFromPreview(dish, index))
    .filter((row): row is MealDishEditorRow => row != null);
}

export function mealDishRowNutrition(row: MealDishEditorRow): MealNutritionBaseline | null {
  const weight = parseMealNumberInput(row.weightInput);
  if (weight == null || weight <= 0 || row.baseline.weight_g <= 0) {
    return null;
  }
  return scaleMealNutritionByWeight(row.baseline, weight);
}

export function sumMealDishRows(rows: MealDishEditorRow[]): MealNutritionBaseline {
  let calories = 0;
  let weight = 0;
  let protein = 0;
  let carbs = 0;
  let fat = 0;
  let hasProtein = false;
  let hasCarbs = false;
  let hasFat = false;

  for (const row of rows) {
    const nutrition = mealDishRowNutrition(row);
    if (!nutrition) continue;
    calories += nutrition.calories_kcal;
    weight += nutrition.weight_g;
    if (nutrition.protein_g != null) {
      protein += nutrition.protein_g;
      hasProtein = true;
    }
    if (nutrition.carbs_g != null) {
      carbs += nutrition.carbs_g;
      hasCarbs = true;
    }
    if (nutrition.fat_g != null) {
      fat += nutrition.fat_g;
      hasFat = true;
    }
  }

  return {
    weight_g: Math.round(weight * 10) / 10,
    calories_kcal: Math.max(0, Math.round(calories)),
    protein_g: hasProtein ? roundMealMacro(protein) : null,
    carbs_g: hasCarbs ? roundMealMacro(carbs) : null,
    fat_g: hasFat ? roundMealMacro(fat) : null,
  };
}

export function mealNutritionToFormInputs(nutrition: MealNutritionBaseline): {
  caloriesInput: string;
  weightInput: string;
  proteinInput: string;
  carbsInput: string;
  fatInput: string;
} {
  return {
    caloriesInput: String(nutrition.calories_kcal),
    weightInput: formatMealWeightInput(nutrition.weight_g),
    proteinInput: formatMealMacroInput(nutrition.protein_g),
    carbsInput: formatMealMacroInput(nutrition.carbs_g),
    fatInput: formatMealMacroInput(nutrition.fat_g),
  };
}

export function mealConfirmItemsFromRows(rows: MealDishEditorRow[]): MealConfirmItem[] {
  return rows
    .filter(
      (row): row is MealDishEditorRow & { logmeal_dish_id: number; food_item_position: number | string } =>
        row.logmeal_dish_id != null && row.food_item_position != null,
    )
    .map((row) => ({
      food_item_position: row.food_item_position,
      logmeal_dish_id: row.logmeal_dish_id,
    }));
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
