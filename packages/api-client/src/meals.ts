import type {
  AthleteMealCreatePayload,
  AthleteMealEntry,
  AthleteMealList,
  MealAnalysisResult,
} from "@sport-app/shared";

import { authenticatedFetchOk } from "./auth";

export async function fetchAthleteMeals(limit = 30): Promise<AthleteMealList> {
  const res = await authenticatedFetchOk(`/athlete/meals?limit=${limit}`);
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

export async function fetchLastMealAnalyzeDebug(): Promise<Record<string, unknown>> {
  const res = await authenticatedFetchOk("/athlete/meals/debug/last");
  return res.json() as Promise<Record<string, unknown>>;
}

export async function downloadLastMealAnalyzeDebug(): Promise<void> {
  const data = await fetchLastMealAnalyzeDebug();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `logmeal-debug-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export async function createAthleteMealEntry(payload: AthleteMealCreatePayload): Promise<AthleteMealEntry> {
  const res = await authenticatedFetchOk("/athlete/meals", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return res.json() as Promise<AthleteMealEntry>;
}
