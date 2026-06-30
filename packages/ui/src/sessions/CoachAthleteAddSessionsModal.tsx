import { useState } from "react";
import { addCoachAthleteSessions } from "@sport-app/api-client";
import type { CoachAthleteSessionsResponse } from "@sport-app/shared";

import { WheelNumberPicker } from "../wheel/WheelNumberPicker";

const DEFAULT_COUNT = 10;
const MIN_COUNT = 1;
const MAX_COUNT = 30;

interface CoachAthleteAddSessionsModalProps {
  athleteId: string;
  athleteName: string;
  currentBalance: number;
  onClose: () => void;
  onAdded: (result: CoachAthleteSessionsResponse, count: number) => void;
}

export function CoachAthleteAddSessionsModal({
  athleteId,
  athleteName,
  currentBalance,
  onClose,
  onAdded,
}: CoachAthleteAddSessionsModalProps) {
  const [count, setCount] = useState(DEFAULT_COUNT);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClose = () => {
    if (busy) return;
    onClose();
  };

  const handleAdd = async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await addCoachAthleteSessions({ athlete_id: athleteId, count });
      onAdded(result, count);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось добавить тренировки");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="schedule-sheet-backdrop coach-athletes-sessions-backdrop"
      role="presentation"
      onClick={handleClose}
    >
      <div
        className="schedule-sheet coach-athletes-sessions-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="coach-athletes-sessions-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="schedule-sheet__body">
          <div className="schedule-sheet__header">
            <div className="schedule-sheet__heading">
              <h2 className="schedule-sheet__title" id="coach-athletes-sessions-title">
                Добавить тренировки
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

          <p className="coach-athletes-sessions-sheet__balance text-secondary">
            Сейчас на балансе: <strong>{currentBalance}</strong>
          </p>

          <div className="coach-athletes-sessions-sheet__picker">
            <p className="coach-athletes-sessions-sheet__picker-label">Сколько добавить</p>
            <WheelNumberPicker
              value={count}
              onChange={setCount}
              min={MIN_COUNT}
              max={MAX_COUNT}
              step={1}
              ariaLabel="Количество тренировок"
              disabled={busy}
            />
          </div>

          <button
            type="button"
            className="coach-btn coach-btn--primary schedule-sheet__submit"
            disabled={busy}
            onClick={() => void handleAdd()}
          >
            {busy ? "Добавляем…" : "Добавить"}
          </button>

          {busy ? (
            <p className="coach-athletes-sessions-sheet__hint text-secondary">
              Подождите — не нажимайте повторно, пока идёт отправка.
            </p>
          ) : null}

          {error ? <p className="auth-error coach-athletes-sessions-sheet__error">{error}</p> : null}
        </div>
      </div>
    </div>
  );
}
