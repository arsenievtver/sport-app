import type { CoachAthleteLinkStatus } from "./types";

export interface LinkedAthleteSummary {
  link_id: string;
  athlete_id: string;
  display_name: string;
  status: CoachAthleteLinkStatus;
}

export interface LinkedCoachSummary {
  link_id: string;
  coach_id: string;
  display_name: string;
  status: CoachAthleteLinkStatus;
}

export interface AdminCoach {
  id: string;
  user_id: string;
  phone: string;
  display_name: string;
  bio: string | null;
  invite_code: string;
  is_verified: boolean;
  is_active: boolean;
  athletes: LinkedAthleteSummary[];
  created_at: string;
}

export interface AdminAthlete {
  id: string;
  user_id: string | null;
  phone: string | null;
  display_name: string;
  birth_date: string | null;
  timezone: string;
  is_active: boolean;
  is_managed: boolean;
  coaches: LinkedCoachSummary[];
  created_at: string;
}

export interface AdminCoachCreatePayload {
  phone: string;
  pin: string;
  display_name: string;
  bio?: string | null;
  is_verified?: boolean;
  athlete_ids?: string[];
}

export interface AdminCoachUpdatePayload {
  display_name?: string;
  bio?: string | null;
  is_verified?: boolean;
  is_active?: boolean;
  pin?: string;
  athlete_ids?: string[];
}

export interface AdminAthleteCreatePayload {
  phone: string;
  pin: string;
  display_name: string;
  birth_date?: string | null;
  timezone?: string;
  coach_ids?: string[];
}

export interface AdminAthleteUpdatePayload {
  display_name?: string;
  birth_date?: string | null;
  timezone?: string;
  is_active?: boolean;
  pin?: string;
  coach_ids?: string[];
}

export interface CoachAthleteLink {
  id: string;
  coach_id: string;
  athlete_id: string;
  status: CoachAthleteLinkStatus;
  created_at: string;
}

export interface CoachAthleteLinkCreatePayload {
  coach_id: string;
  athlete_id: string;
  status?: CoachAthleteLinkStatus;
}

export const LINK_STATUS_LABELS: Record<CoachAthleteLinkStatus, string> = {
  pending: "Ожидает",
  active: "Активна",
  paused: "Пауза",
  ended: "Завершена",
};

export interface AdminPushDayStat {
  date: string;
  subscription_count: number;
}

export interface AdminPushStats {
  vapid_configured: boolean;
  subscription_count: number;
  user_count: number;
  pending_scheduled_count: number;
  by_day: AdminPushDayStat[];
}

export interface AdminPushSendPayload {
  title: string;
  body: string;
  url?: string | null;
}

export interface AdminPushSendResult {
  users_targeted: number;
  users_sent: number;
  devices_sent: number;
}

export type AdminScheduledPushStatus = "pending" | "sent" | "cancelled" | "failed";

export interface AdminScheduledPush {
  id: string;
  title: string;
  body: string;
  url: string | null;
  send_at: string;
  status: AdminScheduledPushStatus;
  created_at: string;
  sent_at: string | null;
  error: string | null;
  users_sent: number;
  devices_sent: number;
}

export interface AdminScheduledPushCreatePayload {
  title: string;
  body: string;
  send_at: string;
  url?: string | null;
}

export const SCHEDULED_PUSH_STATUS_LABELS: Record<AdminScheduledPushStatus, string> = {
  pending: "Ожидает",
  sent: "Отправлено",
  cancelled: "Отменено",
  failed: "Ошибка",
};
