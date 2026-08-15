import type { CSSProperties } from "react";
import "./hall-of-fame.css";

interface StreakMedal {
  id: "streak-1m" | "streak-3m" | "streak-6m" | "streak-12m";
  src: string;
  title: string;
  subtitle: string;
  glow: string;
}

/** Пока нет подсчёта серии — все награды открыты, чтобы оценить вид. */
const PREVIEW_UNLOCK_ALL = true;

const MEDALS: StreakMedal[] = [
  {
    id: "streak-1m",
    src: "/medals/streak-1m.webp",
    title: "1 месяц",
    subtitle: "Тренировок без перерыва",
    glow: "196, 122, 58",
  },
  {
    id: "streak-3m",
    src: "/medals/streak-3m.webp",
    title: "3 месяца",
    subtitle: "Тренировок без перерыва",
    glow: "186, 198, 210",
  },
  {
    id: "streak-6m",
    src: "/medals/streak-6m.webp",
    title: "6 месяцев",
    subtitle: "Тренировок без перерыва",
    glow: "232, 186, 64",
  },
  {
    id: "streak-12m",
    src: "/medals/streak-12m.webp",
    title: "1 год",
    subtitle: "Тренировок без перерыва",
    glow: "255, 156, 72",
  },
];

function MedalFigure({
  medal,
  featured = false,
  delayMs,
}: {
  medal: StreakMedal;
  featured?: boolean;
  delayMs: number;
}) {
  return (
    <figure
      className={`hall-of-fame__medal${featured ? " hall-of-fame__medal--featured" : ""}`}
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
          height={featured ? 340 : 244}
          decoding="async"
        />
        <span className="hall-of-fame__plinth" aria-hidden="true" />
      </div>
      <figcaption className="hall-of-fame__caption">
        <strong className="hall-of-fame__title">{medal.title}</strong>
        <span className="hall-of-fame__subtitle text-muted">{medal.subtitle}</span>
      </figcaption>
    </figure>
  );
}

export function AthleteHallOfFamePanel() {
  const yearMedal = MEDALS[3];
  const rest = MEDALS.slice(0, 3).reverse();

  return (
    <div className="athlete-overlay-screen hall-of-fame">
      <p className="hall-of-fame__lead text-secondary">Серия тренировок без перерыва</p>

      <MedalFigure medal={yearMedal} featured delayMs={40} />

      <div className="hall-of-fame__grid">
        {rest.map((medal, index) => (
          <MedalFigure key={medal.id} medal={medal} delayMs={120 + index * 80} />
        ))}
      </div>

      {PREVIEW_UNLOCK_ALL ? (
        <p className="hall-of-fame__note text-muted">Предпросмотр: все награды открыты</p>
      ) : null}
    </div>
  );
}
