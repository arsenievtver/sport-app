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

export interface CoachAthleteSummary {
  athlete_id: string;
  display_name: string;
  link_status: "pending" | "active" | "paused" | "ended";
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

export function isAthleteOnboardingComplete(profile: AthleteProfile | null | undefined): boolean {
  return Boolean(profile?.onboarding_completed_at);
}

export function clampFocusImportance(value: number): number {
  return Math.max(
    FOCUS_IMPORTANCE_MIN,
    Math.min(FOCUS_IMPORTANCE_MAX, Math.round(value)),
  );
}
