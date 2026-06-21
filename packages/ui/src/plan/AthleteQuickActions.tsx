import type { CSSProperties, ReactElement } from "react";
import { IconDumbbell } from "../icons/AthleteMetricIcons";
import "./athlete-plan.css";

export type AthleteQuickActionId = "my-plan" | "nutrition" | "workouts";

interface AthleteQuickActionsProps {
  onAction: (action: AthleteQuickActionId) => void;
}

function IconMyPlan() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" strokeLinecap="round" />
    </svg>
  );
}

function IconNutrition() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <ellipse cx="12" cy="14.5" rx="6.5" ry="3.5" />
      <path d="M6.5 3v5.5a1.25 1.25 0 0 0 2.5 0V3" />
      <path d="M7.75 3v2.25" />
      <path d="M17.5 3v7.5a1.25 1.25 0 0 1-2.5 0V3" />
      <path d="M16.25 3v2.25" />
    </svg>
  );
}

const ACTIONS: Array<{
  id: AthleteQuickActionId;
  label: string;
  hint: string;
  Icon: () => ReactElement;
}> = [
  { id: "my-plan", label: "Мой план", hint: "Настроить", Icon: IconMyPlan },
  { id: "nutrition", label: "Питание", hint: "Записать", Icon: IconNutrition },
  { id: "workouts", label: "Тренировки", hint: "Открыть", Icon: IconDumbbell },
];

export function AthleteQuickActions({ onAction }: AthleteQuickActionsProps) {
  return (
    <div
      className="athlete-home-section athlete-home-enter"
      style={{ "--enter-delay": "80ms" } as CSSProperties}
    >
      <h2 className="athlete-home-section__title">Быстрые действия</h2>
      <div className="athlete-quick-actions">
        {ACTIONS.map(({ id, label, hint, Icon }) => (
          <button
            key={id}
            type="button"
            className="athlete-quick-actions__tile glass glass--panel"
            onClick={() => onAction(id)}
          >
            <span className="athlete-quick-actions__icon" aria-hidden="true">
              <Icon />
            </span>
            <span className="athlete-quick-actions__label">{label}</span>
            <span className="athlete-quick-actions__hint text-muted">{hint}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
