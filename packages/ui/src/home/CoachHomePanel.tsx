import { useCallback, useEffect, useMemo, useState } from "react";
import {
  addCoachAthleteWeightMeasurement,
  completeCoachScheduleSlot,
  fetchCoachActivityTypes,
  fetchCoachAthleteWeightDynamics,
  fetchCoachAthletes,
  fetchCoachScheduleDayCompletions,
  fetchCoachScheduleWeek,
  resolveMediaUrl,
  setCoachScheduleSlot,
} from "@sport-app/api-client";
import {
  ACTIVITY_EFFORT_DEFAULT,
  ACTIVITY_EFFORT_MAX,
  ACTIVITY_EFFORT_MIN,
  addDays,
  clampActivityEffort,
  formatCoachDayNavLabel,
  formatWeightKg,
  formatWeightMeasurementDate,
  getActivityEffortLabel,
  isValidWeightKg,
  parseWeightInput,
  scheduleSessionKey,
  toIsoDate,
  type ActivityType,
  type AthleteWeightDynamics,
  type ScheduleGridResponse,
  type ScheduleSlotCell,
  type ScheduleSlotCompletion,
} from "@sport-app/shared";
import { useLiveDataRefresh } from "../hooks/useLiveDataRefresh";
import { SessionsBalanceBadge } from "../sessions/SessionsBalanceBadge";
import { ScheduleActivityTypeField } from "../schedule/ScheduleActivityTypeField";

interface CoachHomePanelProps {
  onOpenAthlete?: (athleteId: string) => void;
}

interface DaySession {
  key: string;
  athleteId: string;
  athleteName: string;
  avatarUrl: string | null;
  dayOfWeek: number;
  startTime: string;
  activityName: string | null;
  activityTypeId: string | null;
  balance: number;
  completed: boolean;
}

interface WeightModalState {
  athleteId: string;
  athleteName: string;
}

interface CompleteModalState {
  session: DaySession;
}

function IconCompleteWorkout() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="m8 12.5 2.5 2.5L16 9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function buildDaySessions(
  cells: ScheduleSlotCell[],
  selectedDate: string,
  balanceByAthlete: Map<string, number>,
  completedKeys: Set<string>,
): DaySession[] {
  return cells
    .filter((cell) => cell.date === selectedDate && cell.athlete != null)
    .sort((a, b) => a.start_time.localeCompare(b.start_time))
    .map((cell) => {
      const athlete = cell.athlete!;
      const key = scheduleSessionKey(cell.date!, cell.start_time, athlete.athlete_id);
      return {
        key,
        athleteId: athlete.athlete_id,
        athleteName: athlete.display_name,
        avatarUrl: athlete.avatar_url,
        dayOfWeek: cell.day_of_week,
        startTime: cell.start_time,
        activityName: cell.activity_name,
        activityTypeId: cell.activity_type_id,
        balance: balanceByAthlete.get(athlete.athlete_id) ?? 0,
        completed: completedKeys.has(key),
      };
    });
}

function buildCompletedKeys(completions: ScheduleSlotCompletion[], selectedDate: string): Set<string> {
  return new Set(
    completions.map((item) => scheduleSessionKey(selectedDate, item.start_time, item.athlete_id)),
  );
}

function SessionAvatar({ name, avatarUrl }: { name: string; avatarUrl: string | null }) {
  const resolvedUrl = resolveMediaUrl(avatarUrl);
  const initial = (name.slice(0, 1) || "?").toUpperCase();

  if (resolvedUrl) {
    return <img src={resolvedUrl} alt="" className="coach-home-session__avatar" />;
  }

  return (
    <div className="coach-home-session__avatar coach-home-session__avatar--placeholder" aria-hidden="true">
      {initial}
    </div>
  );
}

