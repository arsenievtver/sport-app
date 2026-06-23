import type {
  AdminAthlete,
  AdminAthleteCreatePayload,
  AdminAthleteUpdatePayload,
  AdminCoach,
  AdminCoachCreatePayload,
  AdminCoachUpdatePayload,
} from "@sport-app/shared";

import { authenticatedFetchOk } from "./auth";

export async function fetchCoaches(): Promise<AdminCoach[]> {
  const res = await authenticatedFetchOk("/admin/coaches");
  return res.json() as Promise<AdminCoach[]>;
}

export async function createCoach(payload: AdminCoachCreatePayload): Promise<AdminCoach> {
  const res = await authenticatedFetchOk("/admin/coaches", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return res.json() as Promise<AdminCoach>;
}

export async function updateCoach(id: string, payload: AdminCoachUpdatePayload): Promise<AdminCoach> {
  const res = await authenticatedFetchOk(`/admin/coaches/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
  return res.json() as Promise<AdminCoach>;
}

export async function deleteCoach(id: string): Promise<void> {
  await authenticatedFetchOk(`/admin/coaches/${id}`, { method: "DELETE" });
}

export async function fetchAthletes(): Promise<AdminAthlete[]> {
  const res = await authenticatedFetchOk("/admin/athletes");
  return res.json() as Promise<AdminAthlete[]>;
}

export async function createAthlete(payload: AdminAthleteCreatePayload): Promise<AdminAthlete> {
  const res = await authenticatedFetchOk("/admin/athletes", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return res.json() as Promise<AdminAthlete>;
}

export async function updateAthlete(id: string, payload: AdminAthleteUpdatePayload): Promise<AdminAthlete> {
  const res = await authenticatedFetchOk(`/admin/athletes/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
  return res.json() as Promise<AdminAthlete>;
}

export async function deleteAthlete(id: string): Promise<void> {
  await authenticatedFetchOk(`/admin/athletes/${id}`, { method: "DELETE" });
}

export async function fetchAdminMealCatalogStatus(): Promise<
  import("@sport-app/shared").AdminMealCatalogStatus
> {
  const res = await authenticatedFetchOk("/admin/meal-catalog/status");
  return res.json() as Promise<import("@sport-app/shared").AdminMealCatalogStatus>;
}

export async function startAdminMealCatalogSync(): Promise<void> {
  await authenticatedFetchOk("/admin/meal-catalog/sync", { method: "POST" });
}

export async function startAdminMealCatalogTranslate(): Promise<void> {
  await authenticatedFetchOk("/admin/meal-catalog/translate", { method: "POST" });
}

export async function startAdminMealCatalogRefresh(): Promise<void> {
  await authenticatedFetchOk("/admin/meal-catalog/refresh", { method: "POST" });
}

export async function fetchAdminMealCatalogDishes(params?: {
  page?: number;
  pageSize?: number;
  q?: string;
}): Promise<import("@sport-app/shared").AdminMealCatalogDishList> {
  const search = new URLSearchParams();
  search.set("page", String(params?.page ?? 1));
  search.set("page_size", String(params?.pageSize ?? 100));
  if (params?.q?.trim()) {
    search.set("q", params.q.trim());
  }
  const res = await authenticatedFetchOk(`/admin/meal-catalog/dishes?${search.toString()}`);
  return res.json() as Promise<import("@sport-app/shared").AdminMealCatalogDishList>;
}

export async function updateAdminMealCatalogDish(
  logmealId: number,
  payload: import("@sport-app/shared").AdminMealCatalogDishUpdatePayload,
): Promise<import("@sport-app/shared").AdminMealCatalogDish> {
  const res = await authenticatedFetchOk(`/admin/meal-catalog/dishes/${logmealId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
  return res.json() as Promise<import("@sport-app/shared").AdminMealCatalogDish>;
}

export async function deleteAdminMealCatalogDish(logmealId: number): Promise<void> {
  await authenticatedFetchOk(`/admin/meal-catalog/dishes/${logmealId}`, { method: "DELETE" });
}
