import type { WhoopSyncPayload } from "@sport-app/shared";
import { ICON_VIEW_BOX, iconStrokeProps } from "@sport-app/ui";

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

function WhoopRefreshIcon({ spinning }: { spinning?: boolean }) {
  return (
    <svg
      className={`whoop-refresh-icon${spinning ? " whoop-refresh-icon--spinning" : ""}`}
      viewBox={ICON_VIEW_BOX}
      aria-hidden
      {...iconStrokeProps}
    >
      <path d="M21 12a9 9 0 1 1-2.64-6.36" />
      <path d="M21 3v6h-6" />
    </svg>
  );
}

export function WhoopDashboardHero({
  heading,
  syncedAt,
  recoveryScore,
  recoveryTone,
  onRefresh,
  busy = false,
  refreshDisabled = false,
}: {
  heading: string;
  syncedAt?: string | null;
  recoveryScore?: number;
  recoveryTone?: "high" | "mid" | "low" | "none";
  onRefresh?: () => void;
  busy?: boolean;
  refreshDisabled?: boolean;
}) {
  return (
    <div className="whoop-dashboard__hero">
      <div>
        <div className="whoop-dashboard__eyebrow-row">
          <p className="whoop-dashboard__eyebrow">Данные с WHOOP</p>
          {onRefresh ? (
            <button
              type="button"
              className="whoop-refresh-btn"
              disabled={refreshDisabled || busy}
              aria-label={busy ? "Синхронизация WHOOP" : "Обновить данные WHOOP"}
              onClick={onRefresh}
            >
              <WhoopRefreshIcon spinning={busy} />
            </button>
          ) : null}
        </div>
        <h3 className="whoop-dashboard__heading">{heading}</h3>
        {syncedAt ? <p className="whoop-dashboard__synced">Обновлено: {formatDateTime(syncedAt)}</p> : null}
      </div>
      {recoveryScore !== undefined || recoveryTone ? (
        <RecoveryRing score={recoveryScore} tone={recoveryTone ?? "none"} />
      ) : null}
    </div>
  );
}

export function WhoopDashboard({
  data,
  onRefresh,
  busy = false,
  refreshDisabled = false,
}: {
  data: WhoopSyncPayload;
  onRefresh?: () => void;
  busy?: boolean;
  refreshDisabled?: boolean;
}) {
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
      <WhoopDashboardHero
        heading={profileName ? `Привет, ${profileName.split(" ")[0]}` : "Ваши показатели"}
        syncedAt={data.synced_at}
        recoveryScore={recoveryScore}
        recoveryTone={recoveryTone}
        onRefresh={onRefresh}
        busy={busy}
        refreshDisabled={refreshDisabled}
      />

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
