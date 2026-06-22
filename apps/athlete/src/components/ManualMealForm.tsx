import { useState } from "react";
import { fetchAthleteMealDishNutrition } from "@sport-app/api-client";
import type { MealDishSearchItem } from "@sport-app/shared";
import { formatMealCalories, formatMealWeightInput, isValidMealCalories } from "@sport-app/shared";
import { MealDishSearchPicker } from "./MealDishSearchPicker";

type ManualMealTab = "simple" | "composite";

export interface ManualMealComponent {
  key: string;
  name: string;
  calories_kcal: number;
  weight_g: number | null;
  logmeal_dish_id: number | null;
}

export interface ManualMealSavePayload {
  title: string;
  calories_kcal: number;
  weight_g: number | null;
  components: ManualMealComponent[];
}

interface ManualMealFormProps {
  busy: boolean;
  catalogDishCount: number | null;
  onSave: (payload: ManualMealSavePayload) => Promise<void>;
  onCancel: () => void;
}

function dishToComponent(dish: Awaited<ReturnType<typeof fetchAthleteMealDishNutrition>>, logmealDishId: number): ManualMealComponent {
  return {
    key: `component-${logmealDishId}-${Date.now()}`,
    name: dish.name,
    calories_kcal: Math.round(dish.calories_kcal ?? 0),
    weight_g: dish.weight_g ?? null,
    logmeal_dish_id: logmealDishId,
  };
}

