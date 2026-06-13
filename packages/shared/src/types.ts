export type UserRole = "athlete" | "coach" | "admin";

export type CoachAthleteLinkStatus = "pending" | "active" | "paused" | "ended";

export type ProgramStatus = "draft" | "active" | "archived";

export type WorkoutStatus =
  | "scheduled"
  | "in_progress"
  | "completed"
  | "skipped"
  | "rescheduled";

export type WorkoutLogStatus = "in_progress" | "completed" | "partial";

export type GoalStatus = "active" | "achieved" | "cancelled" | "expired";

export type GoalMetricType =
  | "weight"
  | "reps"
  | "duration"
  | "distance"
  | "sessions_count"
  | "custom";

export type ChallengeStatus = "draft" | "active" | "completed" | "cancelled";

export type ChallengeType = "sessions" | "volume" | "streak" | "custom";

export type AppSource = "athlete" | "coach" | "coach-web" | "admin";

export interface SetData {
  set: number;
  reps?: number;
  weight_kg?: number;
  duration_sec?: number;
  distance_m?: number;
  rpe?: number;
}

export interface ApiHealth {
  status: string;
}
