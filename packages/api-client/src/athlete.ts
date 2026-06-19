import type {
  ActivityTypesList,
  AthleteCoachLink,
  AthleteCompleteSessionPayload,
  AthleteCompleteSessionResponse,
  AthleteLastSession,
  AthleteWeightDynamics,
  AthleteWeightMeasurementPayload,
  AthleteOnboardingPayload,
  AthleteProfile,
  AthleteProfileUpdatePayload,
  AthleteSessionsStats,
  AthleteUpcomingSession,
  JoinCoachPayload,
  UserResponse,
} from "@sport-app/shared";

import { authenticatedFetchOk } from "./auth";
import { getApiBaseUrl } from "./config";

export async function completeAthleteOnboarding(payload: AthleteOnboardingPayload): Promise<UserResponse> {
  const res = await authenticatedFetchOk("/athlete/onboarding", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return res.json() as Promise<UserResponse>;
}

export async function fetchAthleteProfile(): Promise<AthleteProfile> {
  const res = await authenticatedFetchOk("/athlete/profile");
  return res.json() as Promise<AthleteProfile>;
}

export async function updateAthleteProfile(payload: AthleteProfileUpdatePayload): Promise<UserResponse> {
  const res = await authenticatedFetchOk("/athlete/profile", {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
  return res.json() as Promise<UserResponse>;
}

export async function uploadAthleteAvatar(file: Blob): Promise<UserResponse> {
  const formData = new FormData();
  formData.append("file", file, "avatar.jpg");
  const res = await authenticatedFetchOk("/athlete/avatar", {
    method: "POST",
    body: formData,
  });
  return res.json() as Promise<UserResponse>;
}

export async function fetchAthleteCoaches(): Promise<AthleteCoachLink[]> {
  const res = await authenticatedFetchOk("/athlete/coaches");
  return res.json() as Promise<AthleteCoachLink[]>;
}

export async function joinAthleteCoach(payload: JoinCoachPayload): Promise<AthleteCoachLink> {
  const res = await authenticatedFetchOk("/athlete/coaches/join", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return res.json() as Promise<AthleteCoachLink>;
}

export async function removeAthleteCoach(linkId: string): Promise<void> {
  await authenticatedFetchOk(`/athlete/coaches/${linkId}`, { method: "DELETE" });
}

export async function fetchAthleteUpcomingSessions(limit = 4): Promise<AthleteUpcomingSession[]> {
  const res = await authenticatedFetchOk(`/athlete/schedule/upcoming?limit=${limit}`);
  return res.json() as Promise<AthleteUpcomingSession[]>;
}

export async function fetchAthleteSessionsStats(): Promise<AthleteSessionsStats> {
  const res = await authenticatedFetchOk("/athlete/sessions/stats");
  return res.json() as Promise<AthleteSessionsStats>;
}

export async function fetchAthleteLastSession(): Promise<AthleteLastSession | null> {
  const res = await authenticatedFetchOk("/athlete/sessions/last");
  if (res.status === 204) return null;
  const data = (await res.json()) as AthleteLastSession | null;
  return data ?? null;
}

export async function fetchActivityTypes(): Promise<ActivityTypesList> {
  const res = await authenticatedFetchOk("/athlete/activity-types");
  return res.json() as Promise<ActivityTypesList>;
}

export async function fetchAthleteWeightDynamics(): Promise<AthleteWeightDynamics> {
  const res = await authenticatedFetchOk("/athlete/weight/dynamics");
  return res.json() as Promise<AthleteWeightDynamics>;
}

export async function addAthleteWeightMeasurement(
  payload: AthleteWeightMeasurementPayload,
): Promise<AthleteWeightDynamics> {
  const res = await authenticatedFetchOk("/athlete/weight/measurements", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return res.json() as Promise<AthleteWeightDynamics>;
}

export async function completeAthleteSession(
  payload: AthleteCompleteSessionPayload,
): Promise<AthleteCompleteSessionResponse> {
  const res = await authenticatedFetchOk("/athlete/sessions/complete", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return res.json() as Promise<AthleteCompleteSessionResponse>;
}

export function resolveMediaUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  return `${getApiBaseUrl()}${path.startsWith("/") ? path : `/${path}`}`;
}
