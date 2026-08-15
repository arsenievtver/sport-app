import { useCallback, useEffect, useState, type CSSProperties } from "react";
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
  unlocked: boolean;
  stackCount: number;
}

function buildMedals(streak: AthleteStreak | null): MedalView[] {
  const byId = new Map((streak?.medals ?? []).map((medal) => [medal.id, medal]));
  return STREAK_MEDAL_ORDER.map((id) => {
    const asset = STREAK_MEDAL_ASSETS[id];
    const remote: AthleteStreakMedal | undefined = byId.get(id);
    const unlocked = remote?.unlocked ?? false;
    return {
      id,
      ...asset,
      unlocked,
      stackCount: unlocked ? Math.max(1, remote?.stack_count ?? 1) : 0,
    };
  });
}

function MedalFigure({
  medal,
  featured = false,
  delayMs,
}: {
  medal: MedalView;
  featured?: boolean;
  delayMs: number;
}) {
  return (
    <figure
      className={[
        "hall-of-fame__medal",
        featured ? "hall-of-fame__medal--featured" : "",
        medal.unlocked ? "" : "hall-of-fame__medal--locked",
      ]
        .filter(Boolean)
        .join(" ")}
      style={
        {
          "--medal-glow": medal.glow,
          "--medal-delay": `${delayMs}ms`,
        } as CSSProperties
      }
    >
      <div className="hall-of-fame__stage">
        <span className="hall-of-fame__aura" aria-hidden="true" />
        <img
          className="hall-of-fame__art"
          src={medal.src}
          alt=""
          width={featured ? 280 : 200}
          height={featured ? 350 : 250}
          decoding="async"
        />
        {medal.stackCount > 1 ? (
          <span className="hall-of-fame__stack" aria-label={`Собрано ${medal.stackCount} раз`}>
            ×{medal.stackCount}
          </span>
        ) : null}
        <span className="hall-of-fame__plinth" aria-hidden="true" />
      </div>
      <figcaption className="hall-of-fame__caption">
        <strong className="hall-of-fame__title">{medal.title}</strong>
        <span className="hall-of-fame__subtitle text-muted">
          {medal.unlocked ? medal.subtitle : "Ещё не открыта"}
        </span>
      </figcaption>
    </figure>
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

  const medals = buildMedals(streak);
  const yearMedal = medals[3]!;
  const rest = [medals[2]!, medals[1]!, medals[0]!];

  return (
    <div className="athlete-overlay-screen hall-of-fame">
      <p className="hall-of-fame__lead text-secondary">Серия тренировок без перерыва</p>

      {loading && !streak ? <p className="text-muted">Загрузка…</p> : null}
      {error ? <p className="auth-error">{error}</p> : null}

      {streak ? (
        <div className="hall-of-fame__stats">
          <div className="hall-of-fame__stat glass glass--panel">
            <span className="hall-of-fame__stat-label text-muted">Сейчас</span>
            <strong className="hall-of-fame__stat-value">{streak.current_streak_weeks}</strong>
            <span className="hall-of-fame__stat-unit text-muted">нед</span>
          </div>
          <div className="hall-of-fame__stat glass glass--panel">
            <span className="hall-of-fame__stat-label text-muted">Рекорд</span>
            <strong className="hall-of-fame__stat-value">{streak.best_streak_weeks}</strong>
            <span className="hall-of-fame__stat-unit text-muted">нед</span>
          </div>
        </div>
      ) : null}

      <MedalFigure medal={yearMedal} featured delayMs={40} />

      <div className="hall-of-fame__grid">
        {rest.map((medal, index) => (
          <MedalFigure key={medal.id} medal={medal} delayMs={120 + index * 80} />
        ))}
      </div>

      {streak?.medals_preview_unlock_all ? (
        <p className="hall-of-fame__note text-muted">Демо: все награды открыты (админка)</p>
      ) : (
        <p className="hall-of-fame__note text-muted">
          План: {streak?.workouts_per_week ?? "—"} тр./нед · закрытая неделя = +1 к серии
        </p>
      )}
    </div>
  );
}
