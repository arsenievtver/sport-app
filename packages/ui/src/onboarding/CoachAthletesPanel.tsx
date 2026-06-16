import { useEffect, useState } from "react";
import {
  addCoachAthleteSessions,
  completeCoachAthleteSession,
  fetchCoachAthletes,
  resolveMediaUrl,
} from "@sport-app/api-client";
import {
  GENDER_LABELS,
  TRAINING_TRAIT_LABELS,
  type CoachAthleteSummary,
  type TrainingTrait,
} from "@sport-app/shared";
import { SessionsBalanceCircle } from "../sessions/SessionsBalanceBadge";

const DEFAULT_ADD_COUNT = "10";

function formatBirthDate(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    return new Date(value).toLocaleDateString("ru-RU");
  } catch {
    return value;
  }
}

function TraitRow({ label, value }: { label: string; value: number | null | undefined }) {
  if (value == null) return null;
  return (
    <div className="coach-athlete-card__trait-row">
      <span>{label}</span>
      <span>важность {value}</span>
    </div>
  );
}

function AthleteAvatar({ athlete }: { athlete: CoachAthleteSummary }) {
  const avatarUrl = resolveMediaUrl(athlete.avatar_url);
  const initial = (athlete.display_name?.slice(0, 1) ?? "?").toUpperCase();

  if (avatarUrl) {
    return <img src={avatarUrl} alt="" className="coach-athlete-card__avatar" />;
  }

  return (
    <div className="coach-athlete-card__avatar coach-athlete-card__avatar--placeholder" aria-hidden="true">
      {initial}
    </div>
  );
}

const TRAITS = ["strength", "flexibility", "endurance", "coordination"] as TrainingTrait[];

function AthleteDetails({ athlete }: { athlete: CoachAthleteSummary }) {
  const onboarded = Boolean(athlete.onboarding_completed_at);

  return (
    <>
      <p className="coach-athlete-card__meta text-muted">
        {athlete.gender ? GENDER_LABELS[athlete.gender] : "Пол не указан"}
        {formatBirthDate(athlete.birth_date) ? ` · ${formatBirthDate(athlete.birth_date)}` : ""}
      </p>

      {!onboarded ? (
        <p className="coach-athlete-card__pending">Квиз ещё не пройден</p>
      ) : (
        <>
          <div className="coach-athlete-card__traits">
            {TRAITS.map((trait) => (
              <TraitRow
                key={trait}
                label={TRAINING_TRAIT_LABELS[trait]}
                value={
                  trait === "strength"
                    ? athlete.focus_strength
                    : trait === "flexibility"
                      ? athlete.focus_flexibility
                      : trait === "endurance"
                        ? athlete.focus_endurance
                        : athlete.focus_coordination
                }
              />
            ))}
          </div>
          {athlete.weight_target_min_kg != null || athlete.weight_target_max_kg != null ? (
            <p className="coach-athlete-card__meta text-secondary">
              Вес: {athlete.weight_target_min_kg ?? "—"} – {athlete.weight_target_max_kg ?? "—"} кг
            </p>
          ) : null}
          {athlete.personal_goal_title != null && athlete.personal_goal_target != null ? (
            <p className="coach-athlete-card__goal">
              <strong>Личная цель:</strong> {athlete.personal_goal_title} — {athlete.personal_goal_target}
            </p>
          ) : null}
        </>
      )}
    </>
  );
}

interface AthleteSessionControlsProps {
  athleteId: string;
  busyAthleteId: string | null;
  addCount: string;
  onAddCountChange: (value: string) => void;
  onAddSessions: () => void;
  onCompleteSession: () => void;
}

function AthleteSessionControls({
  athleteId,
  busyAthleteId,
  addCount,
  onAddCountChange,
  onAddSessions,
  onCompleteSession,
}: AthleteSessionControlsProps) {
  const busy = busyAthleteId === athleteId;

  return (
    <div className="coach-athlete-card__session-controls">
      <input
        className="glass-input coach-athlete-card__session-input"
        type="number"
        inputMode="numeric"
        min={1}
        step={1}
        value={addCount}
        onChange={(event) => onAddCountChange(event.target.value)}
        disabled={busy}
      />
      <button
        type="button"
        className="coach-btn coach-btn--primary coach-athlete-card__session-btn"
        disabled={busy}
        onClick={onAddSessions}
      >
        Добавить
      </button>
      <button
        type="button"
        className="coach-btn coach-btn--warning coach-athlete-card__session-btn"
        disabled={busy}
        onClick={onCompleteSession}
      >
        Тренировка прошла (-1)
      </button>
    </div>
  );
}

interface CoachAthleteProfileProps {
  athlete: CoachAthleteSummary;
  onBack: () => void;
}

function CoachAthleteProfile({ athlete, onBack }: CoachAthleteProfileProps) {
  return (
    <div className="coach-athlete-profile">
      <button type="button" className="coach-btn coach-btn--muted coach-athlete-profile__back" onClick={onBack}>
        ← Назад к списку
      </button>

      <article className="coach-athlete-card">
        <div className="coach-athlete-card__header">
          <div className="coach-athlete-card__identity">
            <AthleteAvatar athlete={athlete} />
            <div>
              <h3 className="coach-athlete-card__name">{athlete.display_name}</h3>
            </div>
          </div>
          <SessionsBalanceCircle balance={athlete.sessions_balance} />
        </div>

        <p className="coach-athlete-card__completed text-secondary">
          Пройдено тренировок: <strong>{athlete.sessions_completed}</strong>
        </p>

        <AthleteDetails athlete={athlete} />
      </article>
    </div>
  );
}

