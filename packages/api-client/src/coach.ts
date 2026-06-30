import type {
  ActivityTypesList,
  AthleteWeightDynamics,
  CoachAthleteActiveCreditBatch,
  CoachAthleteSessionHistoryEntry,
  CoachAthleteSessionsResponse,
  CoachAthleteSummary,
  CoachAthleteWeightMeasurementResponse,
  UserResponse,
} from "@sport-app/shared";

import { authenticatedFetchOk } from "./auth";

export async function fetchCoachAthletes(): Promise<CoachAthleteSummary[]> {
  const res = await authenticatedFetchOk("/coach/athletes");
  return res.json() as Promise<CoachAthleteSummary[]>;
}

export async function fetchCoachActivityTypes(): Promise<ActivityTypesList> {
  const res = await authenticatedFetchOk("/coach/activity-types");
  return res.json() as Promise<ActivityTypesList>;
}

export async function createManagedAthlete(payload: { display_name: string }): Promise<CoachAthleteSummary> {
  const res = await authenticatedFetchOk("/coach/athletes", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return res.json() as Promise<CoachAthleteSummary>;
}

export async function uploadCoachAvatar(file: Blob): Promise<UserResponse> {
  const formData = new FormData();
  formData.append("file", file, "avatar.jpg");
  const res = await authenticatedFetchOk("/coach/avatar", {
    method: "POST",
    body: formData,
  });
  return res.json() as Promise<UserResponse>;
}

export async function addCoachAthleteSessions(payload: {
  athlete_id: string;
  count: number;
}): Promise<CoachAthleteSessionsResponse> {
  const res = await authenticatedFetchOk(`/coach/athletes/${payload.athlete_id}/sessions/add`, {
    method: "POST",
    body: JSON.stringify({ count: payload.count }),
  });
  return res.json() as Promise<CoachAthleteSessionsResponse>;
}

export async function completeCoachAthleteSession(payload: {
  athlete_id: string;
}): Promise<CoachAthleteSessionsResponse> {
  const res = await authenticatedFetchOk(`/coach/athletes/${payload.athlete_id}/sessions/complete`, {
    method: "POST",
  });
  return res.json() as Promise<CoachAthleteSessionsResponse>;
}

export async function addCoachAthleteWeightMeasurement(payload: {
  athlete_id: string;
  weight_kg: number;
}): Promise<CoachAthleteWeightMeasurementResponse> {
  const res = await authenticatedFetchOk(`/coach/athletes/${payload.athlete_id}/weight/measurements`, {
    method: "POST",
    body: JSON.stringify({ weight_kg: payload.weight_kg }),
  });
  return res.json() as Promise<CoachAthleteWeightMeasurementResponse>;
}

export async function fetchCoachAthleteWeightDynamics(athleteId: string): Promise<AthleteWeightDynamics> {
  const res = await authenticatedFetchOk(`/coach/athletes/${athleteId}/weight/dynamics`);
  return res.json() as Promise<AthleteWeightDynamics>;
}

export async function fetchCoachAthleteSessionHistory(
  athleteId: string,
  year: number,
  month: number,
): Promise<CoachAthleteSessionHistoryEntry[]> {
  const params = new URLSearchParams({
    year: String(year),
    month: String(month),
  });
  const res = await authenticatedFetchOk(`/coach/athletes/${athleteId}/sessions/history?${params}`);
  return res.json() as Promise<CoachAthleteSessionHistoryEntry[]>;
}

export async function fetchCoachAthleteActiveCreditBatches(
  athleteId: string,
): Promise<CoachAthleteActiveCreditBatch[]> {
  const res = await authenticatedFetchOk(`/coach/athletes/${athleteId}/sessions/active-batches`);
  return res.json() as Promise<CoachAthleteActiveCreditBatch[]>;
}

export async function deleteCoachAthleteSessionEntry(payload: {
  athlete_id: string;
  entry_id: string;
}): Promise<CoachAthleteSessionsResponse> {
  const res = await authenticatedFetchOk(
    `/coach/athletes/${payload.athlete_id}/sessions/entries/${payload.entry_id}`,
    { method: "DELETE" },
  );
  return res.json() as Promise<CoachAthleteSessionsResponse>;
}
