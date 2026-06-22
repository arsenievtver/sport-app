import { useEffect, useState } from "react";
import {
  createAthlete,
  deleteAthlete,
  fetchAthletes,
  fetchCoaches,
  formatPhoneDisplay,
  isValidPhone,
  isValidPin,
  updateAthlete,
} from "@sport-app/api-client";
import type { AdminAthlete, AdminCoach } from "@sport-app/shared";
import { LINK_STATUS_LABELS } from "@sport-app/shared";
import { PhoneInput, PinInput, StatusBadge } from "@sport-app/ui";

import { Modal } from "./Modal";

type FormMode = "create" | "edit";

interface AthleteFormState {
  phone: string;
  pin: string;
  display_name: string;
  birth_date: string;
  timezone: string;
  is_active: boolean;
  coach_ids: string[];
}

const emptyForm = (): AthleteFormState => ({
  phone: "",
  pin: "",
  display_name: "",
  birth_date: "",
  timezone: "Europe/Moscow",
  is_active: true,
  coach_ids: [],
});

export function AthletesTab() {
  const [athletes, setAthletes] = useState<AdminAthlete[]>([]);
  const [coaches, setCoaches] = useState<AdminCoach[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formMode, setFormMode] = useState<FormMode | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<AthleteFormState>(emptyForm);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [athleteList, coachList] = await Promise.all([fetchAthletes(), fetchCoaches()]);
      setAthletes(athleteList);
      setCoaches(coachList);
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

  const openEdit = (athlete: AdminAthlete) => {
    setForm({
      phone: athlete.phone ?? "",
      pin: "",
      display_name: athlete.display_name,
      birth_date: athlete.birth_date ?? "",
      timezone: athlete.timezone,
      is_active: athlete.is_active,
      coach_ids: athlete.coaches.map((c) => c.coach_id),
    });
    setEditingId(athlete.id);
    setFormMode("edit");
  };

  const closeForm = () => {
    setFormMode(null);
    setEditingId(null);
    setForm(emptyForm());
  };

  const toggleCoach = (coachId: string) => {
    setForm((prev) => ({
      ...prev,
      coach_ids: prev.coach_ids.includes(coachId)
        ? prev.coach_ids.filter((id) => id !== coachId)
        : [...prev.coach_ids, coachId],
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
      const birthDate = form.birth_date.trim() || null;
      if (formMode === "create") {
        await createAthlete({
          phone: form.phone,
          pin: form.pin,
          display_name: form.display_name.trim(),
          birth_date: birthDate,
          timezone: form.timezone.trim() || "UTC",
          coach_ids: form.coach_ids,
        });
      } else if (editingId) {
        await updateAthlete(editingId, {
          display_name: form.display_name.trim(),
          birth_date: birthDate,
          timezone: form.timezone.trim() || "UTC",
          is_active: form.is_active,
          pin: form.pin || undefined,
          coach_ids: form.coach_ids,
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

  const handleDelete = async (athlete: AdminAthlete) => {
    if (!confirm(`Удалить атлета «${athlete.display_name}»? Связи с тренерами будут удалены.`)) return;
    setError(null);
    try {
      await deleteAthlete(athlete.id);
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
          {loading ? "Загрузка…" : `${athletes.length} атлетов`}
        </p>
        <button type="button" className="admin-btn admin-btn--primary" onClick={openCreate}>
          Добавить атлета
        </button>
      </div>

      <div className="admin-table-wrap">
        {loading ? (
          <div className="admin-empty">Загрузка…</div>
        ) : athletes.length === 0 ? (
          <div className="admin-empty">Атлетов пока нет</div>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>Имя</th>
                <th>Телефон</th>
                <th>Часовой пояс</th>
                <th>Статус</th>
                <th>Тренеры</th>
                <th>Действия</th>
              </tr>
            </thead>
            <tbody>
              {athletes.map((athlete) => (
                <tr key={athlete.id}>
                  <td>
                    <strong>{athlete.display_name}</strong>
                    {athlete.birth_date && (
                      <div className="text-muted" style={{ fontSize: "var(--text-xs)", marginTop: 2 }}>
                        {athlete.birth_date}
                      </div>
                    )}
                  </td>
                  <td>
                    {athlete.is_managed || !athlete.phone ? (
                      <span className="text-muted" title="Создан тренером, без входа в приложение">
                        без приложения
                      </span>
                    ) : (
                      formatPhoneDisplay(athlete.phone)
                    )}
                  </td>
                  <td>{athlete.timezone}</td>
                  <td>
                    {athlete.is_managed ? (
                      <StatusBadge ok label="У тренера" />
                    ) : (
                      <StatusBadge ok={athlete.is_active} label={athlete.is_active ? "Активен" : "Неактивен"} />
                    )}
                  </td>
                  <td>
                    {athlete.coaches.length === 0 ? (
                      <span className="text-muted">—</span>
                    ) : (
                      <div className="admin-links">
                        {athlete.coaches.map((c) => (
                          <span key={c.link_id} className="admin-link-chip admin-link-chip--muted" title={LINK_STATUS_LABELS[c.status]}>
                            {c.display_name}
                          </span>
                        ))}
                      </div>
                    )}
                  </td>
                  <td>
                    <div className="admin-actions">
                      <button type="button" className="admin-btn" onClick={() => openEdit(athlete)}>
                        Изменить
                      </button>
                      <button type="button" className="admin-btn admin-btn--danger" onClick={() => handleDelete(athlete)}>
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
        <Modal title={formMode === "create" ? "Новый атлет" : "Редактировать атлета"} onClose={closeForm}>
          <form className="admin-form" onSubmit={handleSubmit}>
            {formMode === "create" ? (
              <>
                <div className="admin-field">
                  <label htmlFor="athlete-phone">Телефон</label>
                  <PhoneInput id="athlete-phone" value={form.phone} onChange={(phone) => setForm((f) => ({ ...f, phone }))} />
                </div>
                <div className="admin-field">
                  <label htmlFor="athlete-pin">PIN</label>
                  <PinInput id="athlete-pin" value={form.pin} onChange={(pin) => setForm((f) => ({ ...f, pin }))} />
                </div>
              </>
            ) : (
              <>
                <div className="admin-field">
                  <label>Телефон</label>
                  <input
                    type="text"
                    value={form.phone ? formatPhoneDisplay(form.phone) : "без приложения"}
                    disabled
                  />
                </div>
                {!editingId || athletes.find((item) => item.id === editingId)?.is_managed ? null : (
                  <div className="admin-field">
                    <label htmlFor="athlete-pin-edit">Новый PIN (необязательно)</label>
                    <PinInput id="athlete-pin-edit" value={form.pin} onChange={(pin) => setForm((f) => ({ ...f, pin }))} />
                  </div>
                )}
              </>
            )}

            <div className="admin-field">
              <label htmlFor="athlete-name">Имя</label>
              <input
                id="athlete-name"
                type="text"
                value={form.display_name}
                onChange={(e) => setForm((f) => ({ ...f, display_name: e.target.value }))}
                required
              />
            </div>

            <div className="admin-field">
              <label htmlFor="athlete-birth">Дата рождения</label>
              <input
                id="athlete-birth"
                type="date"
                value={form.birth_date}
                onChange={(e) => setForm((f) => ({ ...f, birth_date: e.target.value }))}
              />
            </div>

            <div className="admin-field">
              <label htmlFor="athlete-tz">Часовой пояс</label>
              <input
                id="athlete-tz"
                type="text"
                value={form.timezone}
                onChange={(e) => setForm((f) => ({ ...f, timezone: e.target.value }))}
              />
            </div>

            {formMode === "edit" && editingId && !athletes.find((item) => item.id === editingId)?.is_managed && (
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
              <label>Тренеры</label>
              {coaches.length === 0 ? (
                <p className="text-muted" style={{ margin: 0, fontSize: "var(--text-sm)" }}>
                  Сначала добавьте тренеров
                </p>
              ) : (
                <div className="admin-multi-select">
                  {coaches.map((coach) => (
                    <label key={coach.id} className="admin-multi-select__item">
                      <input
                        type="checkbox"
                        checked={form.coach_ids.includes(coach.id)}
                        onChange={() => toggleCoach(coach.id)}
                      />
                      {coach.display_name}
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