export function ManualMealForm({ busy, catalogDishCount, onSave, onCancel }: ManualMealFormProps) {
  const [tab, setTab] = useState<ManualMealTab>("simple");
  const [pickedDish, setPickedDish] = useState<ManualMealComponent | null>(null);
  const [components, setComponents] = useState<ManualMealComponent[]>([]);
  const [loadingDish, setLoadingDish] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchResetKey, setSearchResetKey] = useState(0);

  const compositeCalories = components.reduce((sum, item) => sum + item.calories_kcal, 0);
  const compositeWeight = components.reduce((sum, item) => sum + (item.weight_g ?? 0), 0);
  const compositeTitle = components.map((item) => item.name).join(", ");

  const loadDish = async (item: MealDishSearchItem) => {
    setError(null);
    setLoadingDish(true);
    try {
      const dish = await fetchAthleteMealDishNutrition(item.logmeal_dish_id);
      return dishToComponent(dish, item.logmeal_dish_id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось загрузить блюдо");
      return null;
    } finally {
      setLoadingDish(false);
    }
  };

  const handleSimplePick = async (item: MealDishSearchItem) => {
    const component = await loadDish(item);
    if (!component) return;
    setPickedDish(component);
    setSearchResetKey((current) => current + 1);
  };

  const handleCompositePick = async (item: MealDishSearchItem) => {
    const component = await loadDish(item);
    if (!component) return;
    setComponents((current) => [...current, component]);
    setSearchResetKey((current) => current + 1);
  };

  const removeComponent = (key: string) => {
    setComponents((current) => current.filter((item) => item.key !== key));
  };

  const handleSubmit = async () => {
    setError(null);

    if (tab === "simple") {
      if (!pickedDish) {
        setError("Выберите блюдо из базы");
        return;
      }
      if (!isValidMealCalories(pickedDish.calories_kcal)) {
        setError("Не удалось определить калорийность блюда");
        return;
      }

      await onSave({
        title: pickedDish.name,
        calories_kcal: pickedDish.calories_kcal,
        weight_g: pickedDish.weight_g,
        components: [],
      });
      return;
    }

    if (components.length === 0) {
      setError("Добавьте хотя бы один компонент из базы");
      return;
    }
    if (!isValidMealCalories(compositeCalories)) {
      setError("Не удалось определить калорийность блюда");
      return;
    }

    await onSave({
      title: compositeTitle,
      calories_kcal: compositeCalories,
      weight_g: compositeWeight > 0 ? Math.round(compositeWeight * 10) / 10 : null,
      components,
    });
  };

  const switchTab = (next: ManualMealTab) => {
    setTab(next);
    setError(null);
    if (next === "simple") {
      setComponents([]);
    } else {
      setPickedDish(null);
    }
  };

  const formBusy = busy || loadingDish;

  const renderComponentRow = (item: ManualMealComponent, onRemove: () => void) => (
    <li key={item.key} className="meal-manual__component">
      <div className="meal-manual__component-main">
        <span className="meal-manual__component-name">{item.name}</span>
        <span className="meal-manual__component-meta text-secondary">
          {formatMealCalories(item.calories_kcal)} ккал
          {item.weight_g != null ? ` · ${formatMealWeightInput(item.weight_g)} г` : ""}
        </span>
      </div>
      <button
        type="button"
        className="meal-manual__component-remove"
        disabled={formBusy}
        aria-label={`Убрать ${item.name}`}
        onClick={onRemove}
      >
        ×
      </button>
    </li>
  );

  return (
    <div className="meal-manual glass glass--panel">
      <div className="meal-manual__tabs" role="tablist" aria-label="Тип блюда">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "simple"}
          className={`meal-manual__tab${tab === "simple" ? " meal-manual__tab--active" : ""}`}
          disabled={formBusy}
          onClick={() => switchTab("simple")}
        >
          Простое
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "composite"}
          className={`meal-manual__tab${tab === "composite" ? " meal-manual__tab--active" : ""}`}
          disabled={formBusy}
          onClick={() => switchTab("composite")}
        >
          Составное
        </button>
      </div>

      {tab === "simple" ? (
        <div className="meal-manual__body" role="tabpanel">
          <MealDishSearchPicker
            key={`simple-search-${searchResetKey}`}
            label="Найти в базе"
            placeholder="начните вводить название…"
            disabled={formBusy}
            catalogDishCount={catalogDishCount}
            resetQueryOnSelect
            onSelect={(item) => void handleSimplePick(item)}
          />

          {pickedDish ? (
            <ul className="meal-manual__components">{renderComponentRow(pickedDish, () => setPickedDish(null))}</ul>
          ) : (
            <p className="meal-manual__empty text-secondary">Выберите блюдо из базы — калории подставятся автоматически</p>
          )}
        </div>
      ) : (
        <div className="meal-manual__body" role="tabpanel">
          {components.length > 0 ? (
            <ul className="meal-manual__components">
              {components.map((item) => renderComponentRow(item, () => removeComponent(item.key)))}
            </ul>
          ) : (
            <p className="meal-manual__empty text-secondary">Добавьте компоненты из базы — они сложатся в одно блюдо</p>
          )}

          <div className="meal-manual__add-row">
            <MealDishSearchPicker
              key={`composite-search-${searchResetKey}`}
              label="Добавить компонент"
              hideLabel
              placeholder="найти и добавить…"
              disabled={formBusy}
              catalogDishCount={catalogDishCount}
              resetQueryOnSelect
              onSelect={(item) => void handleCompositePick(item)}
            />
            <span className="meal-manual__add-icon" aria-hidden="true">
              +
            </span>
          </div>

          {components.length > 0 ? (
            <div className="meal-manual__composite-total">
              <span className="text-secondary">Итого</span>
              <strong>{compositeTitle}</strong>
              <span className="meal-manual__composite-kcal">{formatMealCalories(compositeCalories)} ккал</span>
            </div>
          ) : null}
        </div>
      )}

      {error ? <p className="auth-error meal-manual__error">{error}</p> : null}

      <div className="meal-manual__actions">
        <button
          type="button"
          className="btn btn-outline btn-outline--primary"
          disabled={formBusy}
          onClick={() => void handleSubmit()}
        >
          {formBusy ? "Сохраняем…" : "Записать"}
        </button>
        <button type="button" className="btn btn-outline btn-outline--muted" disabled={formBusy} onClick={onCancel}>
          Отмена
        </button>
      </div>
    </div>
  );
}
