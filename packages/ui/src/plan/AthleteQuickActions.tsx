import type { CSSProperties, ReactElement } from "react";
import { IconDumbbell } from "../icons/AthleteMetricIcons";
import { ICON_VIEW_BOX, iconStrokeProps } from "../icons/iconProps";
import "./athlete-plan.css";

export type AthleteQuickActionId = "hall-of-fame" | "nutrition" | "workouts" | "assistant";

interface AthleteQuickActionsProps {
  onAction: (action: AthleteQuickActionId) => void;
}

function IconHallOfFame() {
  return (
    <svg viewBox={ICON_VIEW_BOX} aria-hidden="true" {...iconStrokeProps}>
      <path d="M8 21h8" />
      <path d="M12 17v4" />
      <path d="M7 4h10v5a5 5 0 0 1-10 0V4Z" />
      <path d="M17 5h2a2 2 0 0 1 0 4h-2" />
      <path d="M7 5H5a2 2 0 0 0 0 4h2" />
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

function IconAssistant() {
  return (
    <svg viewBox={ICON_VIEW_BOX} aria-hidden="true" {...iconStrokeProps}>
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      <path d="M8 9h8M8 13h5" />
    </svg>
  );
}

const ACTIONS: Array<{
  id: AthleteQuickActionId;
  label: string;
  hint: string;
  Icon: () => ReactElement;
}> = [
  { id: "hall-of-fame", label: "Зал славы", hint: "Открыть", Icon: IconHallOfFame },
  { id: "nutrition", label: "Питание", hint: "Записать", Icon: IconNutrition },
  { id: "workouts", label: "Тренировки", hint: "Открыть", Icon: IconDumbbell },
  { id: "assistant", label: "Ассистент", hint: "Спросить", Icon: IconAssistant },
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
            className="athlete-quick-actions__tile"
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
