import { useCallback, useEffect, useRef, useState } from "react";
import {
  analyzeAthleteMealPhoto,
  confirmAthleteMealDishes,
  createAthleteMealEntry,
  fetchAthleteMealCatalogStats,
  fetchAthleteMealDishNutrition,
  fetchAthleteMeals,
} from "@sport-app/api-client";
import type {
  AthleteMealEntry,
  MealAnalysisResult,
  MealCatalogStats,
  MealDishCandidate,
  MealDishEditorRow,
  MealDishSearchItem,
  MealNutritionBaseline,
} from "@sport-app/shared";
import { WheelNumberPicker } from "@sport-app/ui";
import {
  MEAL_ANALYSIS_LOADING_INTERVAL_MS,
  MEAL_ANALYSIS_LOADING_MESSAGES,
  MEAL_HISTORY_DAYS,
  compressMealPhoto,
  formatMealCalories,
  formatMealDateTime,
  formatMealCatalogSyncedAt,
  formatMealMacroInput,
  formatMealWeightInput,
  isValidMealCalories,
  mealConfirmItemsFromRows,
  mealDishEditorRowFromPreview,
  mealDishEditorRowsFromAnalysis,
  mealDishRowNutrition,
  mealNutritionToFormInputs,
  parseMealNumberInput,
  sumMealDishRows,
} from "@sport-app/shared";
import { MealDishSearchPicker } from "./MealDishSearchPicker";
import { ManualMealForm, type ManualMealSavePayload } from "./ManualMealForm";

type FormMode = "manual" | "ai" | "review";

const MAX_DISH_WEIGHT_G = 2000;

