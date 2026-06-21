import { useCallback, useEffect, useRef, useState } from "react";
import { analyzeAthleteMealPhoto, createAthleteMealEntry, fetchAthleteMeals } from "@sport-app/api-client";
import type { AthleteMealEntry, MealAnalysisResult } from "@sport-app/shared";
import {
  compressMealPhoto,
  formatMealCalories,
  formatMealDateTime,
  isValidMealCalories,
  parseMealNumberInput,
} from "@sport-app/shared";

type FormMode = "choose" | "manual" | "ai" | "review";

interface MealFormState {
  title: string;
  caloriesInput: string;
  weightInput: string;
  proteinInput: string;
  carbsInput: string;
  fatInput: string;
  source: "manual" | "ai";
  logmealImageId: number | null;
  aiAnalysis: Record<string, unknown> | null;
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
  aiAnalysis: null,
};

function formFromAnalysis(analysis: MealAnalysisResult): MealFormState {
  return {
    title: analysis.title,
    caloriesInput: String(Math.round(analysis.calories_kcal)),
    weightInput: analysis.weight_g != null ? String(analysis.weight_g) : "",
    proteinInput: analysis.protein_g != null ? String(analysis.protein_g) : "",
    carbsInput: analysis.carbs_g != null ? String(analysis.carbs_g) : "",
    fatInput: analysis.fat_g != null ? String(analysis.fat_g) : "",
    source: "ai",
    logmealImageId: analysis.logmeal_image_id ?? null,
    aiAnalysis: analysis.raw,
  };
}

function optionalNumber(raw: string): number | null {
  const parsed = parseMealNumberInput(raw);
  return parsed == null ? null : parsed;
}

export function AthleteMealsPanel() {
  const [entries, setEntries] = useState<AthleteMealEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [mode, setMode] = useState<FormMode>("choose");
  const [analysis, setAnalysis] = useState<MealAnalysisResult | null>(null);
  const [form, setForm] = useState<MealFormState>(EMPTY_FORM);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadEntries = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchAthleteMeals();
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

  const resetForm = () => {
    setShowForm(false);
    setMode("choose");
    setAnalysis(null);
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
      setAnalysis(result);
      setForm(formFromAnalysis(result));
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
        ai_analysis: form.aiAnalysis,
      });
      setEntries((current) => [entry, ...current]);
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось сохранить запись");
    } finally {
      setBusy(false);
    }
  };

  const renderFormFields = () => (
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

  return (
    <section className="meal-panel">
      <div className="meal-panel__header">
        <h2 className="meal-panel__title">Питание</h2>
        {entries.length > 0 ? (
          <p className="meal-panel__today text-secondary">
            Последняя запись: <strong>{formatMealCalories(entries[0].calories_kcal)} ккал</strong>
          </p>
        ) : null}
      </div>

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
                  {analysis.dishes.length > 0 ? (
                    <ul className="meal-panel__dishes">
                      {analysis.dishes.map((dish) => (
                        <li key={dish.name}>
                          {dish.name}
                          {dish.confidence != null ? ` (${Math.round(dish.confidence * 100)}%)` : ""}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              ) : null}
              {renderFormFields()}
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

          {mode === "ai" && analyzing ? null : null}
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
          <h3 className="meal-panel__history-title">История</h3>
          {entries.length === 0 ? (
            <p className="text-secondary meal-panel__history-empty">Пока нет записей о питании.</p>
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
