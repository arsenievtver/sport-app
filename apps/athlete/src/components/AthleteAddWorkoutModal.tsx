import { useEffect } from "react";
import { AthleteAddWorkoutPanel } from "./AthleteAddWorkoutPanel";

interface AthleteAddWorkoutModalProps {
  open: boolean;
  refreshKey?: string;
  onClose: () => void;
  onWorkoutAdded?: (sessionsCompleted: number) => void;
  onGoToWeightData?: () => void;
}

export function AthleteAddWorkoutModal({
  open,
  refreshKey,
  onClose,
  onWorkoutAdded,
  onGoToWeightData,
}: AthleteAddWorkoutModalProps) {
  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  return (
    <div className="workout-modal" role="dialog" aria-modal="true" aria-labelledby="workout-modal-title">
      <button
        type="button"
        className="workout-modal__backdrop"
        aria-label="Закрыть"
        onClick={onClose}
      />
      <div className="workout-modal__sheet glass glass--panel">
        <header className="workout-modal__header">
          <h2 id="workout-modal-title" className="workout-modal__title">
            Добавить тренировку
          </h2>
          <button type="button" className="workout-modal__close" aria-label="Закрыть" onClick={onClose}>
            ×
          </button>
        </header>
        <AthleteAddWorkoutPanel
          refreshKey={refreshKey}
          embedded
          onGoToWeightData={onGoToWeightData}
          onWorkoutAdded={(sessionsCompleted) => {
            onWorkoutAdded?.(sessionsCompleted);
            onClose();
          }}
        />
      </div>
    </div>
  );
}
