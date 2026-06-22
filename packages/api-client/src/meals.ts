import type {
  MealAnalysisResult,
  MealConfirmPayload,
  MealDishPreview,
  MealDishSearchResult,
} from "@sport-app/shared";

import { authenticatedFetchOk } from "./auth";

export async function fetchAthleteMeals(options?: {
  days?: number;
  limit?: number;
}): Promise<import("@sport-app/shared").AthleteMealList> {
  const days = options?.days ?? 30;
  const limit = options?.limit ?? 200;
  const res = await authenticatedFetchOk(`/athlete/meals?days=${days}&limit=${limit}`);
  return res.json() as Promise<import("@sport-app/shared").AthleteMealList>;
}

export async function analyzeAthleteMealPhoto(file: Blob): Promise<MealAnalysisResult> {
  const formData = new FormData();
  formData.append("file", file, "meal.jpg");
  const res = await authenticatedFetchOk("/athlete/meals/analyze", {
    method: "POST",
    body: formData,
  });
  return res.json() as Promise<MealAnalysisResult>;
}

export async function searchAthleteMealDishes(query: string, limit = 20): Promise<MealDishSearchResult> {
  const params = new URLSearchParams({ q: query, limit: String(limit) });
  const res = await authenticatedFetchOk(`/athlete/meals/dishes/search?${params}`);
  return res.json() as Promise<MealDishSearchResult>;
}

export async function fetchAthleteMealDishNutrition(logmealDishId: number): Promise<MealDishPreview> {
  const res = await authenticatedFetchOk(`/athlete/meals/dishes/${logmealDishId}/nutrition`);
  return res.json() as Promise<MealDishPreview>;
}

export async function confirmAthleteMealDishes(payload: MealConfirmPayload): Promise<MealAnalysisResult> {
  const res = await authenticatedFetchOk("/athlete/meals/confirm", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return res.json() as Promise<MealAnalysisResult>;
}

export async function createAthleteMealEntry(
  payload: import("@sport-app/shared").AthleteMealCreatePayload,
): Promise<import("@sport-app/shared").AthleteMealEntry> {
  const res = await authenticatedFetchOk("/athlete/meals", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return res.json() as Promise<import("@sport-app/shared").AthleteMealEntry>;
}

export async function fetchAthleteMealCatalogStats(): Promise<
  import("@sport-app/shared").MealCatalogStats
> {
  const res = await authenticatedFetchOk("/athlete/meals/catalog/stats");
  return res.json() as Promise<import("@sport-app/shared").MealCatalogStats>;
}
