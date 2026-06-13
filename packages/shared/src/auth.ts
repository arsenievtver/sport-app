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

export interface UserProfile {
  display_name: string;
  invite_code?: string | null;
  is_verified?: boolean | null;
  timezone?: string | null;
}

export interface UserResponse {
  id: string;
  phone: string;
  role: UserRole;
  is_active: boolean;
  last_login_at: string | null;
  profile: UserProfile | null;
}

export interface ApiErrorBody {
  detail?: string | { msg: string }[];
}
