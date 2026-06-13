import type { UserRole } from "./types";

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

export interface AthleteProfile {
  display_name: string;
  timezone?: string | null;
}

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
