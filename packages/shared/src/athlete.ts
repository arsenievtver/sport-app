export type Gender = "male" | "female";

export const GENDER_LABELS: Record<Gender, string> = {
  male: "Мужской",
  female: "Женский",
};

export const FOCUS_IMPORTANCE_MIN = 20;
export const FOCUS_IMPORTANCE_MAX = 100;
export const FOCUS_IMPORTANCE_DEFAULT = 50;

export type TrainingTrait = "strength" | "flexibility" | "endurance" | "coordination";

export const TRAINING_TRAIT_LABELS: Record<TrainingTrait, string> = {
  strength: "Сила",
  flexibility: "Гибкость",
  endurance: "Выносливость",
  coordination: "Координация",
};

export interface AthleteProfile {
  display_name: string;
  gender?: Gender | null;
  birth_date?: string | null;
  avatar_url?: string | null;
  timezone?: string | null;
  focus_strength?: number | null;
  focus_flexibility?: number | null;
  focus_endurance?: number | null;
  focus_coordination?: number | null;
  weight_target_min_kg?: number | null;
  weight_target_max_kg?: number | null;
  personal_goal_title?: string | null;
  personal_goal_target?: number | null;
  onboarding_completed_at?: string | null;
}

export interface AthleteOnboardingPayload {
  gender: Gender;
  birth_date: string;
  focus_strength: number;
  focus_flexibility: number;
  focus_endurance: number;
  focus_coordination: number;
  weight_target_min_kg?: number | null;
  weight_target_max_kg?: number | null;
  personal_goal_title?: string | null;
  personal_goal_target?: number | null;
}

export interface AthleteProfileUpdatePayload {
  display_name?: string;
  gender?: Gender;
  birth_date?: string;
}

export interface AthleteCoachLink {
  link_id: string;
  coach_id: string;
  display_name: string;
  avatar_url?: string | null;
  link_status: "pending" | "active" | "paused" | "ended";
  sessions_balance: number;
  sessions_completed: number;
}

export interface AthleteSessionsStats {
  sessions_completed: number;
}

export interface AthleteCompleteSessionResponse {
  link_id?: string | null;
  sessions_balance?: number | null;
  sessions_completed: number;
  activity_name?: string | null;
  duration_min?: number | null;
  effort?: number | null;
  effective_met?: number | null;
  load_met_minutes?: number | null;
  weight_kg_used?: number | null;
  calories_kcal?: number | null;
}

export interface AthleteCompleteSessionPayload {
  link_id?: string;
  without_coach?: boolean;
  activity_type_id: string;
  duration_min: number;
  effort: number;
}

/** Значение выбора «без тренера» в UI добавления тренировки. */
export const ATHLETE_WORKOUT_WITHOUT_COACH = "__without_coach__" as const;
export const ATHLETE_WORKOUT_WITHOUT_COACH_LABEL = "Без тренера";

export interface AthleteLastSession {
  entry_date: string;
  activity_name?: string | null;
  duration_min?: number | null;
  effort?: number | null;
  effective_met?: number | null;
  load_met_minutes?: number | null;
  weight_kg_used?: number | null;
  calories_kcal?: number | null;
  coach_display_name?: string | null;
}

export function formatAthleteLastSessionDate(entryDate: string): string {
  const date = new Date(`${entryDate}T00:00:00`);
  if (Number.isNaN(date.getTime())) return entryDate;
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

export interface JoinCoachPayload {
  invite_code: string;
  claim_athlete_id?: string;
}

export type CoachAthleteSessionEntryKind = "credit" | "debit";

export interface CoachAthleteSessionHistoryEntry {
  id: string;
  kind: CoachAthleteSessionEntryKind;
  sessions_count: number;
  entry_date: string;
}

export const ATHLETE_APP_STATUS_LABELS = {
  withApp: "В приложении",
  withoutApp: "Без приложения",
} as const;

export function getAthleteAppStatusLabel(hasApp: boolean): string {
  return hasApp ? ATHLETE_APP_STATUS_LABELS.withApp : ATHLETE_APP_STATUS_LABELS.withoutApp;
}

export interface CoachAthleteSummary {
  athlete_id: string;
  display_name: string;
  has_app: boolean;
  avatar_url?: string | null;
  link_id: string;
  link_status: "pending" | "active" | "paused" | "ended";
  sessions_balance: number;
  sessions_completed: number;
  gender?: Gender | null;
  birth_date?: string | null;
  focus_strength?: number | null;
  focus_flexibility?: number | null;
  focus_endurance?: number | null;
  focus_coordination?: number | null;
  weight_target_min_kg?: number | null;
  weight_target_max_kg?: number | null;
  personal_goal_title?: string | null;
  personal_goal_target?: number | null;
  onboarding_completed_at?: string | null;
}

export interface CoachAthleteSessionsResponse {
  athlete_id: string;
  link_id: string;
  sessions_balance: number;
  sessions_completed: number;
}

export function isAthleteOnboardingComplete(profile: AthleteProfile | null | undefined): boolean {
  return Boolean(profile?.onboarding_completed_at);
}

export function clampFocusImportance(value: number): number {
  return Math.max(
    FOCUS_IMPORTANCE_MIN,
    Math.min(FOCUS_IMPORTANCE_MAX, Math.round(value)),
  );
}

export function calculateAge(birthDate: string | null | undefined, today = new Date()): number | null {
  if (!birthDate) return null;
  const born = new Date(`${birthDate}T00:00:00`);
  if (Number.isNaN(born.getTime())) return null;
  let age = today.getFullYear() - born.getFullYear();
  const monthDiff = today.getMonth() - born.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < born.getDate())) {
    age -= 1;
  }
  return age >= 0 ? age : null;
}

export function formatBirthDateDisplay(birthDate: string | null | undefined): string {
  if (!birthDate) return "—";
  const date = new Date(`${birthDate}T00:00:00`);
  if (Number.isNaN(date.getTime())) return birthDate;
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}
