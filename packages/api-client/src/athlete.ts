import type { AthleteOnboardingPayload, AthleteProfile, UserResponse } from "@sport-app/shared";

import { authenticatedFetchOk } from "./auth";

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
