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

export function CoachAthletesPanel() {
  const [athletes, setAthletes] = useState<CoachAthleteSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
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
    const raw = addCounts[athleteId] ?? "";
    const count = Number(raw);
    if (!Number.isFinite(count) || count < 1) return;

    setBusyAthleteId(athleteId);
    setActionError(null);
    try {
      const updated = await addCoachAthleteSessions({ athlete_id: athleteId, count });
      setAthletes((prev) =>
        prev.map((a) => (a.athlete_id === athleteId ? { ...a, sessions_balance: updated.sessions_balance } : a)),
      );
      setAddCounts((prev) => ({ ...prev, [athleteId]: "" }));
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
        prev.map((a) => (a.athlete_id === athleteId ? { ...a, sessions_balance: updated.sessions_balance } : a)),
      );
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Не удалось отметить тренировку");
    } finally {
      setBusyAthleteId(null);
    }
  };

  if (loading) return <p className="text-muted">Загрузка атлетов…</p>;
  if (error) return <p className="auth-error">{error}</p>;
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
          const onboarded = Boolean(athlete.onboarding_completed_at);
        const traits = [
          "strength",
          "flexibility",
          "endurance",
          "coordination",
        ] as TrainingTrait[];
          const avatarUrl = resolveMediaUrl(athlete.avatar_url);
          const initial = (athlete.display_name?.slice(0, 1) ?? "?").toUpperCase();

          return (
            <article key={athlete.athlete_id} className="coach-athlete-card">
              <div className="coach-athlete-card__header">
                <div className="coach-athlete-card__identity">
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="" className="coach-athlete-card__avatar" />
                  ) : (
                    <div className="coach-athlete-card__avatar coach-athlete-card__avatar--placeholder" aria-hidden="true">
                      {initial}
                    </div>
                  )}
                  <div>
                    <h3 className="coach-athlete-card__name">{athlete.display_name}</h3>
                    <p className="coach-athlete-card__meta text-muted">
                      {athlete.gender ? GENDER_LABELS[athlete.gender] : "Пол не указан"}
                      {formatBirthDate(athlete.birth_date) ? ` · ${formatBirthDate(athlete.birth_date)}` : ""}
                    </p>
                  </div>
                </div>
                <span className="badge badge-accent coach-athlete-card__sessions-badge">
                  Тренировок: {athlete.sessions_balance}
                </span>
              </div>

              {!onboarded ? (
                <p className="coach-athlete-card__pending">Квиз ещё не пройден</p>
              ) : (
                <>
                  <div className="coach-athlete-card__traits">
                    {traits.map((trait) => (
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

              <div className="coach-athlete-card__session-controls">
                <input
                  className="glass-input coach-athlete-card__session-input"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  step={1}
                  value={addCounts[athlete.athlete_id] ?? ""}
                  placeholder="10"
                  onChange={(event) =>
                    setAddCounts((prev) => ({ ...prev, [athlete.athlete_id]: event.target.value }))
                  }
                  disabled={busyAthleteId === athlete.athlete_id}
                />
                <button
                  type="button"
                  className="settings-btn settings-btn--primary coach-athlete-card__session-btn"
                  disabled={busyAthleteId === athlete.athlete_id}
                  onClick={() => void handleAddSessions(athlete.athlete_id)}
                >
                  Добавить
                </button>
                <button
                  type="button"
                  className="settings-btn settings-btn--ghost coach-athlete-card__session-btn"
                  disabled={busyAthleteId === athlete.athlete_id}
                  onClick={() => void handleCompleteSession(athlete.athlete_id)}
                >
                  Тренировка прошла (-1)
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </>
  );
}
