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
