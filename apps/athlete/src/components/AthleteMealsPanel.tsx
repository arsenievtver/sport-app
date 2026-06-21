import { useCallback, useEffect, useRef, useState } from "react";
import { analyzeAthleteMealPhoto, createAthleteMealEntry, fetchAthleteMeals } from "@sport-app/api-client";
import type { AthleteMealEntry, MealAnalysisResult, MealDishEditorRow, MealNutritionBaseline } from "@sport-app/shared";
import { WheelNumberPicker } from "@sport-app/ui";
import {
  MEAL_HISTORY_DAYS,
  compressMealPhoto,
  formatMealCalories,
  formatMealDateTime,
  formatMealMacroInput,
  formatMealWeightInput,
  isValidMealCalories,
  mealDishEditorRowsFromAnalysis,
  mealDishRowNutrition,
  mealNutritionToFormInputs,
  parseMealNumberInput,
  sumMealDishRows,
} from "@sport-app/shared";

type FormMode = "choose" | "manual" | "ai" | "review";

const MAX_DISH_WEIGHT_G = 2000;

interface MealFormState {
  title: string;
  caloriesInput: string;
  weightInput: string;
  proteinInput: string;
  carbsInput: string;
  fatInput: string;
  source: "manual" | "ai";
  logmealImageId: number | null;
}

const EMPTY_FORM: MealFormState = {
  title: "",
  caloriesInput: "",
  weightInput: "",
  proteinInput: "",
  carbsInput: "",
  fatInput: "",
  source: "manual",
  logmealImageId: null,
};

function formFromAnalysis(analysis: MealAnalysisResult, dishRows: MealDishEditorRow[]): MealFormState {
  const totals =
    dishRows.length > 0
      ? sumMealDishRows(dishRows)
      : ({
          weight_g: analysis.weight_g ?? 0,
          calories_kcal: analysis.calories_kcal,
          protein_g: analysis.protein_g,
          carbs_g: analysis.carbs_g,
          fat_g: analysis.fat_g,
        } satisfies MealNutritionBaseline);

  return {
    title: analysis.title,
    ...mealNutritionToFormInputs(totals),
    source: "ai",
    logmealImageId: analysis.logmeal_image_id ?? null,
  };
}

function optionalNumber(raw: string): number | null {
  const parsed = parseMealNumberInput(raw);
  return parsed == null ? null : parsed;
}

function dishRowWeightG(row: MealDishEditorRow): number {
  return parseMealNumberInput(row.weightInput) ?? row.baseline.weight_g;
}

function buildAiAnalysis(
  logmealImageId: number | null,
  dishRows: MealDishEditorRow[],
): Record<string, unknown> | null {
  if (dishRows.length === 0) {
    return logmealImageId != null ? { logmeal_image_id: logmealImageId } : null;
  }

  return {
    logmeal_image_id: logmealImageId,
    dishes: dishRows.map((row) => {
      const nutrition = mealDishRowNutrition(row);
      return {
        name: row.name,
        weight_g: nutrition?.weight_g ?? null,
        calories_kcal: nutrition?.calories_kcal ?? null,
        protein_g: nutrition?.protein_g ?? null,
        carbs_g: nutrition?.carbs_g ?? null,
        fat_g: nutrition?.fat_g ?? null,
      };
    }),
  };
}

