import { useEffect, useState } from "react";
import {
  createCoach,
  deleteCoach,
  fetchAthletes,
  fetchCoaches,
  formatPhoneDisplay,
  isValidPhone,
  isValidPin,
  updateCoach,
} from "@sport-app/api-client";
import type { AdminAthlete, AdminCoach } from "@sport-app/shared";
import { LINK_STATUS_LABELS } from "@sport-app/shared";
import { PhoneInput, PinInput, StatusBadge } from "@sport-app/ui";

import { Modal } from "./Modal";

type FormMode = "create" | "edit";

interface CoachFormState {
  phone: string;
  pin: string;
  display_name: string;
  bio: string;
  is_verified: boolean;
  is_active: boolean;
  athlete_ids: string[];
}

const emptyForm = (): CoachFormState => ({
  phone: "",
  pin: "",
  display_name: "",
  bio: "",
  is_verified: false,
  is_active: true,
  athlete_ids: [],
});

export function CoachesTab() {
  const [coaches, setCoaches] = useState<AdminCoach[]>([]);
  const [athletes, setAthletes] = useState<AdminAthlete[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formMode, setFormMode] = useState<FormMode | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<CoachFormState>(emptyForm);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [coachList, athleteList] = await Promise.all([fetchCoaches(), fetchAthletes()]);
      setCoaches(coachList);
      setAthletes(athleteList);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось загрузить данные");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const openCreate = () => {
    setForm(emptyForm());
    setEditingId(null);
    setFormMode("create");
  };

  const openEdit = (coach: AdminCoach) => {
    setForm({
      phone: coach.phone,
      pin: "",
      display_name: coach.display_name,
      bio: coach.bio ?? "",
      is_verified: coach.is_verified,
      is_active: coach.is_active,
      athlete_ids: coach.athletes.map((a) => a.athlete_id),
    });
    setEditingId(coach.id);
    setFormMode("edit");
  };

  const closeForm = () => {
    setFormMode(null);
    setEditingId(null);
    setForm(emptyForm());
  };

  const toggleAthlete = (athleteId: string) => {
    setForm((prev) => ({
      ...prev,
      athlete_ids: prev.athlete_ids.includes(athleteId)
        ? prev.athlete_ids.filter((id) => id !== athleteId)
        : [...prev.athlete_ids, athleteId],
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.display_name.trim()) {
      setError("Укажите имя");
      return;
    }
    if (formMode === "create") {
      if (!isValidPhone(form.phone)) {
        setError("Введите корректный телефон");
        return;
      }
      if (!isValidPin(form.pin)) {
        setError("PIN — 6 цифр");
        return;
      }
    } else if (form.pin && !isValidPin(form.pin)) {
      setError("PIN — 6 цифр");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      if (formMode === "create") {
        await createCoach({
          phone: form.phone,
          pin: form.pin,
          display_name: form.display_name.trim(),
          bio: form.bio.trim() || null,
          is_verified: form.is_verified,
          athlete_ids: form.athlete_ids,
        });
      } else if (editingId) {
        await updateCoach(editingId, {
          display_name: form.display_name.trim(),
          bio: form.bio.trim() || null,
          is_verified: form.is_verified,
          is_active: form.is_active,
          pin: form.pin || undefined,
          athlete_ids: form.athlete_ids,
        });
      }
      closeForm();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка сохранения");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (coach: AdminCoach) => {
    if (!confirm(`Удалить тренера «${coach.display_name}»? Связи с атлетами будут удалены.`)) return;
    setError(null);
    try {
      await deleteCoach(coach.id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка удаления");
    }
  };

  return (
    <>
      {error && <div className="admin-error">{error}</div>}

      <div className="admin-toolbar">
        <p className="text-secondary" style={{ margin: 0 }}>
          {loading ? "Загрузка…" : `${coaches.length} тренеров`}
        </p>
        <button type="button" className="admin-btn admin-btn--primary" onClick={openCreate}>
          Добавить тренера
        </button>
      </div>

      <div className="admin-table-wrap">
        {loading ? (
          <div className="admin-empty">Загрузка…</div>
        ) : coaches.length === 0 ? (
          <div className="admin-empty">Тренеров пока нет</div>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>Имя</th>
                <th>Телефон</th>
                <th>Код</th>
                <th>Статус</th>
                <th>Атлеты</th>
                <th>Действия</th>
              </tr>
            </thead>
            <tbody>
              {coaches.map((coach) => (
                <tr key={coach.id}>
                  <td>
                    <strong>{coach.display_name}</strong>
                    {coach.is_verified && (
                      <span className="badge badge-primary" style={{ marginLeft: 8 }}>
                        ✓
                      </span>
                    )}
                  </td>
                  <td>{formatPhoneDisplay(coach.phone)}</td>
                  <td>
                    <code style={{ fontSize: "var(--text-xs)" }}>{coach.invite_code}</code>
                  </td>
                  <td>
                    <StatusBadge ok={coach.is_active} label={coach.is_active ? "Активен" : "Неактивен"} />
                  </td>
                  <td>
                    {coach.athletes.length === 0 ? (
                      <span className="text-muted">—</span>
                    ) : (
                      <div className="admin-links">
                        {coach.athletes.map((a) => (
                          <span key={a.link_id} className="admin-link-chip" title={LINK_STATUS_LABELS[a.status]}>
                            {a.display_name}
                          </span>
                        ))}
                      </div>
                    )}
                  </td>
                  <td>
                    <div className="admin-actions">
                      <button type="button" className="admin-btn" onClick={() => openEdit(coach)}>
                        Изменить
                      </button>
                      <button type="button" className="admin-btn admin-btn--danger" onClick={() => handleDelete(coach)}>
                        Удалить
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {formMode && (
        <Modal title={formMode === "create" ? "Новый тренер" : "Редактировать тренера"} onClose={closeForm}>
          <form className="admin-form" onSubmit={handleSubmit}>
            {formMode === "create" ? (
              <>
                <div className="admin-field">
                  <label htmlFor="coach-phone">Телефон</label>
                  <PhoneInput id="coach-phone" value={form.phone} onChange={(phone) => setForm((f) => ({ ...f, phone }))} />
                </div>
                <div className="admin-field">
                  <label htmlFor="coach-pin">PIN</label>
                  <PinInput id="coach-pin" value={form.pin} onChange={(pin) => setForm((f) => ({ ...f, pin }))} />
                </div>
              </>
            ) : (
              <>
                <div className="admin-field">
                  <label>Телефон</label>
                  <input type="text" value={formatPhoneDisplay(form.phone)} disabled />
                </div>
                <div className="admin-field">
                  <label htmlFor="coach-pin-edit">Новый PIN (необязательно)</label>
                  <PinInput id="coach-pin-edit" value={form.pin} onChange={(pin) => setForm((f) => ({ ...f, pin }))} />
                </div>
              </>
            )}

            <div className="admin-field">
              <label htmlFor="coach-name">Имя</label>
              <input
                id="coach-name"
                type="text"
                value={form.display_name}
                onChange={(e) => setForm((f) => ({ ...f, display_name: e.target.value }))}
                required
              />
            </div>

            <div className="admin-field">
              <label htmlFor="coach-bio">О себе</label>
              <textarea id="coach-bio" value={form.bio} onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))} />
            </div>

            <div className="admin-field admin-field--checkbox">
              <label>
                <input
                  type="checkbox"
                  checked={form.is_verified}
                  onChange={(e) => setForm((f) => ({ ...f, is_verified: e.target.checked }))}
                />
                Верифицирован
              </label>
            </div>

            {formMode === "edit" && (
              <div className="admin-field admin-field--checkbox">
                <label>
                  <input
                    type="checkbox"
                    checked={form.is_active}
                    onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
                  />
                  Активен
                </label>
              </div>
            )}

            <div className="admin-field">
              <label>Атлеты</label>
              {athletes.length === 0 ? (
                <p className="text-muted" style={{ margin: 0, fontSize: "var(--text-sm)" }}>
                  Сначала добавьте атлетов
                </p>
              ) : (
                <div className="admin-multi-select">
                  {athletes.map((athlete) => (
                    <label key={athlete.id} className="admin-multi-select__item">
                      <input
                        type="checkbox"
                        checked={form.athlete_ids.includes(athlete.id)}
                        onChange={() => toggleAthlete(athlete.id)}
                      />
                      {athlete.display_name}
                    </label>
                  ))}
                </div>
              )}
            </div>

            <div className="admin-form__actions">
              <button type="button" className="admin-btn" onClick={closeForm} disabled={saving}>
                Отмена
              </button>
              <button type="submit" className="admin-btn admin-btn--primary" disabled={saving}>
                {saving ? "Сохранение…" : "Сохранить"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
