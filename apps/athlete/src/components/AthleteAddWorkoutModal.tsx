import { useEffect, useRef } from "react";
import { useModalScrollIsolation } from "@sport-app/ui";
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
  const modalRef = useRef<HTMLDivElement>(null);
  useModalScrollIsolation(open, modalRef);

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
    <div
      ref={modalRef}
      className="workout-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="workout-modal-title"
    >
      <button
        type="button"
        className="workout-modal__backdrop"
        aria-label="Закрыть"
        onClick={onClose}
      />
      <div
        className="workout-modal__sheet glass glass--panel"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="workout-modal__header">
          <h2 id="workout-modal-title" className="workout-modal__title">
            Добавить активность
          </h2>
          <button type="button" className="workout-modal__close" aria-label="Закрыть" onClick={onClose}>
            ×
          </button>
        </header>
        <div className="workout-modal__body">
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
    </div>
  );
}
