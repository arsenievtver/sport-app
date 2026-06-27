import { useCallback, useEffect, useState } from "react";
import { addAthleteWeightMeasurement, fetchAthleteWeightDynamics } from "@sport-app/api-client";
import type { AthleteWeightDynamics } from "@sport-app/shared";
import {
  formatWeightKg,
  isValidWeightKg,
  parseWeightInput,
  WEIGHT_KG_MAX,
  WEIGHT_KG_MIN,
} from "@sport-app/shared";
import { WeightChart } from "@sport-app/ui";

export function AthleteWeightDynamicsPanel({
  openFormSignal = 0,
  onMeasurementAdded,
}: {
  /** Инкремент открывает форму (например, переход из «Добавить тренировку»). */
  openFormSignal?: number;
  onMeasurementAdded?: () => void;
} = {}) {
  const [data, setData] = useState<AthleteWeightDynamics | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [weightInput, setWeightInput] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const next = await fetchAthleteWeightDynamics();
      setData(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось загрузить динамику веса");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    if (openFormSignal > 0) {
      setShowForm(true);
      setError(null);
    }
  }, [openFormSignal]);

  const handleAddMeasurement = async () => {
    const parsed = parseWeightInput(weightInput);
    if (parsed == null) {
      setError("Введите вес в килограммах");
      return;
    }
    if (!isValidWeightKg(parsed)) {
      setError(`Вес должен быть от ${WEIGHT_KG_MIN} до ${WEIGHT_KG_MAX} кг`);
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const next = await addAthleteWeightMeasurement({ weight_kg: parsed });
      setData(next);
      setWeightInput("");
      setShowForm(false);
      onMeasurementAdded?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось сохранить измерение");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="weight-dynamics">
      <div className="weight-dynamics__header">
        <h2 className="weight-dynamics__title">Динамика веса</h2>
        {data?.current_weight_kg != null ? (
          <p className="weight-dynamics__current">
            Сейчас <strong>{formatWeightKg(data.current_weight_kg)} кг</strong>
          </p>
        ) : null}
      </div>

      {loading ? <p className="text-muted">Загрузка…</p> : null}
      {!loading && data ? (
        <WeightChart
          entries={data.entries}
          targetMin={data.weight_target_min_kg}
          targetMax={data.weight_target_max_kg}
        />
      ) : null}

      {data?.weight_target_min_kg != null && data?.weight_target_max_kg != null ? (
        <p className="weight-dynamics__target-hint text-secondary">
          Целевой диапазон: {formatWeightKg(data.weight_target_min_kg)}–{formatWeightKg(data.weight_target_max_kg)} кг
        </p>
      ) : null}

      {showForm ? (
        <div className="weight-dynamics__form">
          <label className="weight-dynamics__field">
            <span className="weight-dynamics__label text-secondary">Вес, кг</span>
            <input
              type="text"
              inputMode="decimal"
              className="weight-dynamics__input"
              placeholder="72,4"
              value={weightInput}
              disabled={busy}
              onChange={(event) => setWeightInput(event.target.value)}
            />
          </label>
          <div className="weight-dynamics__form-actions">
            <button
              type="button"
              className="btn btn-outline btn-outline--primary"
              disabled={busy}
              onClick={() => void handleAddMeasurement()}
            >
              {busy ? "Сохраняем…" : "Добавить"}
            </button>
            <button
              type="button"
              className="btn btn-outline"
              disabled={busy}
              onClick={() => {
                setShowForm(false);
                setWeightInput("");
                setError(null);
              }}
            >
              Отмена
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          className="btn btn-outline btn-outline--primary btn--block"
          disabled={loading || busy}
          onClick={() => setShowForm(true)}
        >
          Добавить измерение
        </button>
      )}

      {error ? <p className="auth-error weight-dynamics__error">{error}</p> : null}
    </section>
  );
}
