import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import { fetchAthleteStreak } from "@sport-app/api-client";
import {
  STREAK_MEDAL_ASSETS,
  STREAK_MEDAL_ORDER,
  type AthleteStreak,
  type AthleteStreakMedal,
  type StreakMedalId,
} from "@sport-app/shared";
import { useLiveDataRefresh } from "@sport-app/ui";
import "./hall-of-fame.css";

interface MedalView {
  id: StreakMedalId;
  src: string;
  title: string;
  subtitle: string;
  glow: string;
  weeksRequired: number;
  unlocked: boolean;
  stackCount: number;
  isNext: boolean;
  progressWeeks: number;
  progressPercent: number;
}

function buildMedals(streak: AthleteStreak | null): MedalView[] {
  const byId = new Map((streak?.medals ?? []).map((medal) => [medal.id, medal]));
  const current = streak?.current_streak_weeks ?? 0;

  return STREAK_MEDAL_ORDER.map((id) => {
    const asset = STREAK_MEDAL_ASSETS[id];
    const remote: AthleteStreakMedal | undefined = byId.get(id);
    const weeksRequired = remote?.weeks_required ?? 4;
    const unlocked = remote?.unlocked ?? false;
    const progressWeeks = Math.min(current, weeksRequired);
    const progressPercent =
      weeksRequired <= 0 ? 0 : Math.min(100, Math.round((progressWeeks / weeksRequired) * 100));

    return {
      id,
      ...asset,
      weeksRequired,
      unlocked,
      stackCount: unlocked ? Math.max(1, remote?.stack_count ?? 1) : 0,
      isNext: remote?.is_next ?? false,
      progressWeeks,
      progressPercent,
    };
  });
}

/** Exact medal outline, no artwork details — surprise until unlocked. */
function MedalSilhouette({ src, className }: { src: string; className?: string }) {
  return (
    <span
      className={className ?? "hof-locked__silhouette"}
      style={
        {
          WebkitMaskImage: `url(${src})`,
          maskImage: `url(${src})`,
        } as CSSProperties
      }
      aria-hidden="true"
    />
  );
}

function EarnedMedalCard({ medal, delayMs }: { medal: MedalView; delayMs: number }) {
  return (
    <figure
      className="hof-earned__card"
      style={{ "--medal-glow": medal.glow, "--medal-delay": `${delayMs}ms` } as CSSProperties}
    >
      <div className="hof-earned__stage">
        <span className="hof-earned__aura" aria-hidden="true" />
        <img className="hof-earned__art" src={medal.src} alt="" width={160} height={200} decoding="async" />
        {medal.stackCount > 1 ? (
          <span className="hof-earned__stack" aria-label={`Собрано ${medal.stackCount} раз`}>
            ×{medal.stackCount}
          </span>
        ) : null}
      </div>
      <figcaption className="hof-earned__caption">
        <strong className="hof-earned__title">{medal.title}</strong>
        <span className="hof-earned__subtitle text-muted">{medal.subtitle}</span>
      </figcaption>
    </figure>
  );
}

function LockedMedalCard({ medal, delayMs }: { medal: MedalView; delayMs: number }) {
  return (
    <article
      className={`hof-locked__card${medal.isNext ? " hof-locked__card--next" : ""}`}
      style={{ "--medal-glow": medal.glow, "--medal-delay": `${delayMs}ms` } as CSSProperties}
    >
      <div className="hof-locked__visual">
        <span className="hof-locked__glow" aria-hidden="true" />
        <MedalSilhouette src={medal.src} />
      </div>
      <div className="hof-locked__body">
        <strong className="hof-locked__title">{medal.title}</strong>
        <p className="hof-locked__progress text-muted">
          {medal.progressWeeks} / {medal.weeksRequired} недель подряд
        </p>
        <div
          className="hof-locked__track"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={medal.progressPercent}
          aria-label={`Прогресс до ${medal.title}`}
        >
          <span className="hof-locked__fill" style={{ width: `${medal.progressPercent}%` }} />
        </div>
      </div>
    </article>
  );
}

export function AthleteHallOfFamePanel() {
  const [streak, setStreak] = useState<AthleteStreak | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (options?: { silent?: boolean }) => {
    if (!options?.silent) setLoading(true);
    setError(null);
    try {
      setStreak(await fetchAthleteStreak());
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
  }, [load]);

  useLiveDataRefresh(() => load({ silent: true }));

  const medals = useMemo(() => buildMedals(streak), [streak]);
  const earned = medals.filter((medal) => medal.unlocked);
  const locked = medals.filter((medal) => !medal.unlocked);
  const plan = streak?.workouts_per_week ?? 2;

  return (
    <div className="athlete-overlay-screen hall-of-fame">
      {loading && !streak ? <p className="text-muted">Загрузка…</p> : null}
      {error ? <p className="auth-error">{error}</p> : null}

      {streak ? (
        <div className="hof-summary">
          <div className="hof-summary__item">
            <span className="hof-summary__label text-muted">Серия сейчас</span>
            <strong className="hof-summary__value">{streak.current_streak_weeks}</strong>
            <span className="hof-summary__unit text-muted">нед</span>
          </div>
          <div className="hof-summary__divider" aria-hidden="true" />
          <div className="hof-summary__item">
            <span className="hof-summary__label text-muted">Рекорд</span>
            <strong className="hof-summary__value">{streak.best_streak_weeks}</strong>
            <span className="hof-summary__unit text-muted">нед</span>
          </div>
        </div>
      ) : null}

      <section className="hof-section">
        <header className="hof-section__header">
          <h2 className="hof-section__title">Полученные награды</h2>
          {earned.length > 0 ? (
            <span className="hof-section__count text-muted">{earned.length}</span>
          ) : null}
        </header>

        {earned.length === 0 ? (
          <p className="hof-empty text-secondary">
            Первая медаль — за {plan}{" "}
            {plan === 1 ? "тренировку" : plan < 5 ? "тренировки" : "тренировок"} с тренером каждую неделю,
            четыре недели подряд. Ты уже на старте — просто не пропускай.
          </p>
        ) : (
          <div className={`hof-earned${earned.length === 1 ? " hof-earned--solo" : ""}`}>
            {earned.map((medal, index) => (
              <EarnedMedalCard key={medal.id} medal={medal} delayMs={40 + index * 70} />
            ))}
          </div>
        )}
      </section>

      {locked.length > 0 ? (
        <section className="hof-section">
          <header className="hof-section__header">
            <h2 className="hof-section__title">Можно получить</h2>
          </header>
          <div className="hof-locked">
            {locked.map((medal, index) => (
              <LockedMedalCard key={medal.id} medal={medal} delayMs={80 + index * 70} />
            ))}
          </div>
        </section>
      ) : null}

      {streak?.medals_preview_unlock_all ? (
        <p className="hall-of-fame__note text-muted">Демо: все награды открыты (админка)</p>
      ) : (
        <p className="hall-of-fame__note text-muted">
          Регулярные тренировки с тренером открывают медали. Как выглядит награда — узнаешь, когда заберёшь её.
        </p>
      )}
    </div>
  );
}