export function CoachHomePanel({ onOpenAthlete }: CoachHomePanelProps) {
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [grid, setGrid] = useState<ScheduleGridResponse | null>(null);
  const [activityTypes, setActivityTypes] = useState<ActivityType[]>([]);
  const [completions, setCompletions] = useState<ScheduleSlotCompletion[]>([]);
  const [balanceByAthlete, setBalanceByAthlete] = useState<Map<string, number>>(new Map());
  const [showHidden, setShowHidden] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busySessionKey, setBusySessionKey] = useState<string | null>(null);
  const [weightModal, setWeightModal] = useState<WeightModalState | null>(null);
  const [completeModal, setCompleteModal] = useState<CompleteModalState | null>(null);
  const [completeActivityTypeId, setCompleteActivityTypeId] = useState("");
  const [completeEffort, setCompleteEffort] = useState(ACTIVITY_EFFORT_DEFAULT);
  const [completeBusy, setCompleteBusy] = useState(false);
  const [weightDynamics, setWeightDynamics] = useState<AthleteWeightDynamics | null>(null);
  const [weightDynamicsLoading, setWeightDynamicsLoading] = useState(false);
  const [weightInput, setWeightInput] = useState("");
  const [weightBusy, setWeightBusy] = useState(false);
  const [weightNotice, setWeightNotice] = useState<string | null>(null);

  const selectedIso = toIsoDate(selectedDate);
  const dayLabel = formatCoachDayNavLabel(selectedDate);

  const loadData = useCallback(
    async (options?: { silent?: boolean }) => {
      if (!options?.silent) {
        setLoading(true);
      }
      setError(null);
      try {
        const [schedule, athletes, dayCompletions] = await Promise.all([
          fetchCoachScheduleWeek(selectedIso),
          fetchCoachAthletes(),
          fetchCoachScheduleDayCompletions(selectedIso),
        ]);
        setGrid(schedule);
        setCompletions(dayCompletions);
        setBalanceByAthlete(new Map(athletes.map((athlete) => [athlete.athlete_id, athlete.sessions_balance])));
      } catch (err) {
        if (!options?.silent) {
          setError(err instanceof Error ? err.message : "Не удалось загрузить расписание");
        }
      } finally {
        if (!options?.silent) {
          setLoading(false);
        }
      }
    },
    [selectedIso],
  );

  const refreshData = useCallback(() => loadData({ silent: true }), [loadData]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    void fetchCoachActivityTypes()
      .then((data) => setActivityTypes(data.items))
      .catch(() => setActivityTypes([]));
  }, []);

  useEffect(() => {
    setShowHidden(false);
  }, [selectedIso]);

  useEffect(() => {
    if (!completeModal) return;
    const defaultActivityTypeId = activityTypes[0]?.id ?? "";
    setCompleteActivityTypeId(completeModal.session.activityTypeId ?? defaultActivityTypeId);
    setCompleteEffort(ACTIVITY_EFFORT_DEFAULT);
  }, [completeModal, activityTypes]);

  useLiveDataRefresh(refreshData);

  const completedKeys = useMemo(
    () => buildCompletedKeys(completions, selectedIso),
    [completions, selectedIso],
  );

  const sessions = useMemo(
    () => (grid ? buildDaySessions(grid.cells, selectedIso, balanceByAthlete, completedKeys) : []),
    [grid, selectedIso, balanceByAthlete, completedKeys],
  );

  const visibleSessions = useMemo(
    () => (showHidden ? sessions : sessions.filter((session) => !session.completed)),
    [sessions, showHidden],
  );

  const hiddenCompletedCount = sessions.filter((session) => session.completed).length;

  const updateBalance = (athleteId: string, balance: number) => {
    setBalanceByAthlete((prev) => {
      const next = new Map(prev);
      next.set(athleteId, balance);
      return next;
    });
  };

  const openCompleteModal = (session: DaySession) => {
    setCompleteModal({ session });
    setActionError(null);
  };

  const closeCompleteModal = () => {
    if (completeBusy) return;
    setCompleteModal(null);
  };

  const handleCompleteSession = async () => {
    if (!completeModal) return;
    const { session } = completeModal;
    if (!completeActivityTypeId) {
      setActionError("Выберите вид тренировки");
      return;
    }

    setCompleteBusy(true);
    setBusySessionKey(session.key);
    setActionError(null);
    try {
      if (completeActivityTypeId !== session.activityTypeId) {
        const response = await setCoachScheduleSlot({
          day_of_week: session.dayOfWeek,
          start_time: session.startTime,
          athlete_id: session.athleteId,
          activity_type_id: completeActivityTypeId,
          occurrence_date: selectedIso,
        });
        setGrid(response);
      }

      const result = await completeCoachScheduleSlot({
        athlete_id: session.athleteId,
        occurrence_date: selectedIso,
        start_time: session.startTime,
        activity_type_id: completeActivityTypeId,
        effort: clampActivityEffort(completeEffort),
      });
      updateBalance(session.athleteId, result.sessions_balance);
      setCompletions((prev) => [
        ...prev,
        {
          athlete_id: session.athleteId,
          start_time: session.startTime,
          activity_name: result.activity_name,
          effort: result.effort,
        },
      ]);
      setCompleteModal(null);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Не удалось завершить тренировку");
    } finally {
      setCompleteBusy(false);
      setBusySessionKey(null);
    }
  };

  const openWeightModal = (session: DaySession) => {
    setWeightModal({ athleteId: session.athleteId, athleteName: session.athleteName });
    setWeightDynamics(null);
    setWeightInput("");
    setWeightNotice(null);
    setActionError(null);
  };

  useEffect(() => {
    if (!weightModal) return;

    let cancelled = false;
    setWeightDynamicsLoading(true);

    void fetchCoachAthleteWeightDynamics(weightModal.athleteId)
      .then((data) => {
        if (!cancelled) {
          setWeightDynamics(data);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setActionError(err instanceof Error ? err.message : "Не удалось загрузить данные о весе");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setWeightDynamicsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [weightModal]);

  const closeWeightModal = () => {
    if (weightBusy) return;
    setWeightModal(null);
    setWeightDynamics(null);
    setWeightInput("");
  };

  const handleSaveWeight = async () => {
    if (!weightModal) return;
    const parsed = parseWeightInput(weightInput);
    if (parsed == null) {
      setActionError("Введите вес в килограммах");
      return;
    }
    if (!isValidWeightKg(parsed)) {
      setActionError("Вес должен быть от 20 до 300 кг");
      return;
    }

    setWeightBusy(true);
    setActionError(null);
    try {
      const saved = await addCoachAthleteWeightMeasurement({
        athlete_id: weightModal.athleteId,
        weight_kg: parsed,
      });
      setWeightNotice(`Вес ${saved.weight_kg} кг сохранён для ${weightModal.athleteName}`);
      setWeightModal(null);
      setWeightInput("");
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Не удалось сохранить измерение");
    } finally {
      setWeightBusy(false);
    }
  };

  const lastWeightEntry =
    weightDynamics && weightDynamics.entries.length > 0
      ? weightDynamics.entries[weightDynamics.entries.length - 1]
      : null;

  return (
    <div className="coach-home">
      <div className="coach-home__day-nav schedule-week-nav">
        <button
          type="button"
          className="schedule-week-nav__btn"
          aria-label="Предыдущий день"
          onClick={() => setSelectedDate((prev) => addDays(prev, -1))}
        >
          ←
        </button>
        <div className="schedule-week-nav__label coach-home__day-label">{dayLabel}</div>
        <button
          type="button"
          className="schedule-week-nav__btn"
          aria-label="Следующий день"
          onClick={() => setSelectedDate((prev) => addDays(prev, 1))}
        >
          →
        </button>
      </div>

      {weightNotice ? <p className="coach-home__notice">{weightNotice}</p> : null}
      {actionError ? <p className="auth-error">{actionError}</p> : null}

      {loading ? (
        <p className="text-muted">Загрузка тренировок…</p>
      ) : error ? (
        <p className="auth-error">{error}</p>
      ) : sessions.length === 0 ? (
        <section className="coach-home__empty glass glass--panel">
          <p className="text-secondary">На этот день тренировок нет.</p>
        </section>
      ) : (
        <>
          {hiddenCompletedCount > 0 ? (
            <label className="coach-home__show-hidden">
              <input
                type="checkbox"
                checked={showHidden}
                onChange={(event) => setShowHidden(event.target.checked)}
              />
              <span>Показать скрытые</span>
            </label>
          ) : null}

          {visibleSessions.length === 0 ? (
            <section className="coach-home__empty glass glass--panel">
              <p className="text-secondary">Все тренировки за этот день завершены.</p>
            </section>
          ) : (
            <ul className="coach-home__list">
              {visibleSessions.map((session) => {
                const busy = busySessionKey === session.key;

                return (
                  <li key={session.key}>
                    <article
                      className={`coach-home-session glass glass--panel${session.completed ? " coach-home-session--completed" : ""}`}
                    >
                      <div className="coach-home-session__main">
                        <button
                          type="button"
                          className="coach-home-session__identity"
                          aria-label={`Профиль атлета: ${session.athleteName}`}
                          disabled={busy}
                          onClick={() => onOpenAthlete?.(session.athleteId)}
                        >
                          <SessionAvatar name={session.athleteName} avatarUrl={session.avatarUrl} />
                          <div className="coach-home-session__info">
                            <div className="coach-home-session__title-row">
                              <div className="coach-home-session__name">{session.athleteName}</div>
                              {session.completed ? (
                                <span className="coach-home-session__completed-badge">Завершена</span>
                              ) : null}
                            </div>
                            <div className="coach-home-session__meta text-secondary">
                              <span>{session.startTime}</span>
                              {session.activityName ? (
                                <>
                                  <span aria-hidden="true">·</span>
                                  <span>{session.activityName}</span>
                                </>
                              ) : null}
                            </div>
                          </div>
                        </button>
                        <SessionsBalanceBadge balance={session.balance} />
                      </div>

                      {!session.completed ? (
                        <div className="coach-home-session__footer">
                          <button
                            type="button"
                            className="btn btn-outline btn-outline--accent btn--sm"
                            disabled={busy}
                            onClick={() => openWeightModal(session)}
                          >
                            Добавить измерение
                          </button>
                          <button
                            type="button"
                            className="coach-home-session__action coach-home-session__action--complete"
                            aria-label={`Завершить тренировку: ${session.athleteName}`}
                            disabled={busy}
                            onClick={() => openCompleteModal(session)}
                          >
                            <IconCompleteWorkout />
                          </button>
                        </div>
                      ) : null}
                    </article>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}

      {completeModal ? (
        <div
          className="schedule-sheet-backdrop coach-home-weight-backdrop"
          role="presentation"
          onClick={closeCompleteModal}
        >
          <div
            className="schedule-sheet coach-home-weight-sheet"
            role="dialog"
            aria-modal="true"
            aria-labelledby="coach-home-complete-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="schedule-sheet__body">
              <div className="schedule-sheet__header">
                <div className="schedule-sheet__heading">
                  <h2 className="schedule-sheet__title" id="coach-home-complete-title">
                    Завершить тренировку
                  </h2>
                  <p className="schedule-sheet__subtitle">
                    {completeModal.session.athleteName} · {completeModal.session.startTime}
                  </p>
                </div>
                <button
                  type="button"
                  className="schedule-sheet__close"
                  aria-label="Закрыть"
                  disabled={completeBusy}
                  onClick={closeCompleteModal}
                >
                  ×
                </button>
              </div>

              <ScheduleActivityTypeField
                activityTypes={activityTypes}
                value={completeActivityTypeId}
                disabled={completeBusy}
                onChange={setCompleteActivityTypeId}
              />

              <div className="coach-home-complete-sheet__field">
                <div className="coach-home-complete-sheet__effort-header">
                  <span className="coach-home-complete-sheet__label text-secondary">Усилие</span>
                  <span className="coach-home-complete-sheet__effort-value">
                    {getActivityEffortLabel(completeEffort)}
                  </span>
                </div>
                <input
                  type="range"
                  className="coach-home-complete-sheet__effort-input"
                  min={ACTIVITY_EFFORT_MIN}
                  max={ACTIVITY_EFFORT_MAX}
                  step={1}
                  value={completeEffort}
                  disabled={completeBusy}
                  aria-label="Усилие тренировки"
                  onChange={(event) => setCompleteEffort(clampActivityEffort(Number(event.target.value)))}
                />
                <div className="coach-home-complete-sheet__effort-scale">
                  <span>Легко</span>
                  <span>Максимум</span>
                </div>
              </div>

              <p className="coach-home-complete-sheet__deduct text-secondary">
                С баланса атлета будет списана <strong>1 тренировка</strong>. Повторное списание за этот слот
                невозможно.
              </p>

              <button
                type="button"
                className="coach-btn coach-btn--primary schedule-sheet__submit"
                disabled={completeBusy || !completeActivityTypeId}
                onClick={() => void handleCompleteSession()}
              >
                {completeBusy ? "Сохраняем…" : "Завершить и списать"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {weightModal ? (
        <div
          className="schedule-sheet-backdrop coach-home-weight-backdrop"
          role="presentation"
          onClick={closeWeightModal}
        >
          <div
            className="schedule-sheet coach-home-weight-sheet"
            role="dialog"
            aria-modal="true"
            aria-labelledby="coach-home-weight-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="schedule-sheet__body">
              <div className="schedule-sheet__header">
                <div className="schedule-sheet__heading">
                  <h2 className="schedule-sheet__title" id="coach-home-weight-title">
                    Измерение веса
                  </h2>
                  <p className="schedule-sheet__subtitle">{weightModal.athleteName}</p>
                </div>
                <button
                  type="button"
                  className="schedule-sheet__close"
                  aria-label="Закрыть"
                  disabled={weightBusy}
                  onClick={closeWeightModal}
                >
                  ×
                </button>
              </div>

              <div className="coach-home-weight-sheet__summary">
                {weightDynamicsLoading ? (
                  <p className="text-muted">Загрузка данных о весе…</p>
                ) : (
                  <>
                    <p className="coach-home-weight-sheet__current">
                      Текущий вес:{" "}
                      <strong>
                        {weightDynamics?.current_weight_kg != null
                          ? `${formatWeightKg(weightDynamics.current_weight_kg)} кг`
                          : "—"}
                      </strong>
                    </p>
                    <p className="coach-home-weight-sheet__date text-secondary">
                      Дата измерения:{" "}
                      {lastWeightEntry ? formatWeightMeasurementDate(lastWeightEntry.entry_date) : "нет данных"}
                    </p>
                  </>
                )}
              </div>

              <label className="schedule-sheet__field">
                <span className="schedule-sheet__field-label">Вес, кг</span>
                <input
                  className="glass-input schedule-sheet__select"
                  type="number"
                  inputMode="decimal"
                  min={20}
                  max={300}
                  step={0.1}
                  value={weightInput}
                  disabled={weightBusy}
                  placeholder="Например, 72.5"
                  onChange={(event) => setWeightInput(event.target.value)}
                />
              </label>

              <button
                type="button"
                className="coach-btn coach-btn--primary schedule-sheet__submit"
                disabled={weightBusy}
                onClick={() => void handleSaveWeight()}
              >
                {weightBusy ? "Сохраняем…" : "Сохранить"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