function useRotatingMessage(messages: readonly string[], active: boolean, intervalMs: number): string {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (!active) {
      setIndex(0);
      return;
    }

    const timer = window.setInterval(() => {
      setIndex((current) => (current + 1) % messages.length);
    }, intervalMs);

    return () => window.clearInterval(timer);
  }, [active, intervalMs, messages]);

  return messages[index] ?? messages[0];
}

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
        name_en: row.name_en ?? null,
        logmeal_dish_id: row.logmeal_dish_id ?? null,
        food_item_position: row.food_item_position ?? null,
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
  const [mode, setMode] = useState<FormMode>("manual");
  const [analysis, setAnalysis] = useState<MealAnalysisResult | null>(null);
  const [dishRows, setDishRows] = useState<MealDishEditorRow[]>([]);
  const [form, setForm] = useState<MealFormState>(EMPTY_FORM);
  const [catalogStats, setCatalogStats] = useState<MealCatalogStats | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const analysisLoadingMessage = useRotatingMessage(
    MEAL_ANALYSIS_LOADING_MESSAGES,
    analyzing,
    MEAL_ANALYSIS_LOADING_INTERVAL_MS,
  );

  const applyAnalysisResult = useCallback((result: MealAnalysisResult) => {
    const rows = mealDishEditorRowsFromAnalysis(result.dishes);
    setAnalysis(result);
    setDishRows(rows);
    setForm(formFromAnalysis(result, rows));
  }, []);

  const confirmAndApply = useCallback(
    async (rows: MealDishEditorRow[]) => {
      if (!analysis?.logmeal_image_id) {
        applyDishRows(rows);
        return;
      }

      const segmentation = analysis.raw?.segmentation;
      if (!segmentation || typeof segmentation !== "object") {
        applyDishRows(rows);
        return;
      }

      const items = mealConfirmItemsFromRows(rows);
      if (items.length === 0) {
        applyDishRows(rows);
        return;
      }

      setBusy(true);
      setError(null);
      try {
        const result = await confirmAthleteMealDishes({
          logmeal_image_id: analysis.logmeal_image_id,
          segmentation: segmentation as Record<string, unknown>,
          items,
        });
        applyAnalysisResult(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Не удалось обновить состав блюда");
        applyDishRows(rows);
      } finally {
        setBusy(false);
      }
    },
    [analysis, applyAnalysisResult],
  );

  const loadCatalogStats = useCallback(async () => {
    try {
      const stats = await fetchAthleteMealCatalogStats();
      setCatalogStats(stats);
    } catch {
      setCatalogStats(null);
    }
  }, []);

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
    void loadCatalogStats();
  }, [loadEntries, loadCatalogStats]);

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
    setMode("manual");
    setAnalysis(null);
    setDishRows([]);
    setForm(EMPTY_FORM);
    setError(null);
  };

  const openManualForm = () => {
    setShowForm(true);
    setMode("manual");
    setForm(EMPTY_FORM);
    setAnalysis(null);
    setDishRows([]);
    setError(null);
  };

  const handlePhotoSelected = async (file: File | null) => {
    if (!file) return;

    setShowForm(true);
    setAnalyzing(true);
    setError(null);
    setMode("ai");
    try {
      const compressed = await compressMealPhoto(file);
      const result = await analyzeAthleteMealPhoto(compressed);
      applyAnalysisResult(result);
      setMode("review");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось распознать фото");
      setShowForm(false);
      setMode("manual");
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

  const handlePickCandidate = async (rowKey: string, candidate: MealDishCandidate) => {
    const nextRows = dishRows.map((row) =>
      row.key === rowKey
        ? {
            ...row,
            name: candidate.name,
            name_en: candidate.name_en ?? candidate.name,
            logmeal_dish_id: candidate.logmeal_dish_id,
          }
        : row,
    );
    await confirmAndApply(nextRows);
  };

  const handleReplaceDishFromSearch = async (rowKey: string, item: MealDishSearchItem) => {
    setBusy(true);
    setError(null);
    try {
      const dish = await fetchAthleteMealDishNutrition(item.logmeal_dish_id);
      const nextRows = dishRows.map((row) => {
        if (row.key !== rowKey) return row;
        const updated = mealDishEditorRowFromPreview(
          {
            ...dish,
            food_item_position: row.food_item_position,
            candidates: row.candidates,
          },
          0,
        );
        return updated ? { ...updated, key: row.key } : row;
      });
      await confirmAndApply(nextRows);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось загрузить блюдо");
    } finally {
      setBusy(false);
    }
  };

  const handleAddDishComponent = async (item: MealDishSearchItem) => {
    setBusy(true);
    setError(null);
    try {
      const dish = await fetchAthleteMealDishNutrition(item.logmeal_dish_id);
      const newRow = mealDishEditorRowFromPreview(
        {
          ...dish,
          food_item_position: `added-${Date.now()}`,
        },
        dishRows.length,
      );
      if (!newRow) return;
      await confirmAndApply([...dishRows, newRow]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось добавить компонент");
    } finally {
      setBusy(false);
    }
  };

  const handleManualSave = async (payload: ManualMealSavePayload) => {
    setBusy(true);
    setError(null);
    try {
      const entry = await createAthleteMealEntry({
        title: payload.title,
        calories_kcal: payload.calories_kcal,
        weight_g: payload.weight_g,
        source: "manual",
        logmeal_image_id: null,
        ai_analysis:
          payload.components.length > 0
            ? {
                manual_components: payload.components.map((item) => ({
                  name: item.name,
                  calories_kcal: item.calories_kcal,
                  weight_g: item.weight_g,
                  logmeal_dish_id: item.logmeal_dish_id,
                })),
              }
            : null,
      });
      setEntries((current) => [entry, ...current]);
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось сохранить запись");
    } finally {
      setBusy(false);
    }
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
        <p className="meal-panel__dish-editor-title text-secondary">
          {dishRows.length > 1
            ? `Найдено компонентов: ${dishRows.length} — поправьте вес каждого`
            : "Компоненты — поправьте вес, ккал пересчитаются"}
        </p>
        <ul className="meal-panel__dish-list">
          {dishRows.map((row) => {
            const nutrition = mealDishRowNutrition(row);
            const otherCandidates = (row.candidates ?? []).filter(
              (candidate) => candidate.logmeal_dish_id !== row.logmeal_dish_id,
            );
            return (
              <li key={row.key} className="meal-panel__dish-row">
                <div className="meal-panel__dish-main">
                  <span className="meal-panel__dish-name">{row.name}</span>
                  <span className="meal-panel__dish-kcal">
                    {nutrition ? `${formatMealCalories(nutrition.calories_kcal)} ккал` : "—"}
                  </span>
                </div>
                {otherCandidates.length > 0 ? (
                  <div className="meal-panel__dish-candidates">
                    <span className="meal-panel__dish-candidates-label text-secondary">Варианты ИИ:</span>
                    <div className="meal-panel__dish-candidates-list">
                      {otherCandidates.map((candidate) => (
                        <button
                          key={candidate.logmeal_dish_id}
                          type="button"
                          className="meal-panel__dish-candidate"
                          disabled={busy || analyzing}
                          onClick={() => void handlePickCandidate(row.key, candidate)}
                        >
                          {candidate.name}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}
                <MealDishSearchPicker
                  label="Заменить на другое из базы"
                  placeholder="поиск…"
                  disabled={busy || analyzing}
                  catalogDishCount={catalogStats?.dish_count ?? null}
                  onSelect={(item) => void handleReplaceDishFromSearch(row.key, item)}
                />
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
        {analysis?.logmeal_image_id ? (
          <div className="meal-panel__add-dish">
            <MealDishSearchPicker
              label="Добавить компонент из базы"
              placeholder="что ещё на тарелке?"
              disabled={busy || analyzing}
              catalogDishCount={catalogStats?.dish_count ?? null}
              onSelect={(item) => void handleAddDishComponent(item)}
            />
          </div>
        ) : null}
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
          <div className="meal-panel__header-side">
            {catalogStats ? (
              <p className="meal-panel__catalog-stat">
                В базе: <strong>{catalogStats.dish_count}</strong> блюд
                {catalogStats.search_ready ? (
                  <span className="meal-panel__catalog-meta"> · обновлено {formatMealCatalogSyncedAt(catalogStats.synced_at)}</span>
                ) : (
                  <span className="meal-panel__catalog-meta"> · поиск пока недоступен</span>
                )}
              </p>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="meal-panel__embedded-meta">
          {catalogStats ? (
            <p className="meal-panel__catalog-stat">
              В базе: <strong>{catalogStats.dish_count}</strong> блюд
            </p>
          ) : null}
        </div>
      )}

      {loading ? <p className="text-muted">Загрузка…</p> : null}

      {!showForm ? (
        <div className="meal-panel__mode-actions">
          <button
            type="button"
            className="btn btn-outline btn-outline--primary"
            disabled={loading || busy || analyzing}
            onClick={openManualForm}
          >
            Вручную
          </button>
          <button
            type="button"
            className="btn btn-outline btn-outline--primary meal-panel__ai-btn"
            disabled={loading || busy || analyzing}
            onClick={() => fileInputRef.current?.click()}
          >
            Через ИИ ✨
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="meal-panel__file-input"
            onChange={(event) => void handlePhotoSelected(event.target.files?.[0] ?? null)}
          />
        </div>
      ) : (
        <div className="meal-panel__form">
          {analyzing ? (
            <div className="meal-panel__progress" aria-busy="true">
              <div className="meal-panel__spinner" aria-hidden="true" />
              <p key={analysisLoadingMessage} className="meal-panel__progress-message" aria-live="polite">
                {analysisLoadingMessage}
              </p>
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
              {mode === "manual" ? (
                <ManualMealForm
                  busy={busy}
                  catalogDishCount={catalogStats?.dish_count ?? null}
                  onSave={handleManualSave}
                  onCancel={resetForm}
                />
              ) : hasDishEditor ? (
                <>
                  {renderDishEditor()}
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
            </>
          ) : null}
        </div>
      )}

      {error ? <p className="auth-error meal-panel__error">{error}</p> : null}

      {!loading ? (
        <div className="meal-panel__history">
          <h3 className="meal-panel__history-title">История за последний месяц</h3>
          {entries.length === 0 ? (
            <p className="text-secondary meal-panel__history-empty">Записей пока нет</p>
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
