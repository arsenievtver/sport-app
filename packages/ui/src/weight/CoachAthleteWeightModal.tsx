import { useCallback, useEffect, useMemo, useState } from "react";
import {
  addCoachAthleteWeightMeasurement,
  fetchCoachAthleteWeightDynamics,
} from "@sport-app/api-client";
import type { AthleteWeightDynamics, CoachAthleteWeightMeasurementResponse } from "@sport-app/shared";
import {
  formatWeightKg,
  formatWeightMeasurementDate,
  isValidWeightKg,
  parseWeightInput,
  WEIGHT_KG_MAX,
  WEIGHT_KG_MIN,
} from "@sport-app/shared";
import { useVisualViewportBottomInset } from "../hooks/useVisualViewportBottomInset";
import { WeightChart } from "./WeightChart";

interface CoachAthleteWeightModalProps {
  athleteId: string;
  athleteName: string;
  onClose: () => void;
  onSaved?: (saved: CoachAthleteWeightMeasurementResponse) => void;
}

function formatWeightBounds(min?: number | null, max?: number | null): string {
  if (min != null && max != null) {
    return `${formatWeightKg(min)}–${formatWeightKg(max)} кг`;
  }
  return "не указаны";
}

export function CoachAthleteWeightModal({
  athleteId,
  athleteName,
  onClose,
  onSaved,
}: CoachAthleteWeightModalProps) {
  const [dynamics, setDynamics] = useState<AthleteWeightDynamics | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [weightInput, setWeightInput] = useState("");
  const [savedInSession, setSavedInSession] = useState(false);
  const keyboardInset = useVisualViewportBottomInset(true);

  const loadDynamics = useCallback(async (options?: { silent?: boolean }) => {
    if (!options?.silent) {
      setLoading(true);
    }
    setError(null);
    try {
      const data = await fetchCoachAthleteWeightDynamics(athleteId);
      setDynamics(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось загрузить данные о весе");
    } finally {
      if (!options?.silent) {
        setLoading(false);
      }
    }
  }, [athleteId]);

  useEffect(() => {
    setSavedInSession(false);
    setWeightInput("");
    void loadDynamics();
  }, [loadDynamics]);

  const lastEntry = useMemo(() => {
    if (!dynamics || dynamics.entries.length === 0) return null;
    return dynamics.entries[dynamics.entries.length - 1];
  }, [dynamics]);

  const handleClose = () => {
    if (busy) return;
    onClose();
  };

  const handleSave = async () => {
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
      const saved = await addCoachAthleteWeightMeasurement({
        athlete_id: athleteId,
        weight_kg: parsed,
      });
      await loadDynamics({ silent: true });
      setWeightInput("");
      setSavedInSession(true);
      onSaved?.(saved);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось сохранить измерение");
    } finally {
      setBusy(false);
    }
  };

  const handlePrimaryAction = () => {
    if (savedInSession) {
      handleClose();
      return;
    }
    void handleSave();
  };

  return (
    <div
      className="schedule-sheet-backdrop coach-home-weight-backdrop"
      role="presentation"
      style={keyboardInset > 0 ? { paddingBottom: keyboardInset } : undefined}
      onClick={handleClose}
    >
      <div
        className="schedule-sheet coach-home-weight-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="coach-home-weight-title"
        style={
          keyboardInset > 0
            ? { maxHeight: `min(560px, calc(100dvh - ${keyboardInset + 32}px))` }
            : undefined
        }
        onClick={(event) => event.stopPropagation()}
      >
        <div className="schedule-sheet__header">
          <div className="schedule-sheet__heading">
            <h2 className="schedule-sheet__title" id="coach-home-weight-title">
              Измерение веса
            </h2>
            <p className="schedule-sheet__subtitle">{athleteName}</p>
          </div>
          <button
            type="button"
            className="schedule-sheet__close"
            aria-label="Закрыть"
            disabled={busy}
            onClick={handleClose}
          >
            ×
          </button>
        </div>

        <div className="schedule-sheet__body">
          {loading ? (
            <p className="text-muted coach-home-weight-sheet__loading">Загрузка данных о весе…</p>
          ) : (
            <>
              <div className="coach-home-weight-sheet__summary">
                <p className="coach-home-weight-sheet__current">
                  Текущий вес:{" "}
                  <strong>
                    {dynamics?.current_weight_kg != null
                      ? `${formatWeightKg(dynamics.current_weight_kg)} кг`
                      : "—"}
                  </strong>
                </p>
                <p className="coach-home-weight-sheet__date text-secondary">
                  Дата измерения:{" "}
                  {lastEntry ? formatWeightMeasurementDate(lastEntry.entry_date) : "нет данных"}
                </p>
              </div>

              <WeightChart
                entries={dynamics?.entries ?? []}
                targetMin={dynamics?.weight_target_min_kg}
                targetMax={dynamics?.weight_target_max_kg}
                emptyMessage="Пока нет измерений — график появится после первой записи."
              />

              <p className="coach-home-weight-sheet__bounds text-secondary">
                Границы веса:{" "}
                <strong>
                  {formatWeightBounds(dynamics?.weight_target_min_kg, dynamics?.weight_target_max_kg)}
                </strong>
              </p>
            </>
          )}
        </div>

        <div className="schedule-sheet__actions coach-home-weight-sheet__footer">
          <label className="schedule-sheet__field">
            <span className="schedule-sheet__field-label">Вес, кг</span>
            <input
              className="glass-input schedule-sheet__select"
              type="text"
              inputMode="decimal"
              value={weightInput}
              disabled={busy || loading || savedInSession}
              placeholder="Например, 72,5"
              onChange={(event) => setWeightInput(event.target.value)}
            />
          </label>

          <button
            type="button"
            className="coach-btn coach-btn--primary schedule-sheet__submit"
            disabled={busy || loading}
            onClick={handlePrimaryAction}
          >
            {busy ? "Сохраняем…" : savedInSession ? "Закрыть" : "Сохранить"}
          </button>

          {error ? <p className="auth-error coach-home-weight-sheet__error">{error}</p> : null}
        </div>
      </div>
    </div>
  );
}
