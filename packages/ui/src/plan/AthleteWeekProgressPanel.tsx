import { useCallback, useEffect, useState, type CSSProperties } from "react";
import { fetchAthleteWeekProgress } from "@sport-app/api-client";
import {
  formatWeekProgressMetric,
  type AthleteWeekProgress,
  type AthleteWeekProgressMetric,
} from "@sport-app/shared";
import { useCountUp } from "../hooks/useCountUp";
import { useLiveDataRefresh } from "../hooks/useLiveDataRefresh";
import { usePullToRefresh } from "../pull-to-refresh/PullToRefresh";
import { CircularProgressRing } from "./CircularProgressRing";
import { IconDumbbell, IconFlame } from "../icons/AthleteMetricIcons";
import "./athlete-plan.css";

function IconActivity() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const METRIC_ICONS = {
  workouts: IconDumbbell,
  calories: IconFlame,
  activity: IconActivity,
} as const;

interface AthleteWeekProgressPanelProps {
  refreshKey?: string;
}

function WeekProgressMetricValue({
  metric,
  enabled,
  delay = 0,
}: {
  metric: AthleteWeekProgressMetric;
  enabled: boolean;
  delay?: number;
}) {
  const actual = useCountUp(metric.actual, { enabled, delay, duration: 900 });
  return <>{formatWeekProgressMetric({ ...metric, actual })}</>;
}

export function AthleteWeekProgressPanel({ refreshKey }: AthleteWeekProgressPanelProps) {
  const [progress, setProgress] = useState<AthleteWeekProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadProgress = useCallback(async (options?: { silent?: boolean }) => {
    if (!options?.silent) {
      setLoading(true);
    }
    setError(null);
    try {
      const data = await fetchAthleteWeekProgress();
      setProgress(data);
    } catch (err) {
      if (!options?.silent) {
        setError(err instanceof Error ? err.message : "Ошибка загрузки");
      }
    } finally {
      if (!options?.silent) {
        setLoading(false);
      }
    }
  }, []);

  const refreshProgress = useCallback(() => loadProgress({ silent: true }), [loadProgress]);

  useEffect(() => {
    void loadProgress();
  }, [loadProgress, refreshKey]);

  useLiveDataRefresh(refreshProgress);
  usePullToRefresh(refreshProgress);

  const metrics = progress
    ? ([
        { key: "workouts" as const, metric: progress.workouts },
        { key: "calories" as const, metric: progress.calories },
        { key: "activity" as const, metric: progress.activity },
      ] as const)
    : [];

  const showProgress = !loading && progress != null;
  const completionPercent = useCountUp(progress?.completion_percent ?? 0, {
    enabled: showProgress,
    duration: 1100,
  });

  return (
    <div className="athlete-home-section">
      <h2 className="athlete-home-section__title">Прогресс этой недели</h2>

      {loading ? (
        <section className="athlete-week-progress">
          <p className="text-muted">Загрузка…</p>
        </section>
      ) : error ? (
        <section className="athlete-week-progress">
          <p className="auth-error">{error}</p>
        </section>
      ) : progress ? (
        <section
          className="athlete-week-progress athlete-home-enter"
          style={{ "--enter-delay": "0ms" } as CSSProperties}
        >
          <div className="athlete-week-progress__grid">
            <div className="athlete-week-progress__chart">
              <CircularProgressRing
                percent={completionPercent}
                animateFill={showProgress}
                label={`${completionPercent}%`}
                sublabel="выполнено"
              />
            </div>
            <ul className="athlete-week-progress__metrics">
              {metrics.map(({ key, metric }, index) => {
                const Icon = METRIC_ICONS[key];
                return (
                  <li key={key} className="athlete-week-progress__metric">
                    <span className="athlete-week-progress__metric-icon" aria-hidden="true">
                      <Icon />
                    </span>
                    <div className="athlete-week-progress__metric-body">
                      <span className="athlete-week-progress__metric-label">{metric.label}</span>
                      <span className="athlete-week-progress__metric-value">
                        <WeekProgressMetricValue
                          metric={metric}
                          enabled={showProgress}
                          delay={120 + index * 90}
                        />
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </section>
      ) : null}
    </div>
  );
}
