import type { CSSProperties, ReactElement } from "react";
import { IconDumbbell } from "../icons/AthleteMetricIcons";
import { ICON_VIEW_BOX, iconStrokeProps } from "../icons/iconProps";
import "./athlete-plan.css";

export type AthleteQuickActionId = "my-plan" | "nutrition" | "workouts";

interface AthleteQuickActionsProps {
  onAction: (action: AthleteQuickActionId) => void;
}

function IconMyPlan() {
  return (
    <svg viewBox={ICON_VIEW_BOX} aria-hidden="true" {...iconStrokeProps}>
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  );
}

function IconNutrition() {
  return (
    <svg viewBox={ICON_VIEW_BOX} aria-hidden="true" {...iconStrokeProps}>
      <path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2" />
      <path d="M7 2v20" />
      <path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7" />
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
