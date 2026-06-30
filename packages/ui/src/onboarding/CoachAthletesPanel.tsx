import { useEffect, useState } from "react";
import {
  createManagedAthlete,
  fetchCoachAthletes,
  resolveMediaUrl,
} from "@sport-app/api-client";
import {
  GENDER_LABELS,
  TRAINING_TRAIT_LABELS,
  getAthleteAppStatusLabel,
  type CoachAthleteSessionsResponse,
  type CoachAthleteSummary,
  type TrainingTrait,
} from "@sport-app/shared";
import { CoachAthleteAddSessionsModal } from "../sessions/CoachAthleteAddSessionsModal";
import { SessionsBalanceCircle } from "../sessions/SessionsBalanceBadge";
import { CoachAthleteSessionHistoryTable } from "./CoachAthleteSessionHistoryTable";

function formatBirthDate(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    return new Date(value).toLocaleDateString("ru-RU");
  } catch {
    return value;
  }
}

function pluralSessions(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return "тренировка";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return "тренировки";
  return "тренировок";
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

function AthleteAppStatus({ hasApp }: { hasApp: boolean }) {
  return (
    <span
      className={`coach-athlete-card__app-status${
        hasApp ? " coach-athlete-card__app-status--with-app" : " coach-athlete-card__app-status--without-app"
      }`}
    >
      {getAthleteAppStatusLabel(hasApp)}
    </span>
  );
}

function AthleteDetails({ athlete }: { athlete: CoachAthleteSummary }) {
  const onboarded = Boolean(athlete.onboarding_completed_at);

  return (
    <>
      <p className="coach-athlete-card__meta text-muted">
        {athlete.gender ? GENDER_LABELS[athlete.gender] : "Пол не указан"}
        {formatBirthDate(athlete.birth_date) ? ` · ${formatBirthDate(athlete.birth_date)}` : ""}
      </p>

      {!athlete.has_app ? (
        <p className="coach-athlete-card__pending">Атлет ещё не установил приложение</p>
      ) : !onboarded ? (
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

interface CoachAthleteProfileProps {
  athlete: CoachAthleteSummary;
  onBack: () => void;
  onBalanceClick: () => void;
  onSessionsUpdated: (result: CoachAthleteSessionsResponse) => void;
}

function CoachAthleteProfile({
  athlete,
  onBack,
  onBalanceClick,
  onSessionsUpdated,
}: CoachAthleteProfileProps) {
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
              <AthleteAppStatus hasApp={athlete.has_app} />
            </div>
          </div>
          <SessionsBalanceCircle balance={athlete.sessions_balance} onClick={onBalanceClick} />
        </div>

        <p className="coach-athlete-card__completed text-secondary">
          Пройдено тренировок: <strong>{athlete.sessions_completed}</strong>
        </p>

        <AthleteDetails athlete={athlete} />
      </article>

      <CoachAthleteSessionHistoryTable
        athleteId={athlete.athlete_id}
        balance={athlete.sessions_balance}
        onSessionsUpdated={onSessionsUpdated}
      />
    </div>
  );
}

interface SessionsModalState {
  athleteId: string;
  athleteName: string;
  currentBalance: number;
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

export function CoachAthletesPanel({
  initialProfileId = null,
  onInitialProfileHandled,
}: {
  initialProfileId?: string | null;
  onInitialProfileHandled?: () => void;
} = {}) {
  const [athletes, setAthletes] = useState<CoachAthleteSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [profileId, setProfileId] = useState<string | null>(initialProfileId);
  const [sessionsModal, setSessionsModal] = useState<SessionsModalState | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newAthleteName, setNewAthleteName] = useState("");
  const [creatingAthlete, setCreatingAthlete] = useState(false);

  const loadAthletes = () =>
    fetchCoachAthletes()
      .then(setAthletes)
      .catch((err) => setError(err instanceof Error ? err.message : "Ошибка загрузки"));

  useEffect(() => {
    void loadAthletes().finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (initialProfileId) {
      setProfileId(initialProfileId);
    }
  }, [initialProfileId]);

  useEffect(() => {
    if (!successNotice) return;
    const timer = window.setTimeout(() => setSuccessNotice(null), 5000);
    return () => window.clearTimeout(timer);
  }, [successNotice]);

  const openSessionsModal = (athlete: CoachAthleteSummary) => {
    setSessionsModal({
      athleteId: athlete.athlete_id,
      athleteName: athlete.display_name,
      currentBalance: athlete.sessions_balance,
    });
  };

  const handleSessionsAdded = (result: CoachAthleteSessionsResponse, count: number) => {
    const athleteName = sessionsModal?.athleteName ?? "атлету";
    setAthletes((prev) =>
      prev.map((athlete) =>
        athlete.athlete_id === result.athlete_id ? updateAthleteSessions(athlete, result) : athlete,
      ),
    );
    setSuccessNotice(
      `+${count} ${pluralSessions(count)} для ${athleteName}. Баланс: ${result.sessions_balance}`,
    );
    setSessionsModal(null);
  };

  const handleSessionsUpdated = (result: CoachAthleteSessionsResponse) => {
    setAthletes((prev) =>
      prev.map((athlete) =>
        athlete.athlete_id === result.athlete_id ? updateAthleteSessions(athlete, result) : athlete,
      ),
    );
  };

  const handleCreateAthlete = async () => {
    const name = newAthleteName.trim();
    if (!name) return;

    setCreatingAthlete(true);
    setActionError(null);
    try {
      const created = await createManagedAthlete({ display_name: name });
      setAthletes((prev) => [created, ...prev]);
      setNewAthleteName("");
      setShowAddForm(false);
      setProfileId(created.athlete_id);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Не удалось добавить атлета");
    } finally {
      setCreatingAthlete(false);
    }
  };

  const panelHeader = (
    <div className="coach-athletes__header">
      <p className="coach-athletes__hint text-secondary">Клиенты и учёт тренировок</p>
      <button
        type="button"
        className="coach-athletes__add-btn"
        aria-label="Добавить атлета"
        onClick={() => setShowAddForm((value) => !value)}
      >
        +
      </button>
    </div>
  );

  const addForm = showAddForm ? (
    <form
      className="coach-athletes__add-form glass glass--panel"
      onSubmit={(event) => {
        event.preventDefault();
        void handleCreateAthlete();
      }}
    >
      <label className="coach-athletes__add-label" htmlFor="managed-athlete-name">
        Имя атлета
      </label>
      <input
        id="managed-athlete-name"
        className="glass-input coach-athletes__add-input"
        type="text"
        value={newAthleteName}
        placeholder="Например, Иван"
        disabled={creatingAthlete}
        onChange={(event) => setNewAthleteName(event.target.value)}
      />
      <div className="coach-athletes__add-actions">
        <button
          type="button"
          className="coach-btn coach-btn--muted"
          disabled={creatingAthlete}
          onClick={() => {
            setShowAddForm(false);
            setNewAthleteName("");
          }}
        >
          Отмена
        </button>
        <button
          type="submit"
          className="coach-btn coach-btn--primary"
          disabled={creatingAthlete || !newAthleteName.trim()}
        >
          {creatingAthlete ? "Добавляем…" : "Добавить"}
        </button>
      </div>
    </form>
  ) : null;

  const sessionsModalElement = sessionsModal ? (
    <CoachAthleteAddSessionsModal
      athleteId={sessionsModal.athleteId}
      athleteName={sessionsModal.athleteName}
      currentBalance={sessionsModal.currentBalance}
      onClose={() => setSessionsModal(null)}
      onAdded={handleSessionsAdded}
    />
  ) : null;

  if (loading) {
    return (
      <>
        {panelHeader}
        <p className="text-muted">Загрузка атлетов…</p>
      </>
    );
  }
  if (error) {
    return (
      <>
        {panelHeader}
        <p className="auth-error">{error}</p>
      </>
    );
  }

  const profileAthlete = profileId ? athletes.find((a) => a.athlete_id === profileId) : null;

  if (profileAthlete) {
    return (
      <>
        {panelHeader}
        {addForm}
        {successNotice ? <p className="coach-athletes__notice">{successNotice}</p> : null}
        {actionError ? <p className="auth-error">{actionError}</p> : null}
        <CoachAthleteProfile
          athlete={profileAthlete}
          onBack={() => {
            setProfileId(null);
            onInitialProfileHandled?.();
          }}
          onBalanceClick={() => openSessionsModal(profileAthlete)}
          onSessionsUpdated={handleSessionsUpdated}
        />
        {sessionsModalElement}
      </>
    );
  }

  if (athletes.length === 0) {
    return (
      <>
        {panelHeader}
        {addForm}
        {actionError ? <p className="auth-error">{actionError}</p> : null}
        <p className="text-secondary">
          Пока нет атлетов. Добавь клиента кнопкой «+» или поделись приглашением — атлет с приложением
          появится здесь автоматически.
        </p>
      </>
    );
  }

  return (
    <>
      {panelHeader}
      {addForm}
      {successNotice ? <p className="coach-athletes__notice">{successNotice}</p> : null}
      {actionError ? <p className="auth-error">{actionError}</p> : null}
      <div className="coach-athletes">
        {athletes.map((athlete) => (
          <article key={athlete.athlete_id} className="coach-athlete-card">
            <div className="coach-athlete-card__row">
              <button
                type="button"
                className="coach-athlete-card__profile-link"
                onClick={() => setProfileId(athlete.athlete_id)}
              >
                <AthleteAvatar athlete={athlete} />
                <div className="coach-athlete-card__title-block">
                  <h3 className="coach-athlete-card__name">{athlete.display_name}</h3>
                  <AthleteAppStatus hasApp={athlete.has_app} />
                  <p className="coach-athlete-card__completed text-secondary">
                    Пройдено: <strong>{athlete.sessions_completed}</strong>
                  </p>
                </div>
              </button>
              <SessionsBalanceCircle
                balance={athlete.sessions_balance}
                onClick={() => openSessionsModal(athlete)}
              />
            </div>
          </article>
        ))}
      </div>
      {sessionsModalElement}
    </>
  );
}
