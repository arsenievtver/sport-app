import { useCallback, useEffect, useId, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { fetchAthleteStreak } from "@sport-app/api-client";
import {
  STREAK_MEDAL_ASSETS,
  type AthleteStreak,
  type StreakMedalId,
} from "@sport-app/shared";
import { useCountUp, useLiveDataRefresh, useModalScrollIsolation } from "@sport-app/ui";
import "./streak-panel.css";

interface AthleteStreakPanelProps {
  refreshKey?: string | number;
  onOpenHallOfFame: () => void;
}

function nextMedalAsset(streak: AthleteStreak) {
  const next = streak.medals.find((medal) => medal.is_next);
  const id = (next?.id ?? "streak-1m") as StreakMedalId;
  return STREAK_MEDAL_ASSETS[id] ?? STREAK_MEDAL_ASSETS["streak-1m"];
}

function StreakRulesModal({
  open,
  streak,
  onClose,
  onOpenHallOfFame,
}: {
  open: boolean;
  streak: AthleteStreak | null;
  onClose: () => void;
  onOpenHallOfFame: () => void;
}) {
  const modalRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useModalScrollIsolation(open, modalRef);

  if (!open || typeof document === "undefined") return null;

  const plan = streak?.workouts_per_week ?? 2;

  return createPortal(
    <div
      ref={modalRef}
      className="streak-rules-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <button type="button" className="streak-rules-modal__backdrop" aria-label="Закрыть" onClick={onClose} />
      <div className="streak-rules-modal__sheet glass glass--panel">
        <header className="streak-rules-modal__header">
          <h2 id={titleId} className="streak-rules-modal__title">
            Серия без перерыва
          </h2>
          <button type="button" className="streak-rules-modal__close" aria-label="Закрыть" onClick={onClose}>
            ×
          </button>
        </header>
        <div className="streak-rules-modal__body">
          <p>
            Считаются только тренировки, которые <strong>отметил тренер</strong> как прошедшие. Самостоятельные
            записи в серию не входят.
          </p>
          <p>
            В плане — <strong>{plan}</strong>{" "}
            {plan === 1 ? "тренировка" : plan < 5 ? "тренировки" : "тренировок"} в неделю. Как только неделя
            набирает это число, серия растёт на +1.
          </p>
          <ul className="streak-rules-modal__list">
            <li>
              <strong>4 недели</strong> — медаль «1 месяц»
            </li>
            <li>
              <strong>12 недель</strong> — «3 месяца»
            </li>
            <li>
              <strong>26 недель</strong> — «6 месяцев»
            </li>
            <li>
              <strong>52 недели</strong> — «1 год»
            </li>
          </ul>
          <p>
            Если неделя закрылась без плана — текущая серия обнуляется. Рекорд сохраняется. Долгая серия
            складывает медали: ×2, ×5 и т.д.
          </p>
          <button
            type="button"
            className="btn btn-solid btn-solid--primary streak-rules-modal__cta"
            onClick={() => {
              onClose();
              onOpenHallOfFame();
            }}
          >
            Открыть зал славы
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export function AthleteStreakPanel({ refreshKey, onOpenHallOfFame }: AthleteStreakPanelProps) {
  const [streak, setStreak] = useState<AthleteStreak | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rulesOpen, setRulesOpen] = useState(false);

  const load = useCallback(async (options?: { silent?: boolean }) => {
    if (!options?.silent) setLoading(true);
    setError(null);
    try {
      const data = await fetchAthleteStreak();
      setStreak(data);
    } catch (err) {
      if (!options?.silent) {
        setError(err instanceof Error ? err.message : "Ошибка загрузки");
      }
    } finally {
      if (!options?.silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  useLiveDataRefresh(() => load({ silent: true }));

  const animatedCurrent = useCountUp(streak?.current_streak_weeks ?? 0, {
    enabled: Boolean(streak) && !loading,
    delay: 120,
    duration: 900,
  });
  const animatedPercent = useCountUp(streak?.progress_percent ?? 0, {
    enabled: Boolean(streak) && !loading,
    delay: 180,
    duration: 1100,
  });

  if (loading && !streak) {
    return (
      <div className="athlete-home-section athlete-home-enter" style={{ "--enter-delay": "40ms" } as CSSProperties}>
        <p className="text-muted" style={{ margin: 0 }}>
          Серия…
        </p>
      </div>
    );
  }

  if (error && !streak) {
    return null;
  }

  if (!streak) return null;

  const asset = nextMedalAsset(streak);
  const nextMedal = streak.medals.find((medal) => medal.is_next) ?? streak.medals[0];
  const revealNextArt = Boolean(nextMedal?.unlocked || streak.medals_preview_unlock_all);
  const weeksLeft = Math.max(0, streak.next_threshold_weeks - streak.current_streak_weeks);

  return (
    <div
      className="athlete-home-section athlete-home-enter streak-panel-wrap"
      style={{ "--enter-delay": "40ms" } as CSSProperties}
    >
      <div className="streak-panel__heading">
        <h2 className="athlete-home-section__title">До награды</h2>
        <button
          type="button"
          className="streak-panel__info"
          aria-label="Правила серии"
          onClick={() => setRulesOpen(true)}
        >
          !
        </button>
      </div>

      <section className="streak-panel" style={{ "--streak-glow": asset.glow } as CSSProperties}>
        <div className="streak-panel__body">
          <div className="streak-panel__meta">
            <span className="streak-panel__label">{asset.title}</span>
            <span className="streak-panel__stat">
              <strong>{animatedCurrent}</strong>
              <span className="text-muted"> / {streak.next_threshold_weeks} нед</span>
            </span>
          </div>

          <div
            className="streak-panel__track"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={streak.progress_percent}
            aria-label="Прогресс до следующей награды"
          >
            <span className="streak-panel__fill" style={{ width: `${animatedPercent}%` }} />
            <span className="streak-panel__shine" aria-hidden="true" />
          </div>

          <div className="streak-panel__footer text-muted">
            {weeksLeft === 0 ? (
              <span>Награда уже в серии — смотри зал славы</span>
            ) : (
              <span>
                Ещё {weeksLeft}{" "}
                {weeksLeft === 1 ? "неделя" : weeksLeft < 5 ? "недели" : "недель"}
                {streak.current_week_met ? " · эта неделя засчитана" : ""}
              </span>
            )}
            <span className="streak-panel__best">Рекорд: {streak.best_streak_weeks} нед</span>
          </div>
        </div>

        <button
          type="button"
          className="streak-panel__medal-btn"
          onClick={onOpenHallOfFame}
          aria-label={`Зал славы: следующая награда ${asset.title}`}
        >
          <span className="streak-panel__medal-aura" aria-hidden="true" />
          {revealNextArt ? (
            <img className="streak-panel__medal" src={asset.src} alt="" width={72} height={90} decoding="async" />
          ) : (
            <span
              className="streak-panel__silhouette"
              style={
                {
                  WebkitMaskImage: `url(${asset.src})`,
                  maskImage: `url(${asset.src})`,
                } as CSSProperties
              }
              aria-hidden="true"
            />
          )}
        </button>
      </section>

      <StreakRulesModal
        open={rulesOpen}
        streak={streak}
        onClose={() => setRulesOpen(false)}
        onOpenHallOfFame={onOpenHallOfFame}
      />
    </div>
  );
}