function getAddCount(addCounts: Record<string, string>, athleteId: string): string {
  return addCounts[athleteId] ?? DEFAULT_ADD_COUNT;
}

function updateAthleteSessions(
  athlete: CoachAthleteSummary,
  updated: { sessions_balance: number; sessions_completed: number },
): CoachAthleteSummary {
  return {
    ...athlete,
    sessions_balance: updated.sessions_balance,
    sessions_completed: updated.sessions_completed,
  };
}

export function CoachAthletesPanel() {
  const [athletes, setAthletes] = useState<CoachAthleteSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [addCounts, setAddCounts] = useState<Record<string, string>>({});
  const [busyAthleteId, setBusyAthleteId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    fetchCoachAthletes()
      .then(setAthletes)
      .catch((err) => setError(err instanceof Error ? err.message : "Ошибка загрузки"))
      .finally(() => setLoading(false));
  }, []);

  const handleAddSessions = async (athleteId: string) => {
    const raw = getAddCount(addCounts, athleteId);
    const count = Number(raw);
    if (!Number.isFinite(count) || count < 1) return;

    setBusyAthleteId(athleteId);
    setActionError(null);
    try {
      const updated = await addCoachAthleteSessions({ athlete_id: athleteId, count });
      setAthletes((prev) =>
        prev.map((a) => (a.athlete_id === athleteId ? updateAthleteSessions(a, updated) : a)),
      );
      setAddCounts((prev) => ({ ...prev, [athleteId]: DEFAULT_ADD_COUNT }));
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Не удалось добавить тренировки");
    } finally {
      setBusyAthleteId(null);
    }
  };

  const handleCompleteSession = async (athleteId: string) => {
    setBusyAthleteId(athleteId);
    setActionError(null);
    try {
      const updated = await completeCoachAthleteSession({ athlete_id: athleteId });
      setAthletes((prev) =>
        prev.map((a) => (a.athlete_id === athleteId ? updateAthleteSessions(a, updated) : a)),
      );
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Не удалось отметить тренировку");
    } finally {
      setBusyAthleteId(null);
    }
  };

  const toggleExpanded = (athleteId: string) => {
    setExpandedId((prev) => (prev === athleteId ? null : athleteId));
  };

  if (loading) return <p className="text-muted">Загрузка атлетов…</p>;
  if (error) return <p className="auth-error">{error}</p>;

  const profileAthlete = profileId ? athletes.find((a) => a.athlete_id === profileId) : null;

  if (profileAthlete) {
    return (
      <>
        {actionError ? <p className="auth-error">{actionError}</p> : null}
        <CoachAthleteProfile athlete={profileAthlete} onBack={() => setProfileId(null)} />
      </>
    );
  }

  if (athletes.length === 0) {
    return (
      <p className="text-secondary">
        Пока нет подключённых атлетов. Поделись кодом приглашения — после связки здесь появятся их цели.
      </p>
    );
  }

  return (
    <>
      {actionError ? <p className="auth-error">{actionError}</p> : null}
      <div className="coach-athletes">
        {athletes.map((athlete) => {
          const isExpanded = expandedId === athlete.athlete_id;

          return (
            <article
              key={athlete.athlete_id}
              className={`coach-athlete-card coach-athlete-card--accordion${isExpanded ? " coach-athlete-card--expanded" : ""}`}
            >
              <button
                type="button"
                className="coach-athlete-card__summary"
                aria-expanded={isExpanded}
                onClick={() => toggleExpanded(athlete.athlete_id)}
              >
                <div className="coach-athlete-card__identity">
                  <AthleteAvatar athlete={athlete} />
                  <h3 className="coach-athlete-card__name">{athlete.display_name}</h3>
                </div>
                <SessionsBalanceCircle balance={athlete.sessions_balance} />
              </button>

              {isExpanded ? (
                <div className="coach-athlete-card__expanded">
                  <p className="coach-athlete-card__completed text-secondary">
                    Пройдено тренировок: <strong>{athlete.sessions_completed}</strong>
                  </p>

                  <AthleteSessionControls
                    athleteId={athlete.athlete_id}
                    busyAthleteId={busyAthleteId}
                    addCount={getAddCount(addCounts, athlete.athlete_id)}
                    onAddCountChange={(value) =>
                      setAddCounts((prev) => ({ ...prev, [athlete.athlete_id]: value }))
                    }
                    onAddSessions={() => void handleAddSessions(athlete.athlete_id)}
                    onCompleteSession={() => void handleCompleteSession(athlete.athlete_id)}
                  />

                  <button
                    type="button"
                    className="coach-btn coach-btn--primary coach-athlete-card__goto"
                    onClick={() => setProfileId(athlete.athlete_id)}
                  >
                    Перейти к профилю
                  </button>
                </div>
              ) : null}
            </article>
          );
        })}
      </div>
    </>
  );
}
