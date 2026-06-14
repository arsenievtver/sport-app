import type { CoachAthleteSummary } from "@sport-app/shared";

import { authenticatedFetchOk } from "./auth";

export async function fetchCoachAthletes(): Promise<CoachAthleteSummary[]> {
  const res = await authenticatedFetchOk("/coach/athletes");
  return res.json() as Promise<CoachAthleteSummary[]>;
}
