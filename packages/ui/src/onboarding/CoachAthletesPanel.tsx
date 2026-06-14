import { useEffect, useState } from "react";
import { fetchCoachAthletes } from "@sport-app/api-client";
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

  useEffect(() => {
    fetchCoachAthletes()
      .then(setAthletes)
      .catch((err) => setError(err instanceof Error ? err.message : "Ошибка загрузки"))
      .finally(() => setLoading(false));
  }, []);

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
    <div className="coach-athletes">
      {athletes.map((athlete) => {
        const onboarded = Boolean(athlete.onboarding_completed_at);
        const traits = [
          "strength",
          "flexibility",
          "endurance",
          "coordination",
        ] as TrainingTrait[];

        return (
          <article key={athlete.athlete_id} className="coach-athlete-card">
            <h3 className="coach-athlete-card__name">{athlete.display_name}</h3>
            <p className="coach-athlete-card__meta text-muted">
              {athlete.gender ? GENDER_LABELS[athlete.gender] : "Пол не указан"}
              {formatBirthDate(athlete.birth_date) ? ` · ${formatBirthDate(athlete.birth_date)}` : ""}
            </p>

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
          </article>
        );
      })}
    </div>
  );
}
