import type { CoachAthleteSessionHistoryEntry, CoachAthleteSessionsResponse, CoachAthleteSummary, UserResponse } from "@sport-app/shared";

import { authenticatedFetchOk } from "./auth";

export async function fetchCoachAthletes(): Promise<CoachAthleteSummary[]> {
  const res = await authenticatedFetchOk("/coach/athletes");
  return res.json() as Promise<CoachAthleteSummary[]>;
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

export async function fetchCoachAthleteSessionHistory(
  athleteId: string,
): Promise<CoachAthleteSessionHistoryEntry[]> {
  const res = await authenticatedFetchOk(`/coach/athletes/${athleteId}/sessions/history`);
  return res.json() as Promise<CoachAthleteSessionHistoryEntry[]>;
}
