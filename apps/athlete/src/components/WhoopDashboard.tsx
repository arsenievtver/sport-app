import type { WhoopSyncPayload } from "@sport-app/shared";

import {
  formatDateTime,
  formatDurationMs,
  formatShortDate,
  getDashboardSnapshot,
  kilojouleToKcal,
  recoveryLabel,
} from "./whoop-utils";

function RecoveryRing({ score, tone }: { score: number | undefined; tone: "high" | "mid" | "low" | "none" }) {
  const value = score ?? 0;
  const pct = Math.min(Math.max(value, 0), 100);

  return (
    <div className={`whoop-ring whoop-ring--${tone}`}>
      <div
        className="whoop-ring__meter"
        style={{ background: `conic-gradient(var(--whoop-ring-color) ${pct * 3.6}deg, var(--whoop-ring-track) 0)` }}
      >
        <div className="whoop-ring__inner">
          <span className="whoop-ring__value">{score ?? "—"}</span>
          <span className="whoop-ring__unit">recovery</span>
        </div>
      </div>
      <p className="whoop-ring__label">{recoveryLabel(tone)}</p>
    </div>
  );
}

function MetricTile({
  label,
  value,
  meta,
  accent,
}: {
  label: string;
  value: string;
  meta?: string;
  accent?: boolean;
}) {
  return (
    <div className={`whoop-metric ${accent ? "whoop-metric--accent" : ""}`}>
      <span className="whoop-metric__label">{label}</span>
      <strong className="whoop-metric__value">{value}</strong>
      {meta ? <span className="whoop-metric__meta">{meta}</span> : null}
    </div>
  );
}

function SleepStagesBar({ stages }: { stages: NonNullable<ReturnType<typeof getDashboardSnapshot>["sleepStages"]> }) {
  const segments = [
    { key: "deep", label: "Глубокий", ms: stages.deep, className: "whoop-stage--deep" },
    { key: "rem", label: "REM", ms: stages.rem, className: "whoop-stage--rem" },
    { key: "light", label: "Лёгкий", ms: stages.light, className: "whoop-stage--light" },
    { key: "awake", label: "Бодрств.", ms: stages.awake, className: "whoop-stage--awake" },
  ];

  return (
    <div className="whoop-stages">
      <div className="whoop-stages__bar">
        {segments.map((segment) =>
          segment.ms > 0 ? (
            <div
              key={segment.key}
              className={`whoop-stages__segment ${segment.className}`}
              style={{ flex: segment.ms }}
              title={`${segment.label}: ${formatDurationMs(segment.ms)}`}
            />
          ) : null,
        )}
      </div>
      <div className="whoop-stages__legend">
        {segments.map((segment) => (
          <span key={segment.key}>
            <i className={segment.className} /> {segment.label}
          </span>
        ))}
      </div>
    </div>
  );
}

function TrendBars({ items }: { items: Array<{ key: string; label: string; value: number }> }) {
  if (items.length === 0) {
    return <p className="text-muted whoop-empty">Нет данных за последние дни</p>;
  }

  return (
    <div className="whoop-trend">
      {items.map((item) => (
        <div key={item.key} className="whoop-trend__item">
          <div className="whoop-trend__bar-wrap">
            <div className="whoop-trend__bar" style={{ height: `${Math.max(item.value, 4)}%` }} />
          </div>
          <span className="whoop-trend__value">{item.value || "—"}</span>
          <span className="whoop-trend__label">{item.label}</span>
        </div>
      ))}
    </div>
  );
}

export function WhoopDashboard({ data }: { data: WhoopSyncPayload }) {
  const snapshot = getDashboardSnapshot(data);
  const {
    profileName,
    latestRecovery,
    latestSleep,
    latestWorkout,
    recoveryScore,
    recoveryTone,
    recoveryTrend,
    sleepStages,
    dayStrain,
    dayCalories,
    workouts,
  } = snapshot;

  return (
    <div className="whoop-dashboard">
      <div className="whoop-dashboard__hero">
        <div>
          <p className="whoop-dashboard__eyebrow">Данные с WHOOP</p>
          <h3 className="whoop-dashboard__heading">
            {profileName ? `Привет, ${profileName.split(" ")[0]}` : "Ваши показатели"}
          </h3>
          <p className="whoop-dashboard__synced">Обновлено: {formatDateTime(data.synced_at)}</p>
        </div>
        <RecoveryRing score={recoveryScore} tone={recoveryTone} />
      </div>

      <div className="whoop-dashboard__metrics">
        <MetricTile
          label="Дневной strain"
          value={dayStrain != null ? dayStrain.toFixed(1) : "—"}
          meta={dayCalories != null ? `${dayCalories} ккал активности` : undefined}
          accent
        />
        <MetricTile
          label="Пульс покоя"
          value={latestRecovery?.score?.resting_heart_rate != null ? `${latestRecovery.score.resting_heart_rate}` : "—"}
          meta="уд/мин"
        />
        <MetricTile
          label="HRV"
          value={
            latestRecovery?.score?.hrv_rmssd_milli != null
              ? latestRecovery.score.hrv_rmssd_milli.toFixed(1)
              : "—"
          }
          meta="мс RMSSD"
        />
        <MetricTile
          label="Сон"
          value={
            latestSleep?.score?.sleep_performance_percentage != null
              ? `${latestSleep.score.sleep_performance_percentage}%`
              : "—"
          }
          meta={formatDurationMs(latestSleep?.score?.stage_summary?.total_in_bed_time_milli)}
        />
      </div>

      <section className="whoop-section">
        <div className="whoop-section__head">
          <h4>Recovery · 7 дней</h4>
        </div>
        <TrendBars items={recoveryTrend} />
      </section>

      {sleepStages ? (
        <section className="whoop-section">
          <div className="whoop-section__head">
            <h4>Последний сон</h4>
            <span>{formatShortDate(latestSleep?.end ?? latestSleep?.start)}</span>
          </div>
          <SleepStagesBar stages={sleepStages} />
          <p className="whoop-section__footnote">
            Эффективность{" "}
            {latestSleep?.score?.sleep_efficiency_percentage != null
              ? `${Math.round(latestSleep.score.sleep_efficiency_percentage)}%`
              : "—"}
          </p>
        </section>
      ) : null}

      <section className="whoop-section">
        <div className="whoop-section__head">
          <h4>Тренировки</h4>
          <span>{workouts.length ? `последние ${workouts.length}` : "нет записей"}</span>
        </div>
        {workouts.length === 0 ? (
          <p className="text-muted whoop-empty">WHOOP пока не видел тренировок в этом периоде.</p>
        ) : (
          <ul className="whoop-workouts">
            {workouts.map((workout, index) => {
              const kcal = kilojouleToKcal(workout.score?.kilojoule);
              return (
                <li key={`${workout.start ?? index}-${workout.sport_name ?? "workout"}`} className="whoop-workouts__item">
                  <div>
                    <strong>{workout.sport_name ?? "Activity"}</strong>
                    <span>{formatShortDate(workout.start)}</span>
                  </div>
                  <div className="whoop-workouts__stats">
                    <span>{workout.score?.strain?.toFixed(1) ?? "—"} strain</span>
                    <span>{workout.score?.average_heart_rate ?? "—"} bpm</span>
                    {kcal != null ? <span>{kcal} kcal</span> : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {latestWorkout ? (
        <p className="whoop-dashboard__footnote">
          Последняя активность: {latestWorkout.sport_name ?? "—"} · strain{" "}
          {latestWorkout.score?.strain?.toFixed(1) ?? "—"}
        </p>
      ) : null}
    </div>
  );
}
