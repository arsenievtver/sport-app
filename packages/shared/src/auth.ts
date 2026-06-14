import type { UserRole } from "./types";
import type { AthleteProfile } from "./athlete";

export type { UserRole };

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
}

export interface LoginPayload {
  phone: string;
  pin: string;
}

export interface RegisterPayload extends LoginPayload {
  role: Exclude<UserRole, "admin">;
  display_name: string;
}

export interface CoachProfile {
  display_name: string;
  invite_code: string;
  is_verified: boolean;
}

export type { AthleteProfile, AthleteOnboardingPayload, CoachAthleteSummary, Gender } from "./athlete";
export {
  FOCUS_IMPORTANCE_DEFAULT,
  FOCUS_IMPORTANCE_MAX,
  FOCUS_IMPORTANCE_MIN,
  GENDER_LABELS,
  TRAINING_TRAIT_LABELS,
  clampFocusImportance,
  isAthleteOnboardingComplete,
} from "./athlete";

export interface UserResponse {
  id: string;
  phone: string;
  roles: UserRole[];
  is_active: boolean;
  last_login_at: string | null;
  coach_profile: CoachProfile | null;
  athlete_profile: AthleteProfile | null;
}

export function hasRole(user: Pick<UserResponse, "roles">, role: UserRole): boolean {
  return user.roles.includes(role);
}

export interface ApiErrorBody {
  detail?: string | { msg: string }[];
}
