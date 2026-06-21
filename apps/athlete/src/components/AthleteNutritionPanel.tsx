import { MEAL_HISTORY_DAYS } from "@sport-app/shared";
import { AthleteMealsPanel } from "./AthleteMealsPanel";

interface AthleteNutritionPanelProps {
  onBack: () => void;
}

export function AthleteNutritionPanel({ onBack }: AthleteNutritionPanelProps) {
  return (
    <div className="athlete-overlay-screen">
      <header className="athlete-overlay-screen__header">
        <button type="button" className="athlete-overlay-screen__back" onClick={onBack}>
          ← Назад
        </button>
        <h1 className="athlete-overlay-screen__title">Питание</h1>
        <p className="athlete-nutrition__subtitle text-muted">Записи за последние {MEAL_HISTORY_DAYS} дней</p>
      </header>
      <AthleteMealsPanel embedded />
    </div>
  );
}