export function AthleteMealsPanel({ embedded = false }: { embedded?: boolean }) {
  const [entries, setEntries] = useState<AthleteMealEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [mode, setMode] = useState<FormMode>("choose");
  const [analysis, setAnalysis] = useState<MealAnalysisResult | null>(null);
  const [dishRows, setDishRows] = useState<MealDishEditorRow[]>([]);
  const [form, setForm] = useState<MealFormState>(EMPTY_FORM);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadEntries = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchAthleteMeals({ days: MEAL_HISTORY_DAYS });
      setEntries(data.entries);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось загрузить записи питания");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadEntries();
  }, [loadEntries]);

  const applyDishRows = (rows: MealDishEditorRow[]) => {
    setDishRows(rows);
    const totals = sumMealDishRows(rows);
    setForm((current) => ({
      ...current,
      ...mealNutritionToFormInputs(totals),
    }));
  };

  const resetForm = () => {
    setShowForm(false);
    setMode("choose");
    setAnalysis(null);
    setDishRows([]);
    setForm(EMPTY_FORM);
    setError(null);
  };

  const handlePhotoSelected = async (file: File | null) => {
    if (!file) return;

    setAnalyzing(true);
    setError(null);
    setMode("ai");
    try {
      const compressed = await compressMealPhoto(file);
      const result = await analyzeAthleteMealPhoto(compressed);
      const rows = mealDishEditorRowsFromAnalysis(result.dishes);
      setAnalysis(result);
      setDishRows(rows);
      setForm(formFromAnalysis(result, rows));
      setMode("review");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось распознать фото");
      setMode("choose");
    } finally {
      setAnalyzing(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleDishWeightChange = (key: string, weightG: number) => {
    const nextRows = dishRows.map((row) =>
      row.key === key ? { ...row, weightInput: formatMealWeightInput(weightG) } : row,
    );
    applyDishRows(nextRows);
  };

  const handleSave = async () => {
    const calories = parseMealNumberInput(form.caloriesInput);
    if (calories == null || !isValidMealCalories(calories)) {
      setError("Введите калории от 0 до 10000");
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const entry = await createAthleteMealEntry({
        title: form.title.trim() || null,
        calories_kcal: calories,
        weight_g: optionalNumber(form.weightInput),
        protein_g: optionalNumber(form.proteinInput),
        carbs_g: optionalNumber(form.carbsInput),
        fat_g: optionalNumber(form.fatInput),
        source: form.source,
        logmeal_image_id: form.logmealImageId,
        ai_analysis: buildAiAnalysis(form.logmealImageId, dishRows),
      });
      setEntries((current) => [entry, ...current]);
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось сохранить запись");
    } finally {
      setBusy(false);
    }
  };

  const hasDishEditor = dishRows.length > 0;
  const totals = hasDishEditor ? sumMealDishRows(dishRows) : null;

  const renderManualFields = () => (
    <div className="meal-panel__fields">
      <label className="meal-panel__field">
        <span className="meal-panel__label text-secondary">Блюдо</span>
        <input
          type="text"
          className="meal-panel__input"
          value={form.title}
          disabled={busy || analyzing}
          onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
        />
      </label>
      <label className="meal-panel__field">
        <span className="meal-panel__label text-secondary">Калории, ккал</span>
        <input
          type="text"
          inputMode="decimal"
          className="meal-panel__input"
          placeholder="450"
          value={form.caloriesInput}
          disabled={busy || analyzing}
          onChange={(event) => setForm((current) => ({ ...current, caloriesInput: event.target.value }))}
        />
      </label>
      <div className="meal-panel__grid">
        <label className="meal-panel__field">
          <span className="meal-panel__label text-secondary">Вес, г</span>
          <input
            type="text"
            inputMode="decimal"
            className="meal-panel__input"
            placeholder="опционально"
            value={form.weightInput}
            disabled={busy || analyzing}
            onChange={(event) => setForm((current) => ({ ...current, weightInput: event.target.value }))}
          />
        </label>
        <label className="meal-panel__field">
          <span className="meal-panel__label text-secondary">Белки, г</span>
          <input
            type="text"
            inputMode="decimal"
            className="meal-panel__input"
            value={form.proteinInput}
            disabled={busy || analyzing}
            onChange={(event) => setForm((current) => ({ ...current, proteinInput: event.target.value }))}
          />
        </label>
        <label className="meal-panel__field">
          <span className="meal-panel__label text-secondary">Жиры, г</span>
          <input
            type="text"
            inputMode="decimal"
            className="meal-panel__input"
            value={form.fatInput}
            disabled={busy || analyzing}
            onChange={(event) => setForm((current) => ({ ...current, fatInput: event.target.value }))}
          />
        </label>
        <label className="meal-panel__field">
          <span className="meal-panel__label text-secondary">Углеводы, г</span>
          <input
            type="text"
            inputMode="decimal"
            className="meal-panel__input"
            value={form.carbsInput}
            disabled={busy || analyzing}
            onChange={(event) => setForm((current) => ({ ...current, carbsInput: event.target.value }))}
          />
        </label>
      </div>
    </div>
  );

  const renderDishEditor = () => (
    <div className="meal-panel__fields">
      <label className="meal-panel__field">
        <span className="meal-panel__label text-secondary">Блюдо</span>
        <input
          type="text"
          className="meal-panel__input"
          value={form.title}
          disabled={busy || analyzing}
          onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
        />
      </label>

      <div className="meal-panel__dish-editor">
        <p className="meal-panel__dish-editor-title text-secondary">Компоненты — поправьте вес, ккал пересчитаются</p>
        <ul className="meal-panel__dish-list">
          {dishRows.map((row) => {
            const nutrition = mealDishRowNutrition(row);
            return (
              <li key={row.key} className="meal-panel__dish-row">
                <div className="meal-panel__dish-main">
                  <span className="meal-panel__dish-name">{row.name}</span>
                  <span className="meal-panel__dish-kcal">
                    {nutrition ? `${formatMealCalories(nutrition.calories_kcal)} ккал` : "—"}
                  </span>
                </div>
                <WheelNumberPicker
                  value={dishRowWeightG(row)}
                  onChange={(weightG) => handleDishWeightChange(row.key, weightG)}
                  min={0}
                  max={MAX_DISH_WEIGHT_G}
                  step={1}
                  unit="г"
                  ariaLabel={`Вес: ${row.name}`}
                  disabled={busy || analyzing}
                />
              </li>
            );
          })}
        </ul>
      </div>

      {totals ? (
        <div className="meal-panel__totals">
          <p className="meal-panel__totals-line">
            <span>Итого</span>
            <strong>
              {formatMealWeightInput(totals.weight_g)} г · {formatMealCalories(totals.calories_kcal)} ккал
            </strong>
          </p>
          {totals.protein_g != null || totals.carbs_g != null || totals.fat_g != null ? (
            <p className="meal-panel__totals-macros text-secondary">
              Б {formatMealMacroInput(totals.protein_g) || "—"} / Ж {formatMealMacroInput(totals.fat_g) || "—"} / У{" "}
              {formatMealMacroInput(totals.carbs_g) || "—"}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );

  return (
    <section className={`meal-panel${embedded ? " meal-panel--embedded" : ""}`}>
      {!embedded ? (
        <div className="meal-panel__header">
          <h2 className="meal-panel__title">Питание</h2>
          {entries.length > 0 ? (
            <p className="meal-panel__today text-secondary">
              Последняя запись: <strong>{formatMealCalories(entries[0].calories_kcal)} ккал</strong>
            </p>
          ) : null}
        </div>
      ) : entries.length > 0 ? (
        <p className="meal-panel__today text-secondary">
          Последняя запись: <strong>{formatMealCalories(entries[0].calories_kcal)} ккал</strong>
        </p>
      ) : null}

      {loading ? <p className="text-muted">Загрузка…</p> : null}

      {showForm ? (
        <div className="meal-panel__form">
          {mode === "choose" ? (
            <>
              <p className="meal-panel__hint text-secondary">Как добавить приём пищи?</p>
              <div className="meal-panel__mode-actions">
                <button
                  type="button"
                  className="btn btn-outline btn-outline--primary"
                  disabled={busy || analyzing}
                  onClick={() => {
                    setMode("manual");
                    setForm(EMPTY_FORM);
                    setAnalysis(null);
                    setDishRows([]);
                  }}
                >
                  Вручную
                </button>
                <button
                  type="button"
                  className="btn btn-outline btn-outline--primary meal-panel__ai-btn"
                  disabled={busy || analyzing}
                  onClick={() => fileInputRef.current?.click()}
                >
                  Через ИИ ✨
                </button>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="meal-panel__file-input"
                onChange={(event) => void handlePhotoSelected(event.target.files?.[0] ?? null)}
              />
            </>
          ) : null}

          {analyzing ? (
            <div className="meal-panel__progress">
              <div className="meal-panel__spinner" aria-hidden="true" />
              <p>Распознаём блюдо…</p>
            </div>
          ) : null}

          {(mode === "manual" || mode === "review") && !analyzing ? (
            <>
              {analysis ? (
                <div className="meal-panel__analysis">
                  <p className="meal-panel__analysis-title">Результат ИИ</p>
                  <p className="meal-panel__analysis-summary">{analysis.summary}</p>
                  {analysis.portion_note ? (
                    <p className="meal-panel__analysis-note text-secondary">{analysis.portion_note}</p>
                  ) : null}
                </div>
              ) : null}
              {hasDishEditor ? renderDishEditor() : renderManualFields()}
              <div className="meal-panel__form-actions">
                <button
                  type="button"
                  className="btn btn-outline btn-outline--primary"
                  disabled={busy}
                  onClick={() => void handleSave()}
                >
                  {busy ? "Сохраняем…" : "Записать"}
                </button>
                <button type="button" className="btn btn-outline" disabled={busy} onClick={resetForm}>
                  Отмена
                </button>
              </div>
            </>
          ) : null}
        </div>
      ) : (
        <button
          type="button"
          className="btn btn-outline btn-outline--primary btn--block"
          disabled={loading || busy}
          onClick={() => {
            setShowForm(true);
            setMode("choose");
            setError(null);
          }}
        >
          Добавить питание
        </button>
      )}

      {error ? <p className="auth-error meal-panel__error">{error}</p> : null}

      {!loading ? (
        <div className="meal-panel__history">
          <h3 className="meal-panel__history-title">История за последний месяц</h3>
          {entries.length === 0 ? (
            <p className="text-secondary meal-panel__history-empty">
              За последние {MEAL_HISTORY_DAYS} дней записей нет.
            </p>
          ) : (
            <ul className="meal-panel__history-list">
              {entries.map((entry) => (
                <li key={entry.id} className="meal-panel__history-item">
                  <div className="meal-panel__history-main">
                    <span className="meal-panel__history-name">{entry.title || "Блюдо"}</span>
                    <span className="meal-panel__history-kcal">{formatMealCalories(entry.calories_kcal)} ккал</span>
                  </div>
                  <div className="meal-panel__history-meta text-secondary">
                    <span>{formatMealDateTime(entry.entry_at)}</span>
                    {entry.source === "ai" ? <span> · ИИ</span> : null}
                    {entry.protein_g != null || entry.carbs_g != null || entry.fat_g != null ? (
                      <span>
                        {" "}
                        · Б {entry.protein_g ?? "—"} / Ж {entry.fat_g ?? "—"} / У {entry.carbs_g ?? "—"}
                      </span>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </section>
  );
}
