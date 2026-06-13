import type { UserRole } from "./types";

/** UI-названия ролей (код/API: athlete | coach | admin) */
export const ROLE_LABELS: Record<Exclude<UserRole, "admin">, string> = {
  athlete: "Атлет",
  coach: "Тренер",
};

export const ROLE_LABELS_GENITIVE: Record<Exclude<UserRole, "admin">, string> = {
  athlete: "атлета",
  coach: "тренера",
};

export const ROLE_LABELS_PLURAL: Record<Exclude<UserRole, "admin">, string> = {
  athlete: "атлетами",
  coach: "тренерами",
};
