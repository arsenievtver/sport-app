import type { CoachAthleteSummary } from "@sport-app/shared";

import { authenticatedFetchOk } from "./auth";

export async function fetchCoachAthletes(): Promise<CoachAthleteSummary[]> {
  const res = await authenticatedFetchOk("/coach/athletes");
  return res.json() as Promise<CoachAthleteSummary[]>;
}

export async function addCoachAthleteSessions(payload: {
  athlete_id: string;
  count: number;
}): Promise<{ sessions_balance: number; athlete_id: string; link_id: string }> {
  const res = await authenticatedFetchOk(`/coach/athletes/${payload.athlete_id}/sessions/add`, {
    method: "POST",
    body: JSON.stringify({ count: payload.count }),
  });
  return res.json();
}

export async function completeCoachAthleteSession(payload: {
  athlete_id: string;
}): Promise<{ sessions_balance: number; athlete_id: string; link_id: string }> {
  const res = await authenticatedFetchOk(`/coach/athletes/${payload.athlete_id}/sessions/complete`, {
    method: "POST",
  });
  return res.json();
}
