import type {
  AdminAthlete,
  AdminAthleteCreatePayload,
  AdminAthleteUpdatePayload,
  AdminCoach,
  AdminCoachCreatePayload,
  AdminCoachUpdatePayload,
} from "@sport-app/shared";

import { getAccessToken } from "./auth";
import { getApiBaseUrl } from "./config";

async function parseError(res: Response): Promise<string> {
  try {
    const body = await res.json();
    if (typeof body.detail === "string") return body.detail;
    if (Array.isArray(body.detail) && body.detail[0]?.msg) {
      return body.detail.map((d: { msg: string }) => d.msg).join(", ");
    }
  } catch {
    /* ignore */
  }
  return `Ошибка ${res.status}`;
}

async function authFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const token = getAccessToken();
  if (!token) throw new Error("Не авторизован");

  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const res = await fetch(`${getApiBaseUrl()}${path}`, { ...init, headers });
  if (!res.ok) throw new Error(await parseError(res));
  return res;
}

export async function fetchCoaches(): Promise<AdminCoach[]> {
  const res = await authFetch("/admin/coaches");
  return res.json() as Promise<AdminCoach[]>;
}

export async function createCoach(payload: AdminCoachCreatePayload): Promise<AdminCoach> {
  const res = await authFetch("/admin/coaches", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return res.json() as Promise<AdminCoach>;
}

export async function updateCoach(id: string, payload: AdminCoachUpdatePayload): Promise<AdminCoach> {
  const res = await authFetch(`/admin/coaches/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
  return res.json() as Promise<AdminCoach>;
}

export async function deleteCoach(id: string): Promise<void> {
  await authFetch(`/admin/coaches/${id}`, { method: "DELETE" });
}

export async function fetchAthletes(): Promise<AdminAthlete[]> {
  const res = await authFetch("/admin/athletes");
  return res.json() as Promise<AdminAthlete[]>;
}

export async function createAthlete(payload: AdminAthleteCreatePayload): Promise<AdminAthlete> {
  const res = await authFetch("/admin/athletes", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return res.json() as Promise<AdminAthlete>;
}

export async function updateAthlete(id: string, payload: AdminAthleteUpdatePayload): Promise<AdminAthlete> {
  const res = await authFetch(`/admin/athletes/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
  return res.json() as Promise<AdminAthlete>;
}

export async function deleteAthlete(id: string): Promise<void> {
  await authFetch(`/admin/athletes/${id}`, { method: "DELETE" });
}
