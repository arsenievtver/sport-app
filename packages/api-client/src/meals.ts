import type {
  AthleteMealCreatePayload,
  AthleteMealEntry,
  AthleteMealList,
  MealAnalysisResult,
} from "@sport-app/shared";

import { authenticatedFetchOk } from "./auth";

export async function fetchAthleteMeals(options?: {
  days?: number;
  limit?: number;
}): Promise<AthleteMealList> {
  const days = options?.days ?? 30;
  const limit = options?.limit ?? 200;
  const res = await authenticatedFetchOk(`/athlete/meals?days=${days}&limit=${limit}`);
  return res.json() as Promise<AthleteMealList>;
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

export async function createAthleteMealEntry(payload: AthleteMealCreatePayload): Promise<AthleteMealEntry> {
  const res = await authenticatedFetchOk("/athlete/meals", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return res.json() as Promise<AthleteMealEntry>;
}
