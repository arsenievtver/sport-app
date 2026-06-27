import { useState } from "react";
import { createAdminActivityCompendiumItem } from "@sport-app/api-client";
import { MANUAL_COMPENDIUM_CODE_PREFIX } from "@sport-app/shared";

import { MajorHeadingField } from "./MajorHeadingField";
import { Modal } from "./Modal";

interface ActivityCreateModalProps {
  majorHeadings: string[];
  headingLabels: Record<string, string>;
  onClose: () => void;
  onCreated: () => void;
}

interface FormState {
  major_heading: string;
  name_en: string;
  name_ru: string;
  met_value: string;
  is_active: boolean;
}

const EMPTY_FORM: FormState = {
  major_heading: "",
  name_en: "",
  name_ru: "",
  met_value: "",
  is_active: false,
};

export function ActivityCreateModal({
  majorHeadings,
  headingLabels,
  onClose,
  onCreated,
}: ActivityCreateModalProps) {
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const metRaw = form.met_value.trim().replace(",", ".");
    const met_value = Number(metRaw);
    if (!Number.isFinite(met_value) || met_value <= 0) {
      setError("Укажите корректное значение MET");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await createAdminActivityCompendiumItem({
        major_heading: form.major_heading.trim(),
        name_en: form.name_en.trim(),
        name_ru: form.name_ru.trim() || null,
        met_value,
        is_active: form.is_active,
      });
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось добавить активность");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title="Добавить активность" onClose={onClose}>
      <form className="admin-form" onSubmit={(event) => void handleSubmit(event)}>
        <p className="admin-form__hint text-secondary">
          Код Compendium присвоится автоматически (серия {MANUAL_COMPENDIUM_CODE_PREFIX}xxxx) — так ручные
          записи видно в таблице отдельно от импорта.
        </p>
        <div className="admin-field">
          <label htmlFor="create-activity-group">Группа</label>
          <MajorHeadingField
            id="create-activity-group"
            majorHeadings={majorHeadings}
            headingLabels={headingLabels}
            value={form.major_heading}
            allowCustom
            onChange={(major_heading) => setForm((current) => ({ ...current, major_heading }))}
          />
        </div>
        <div className="admin-field">
          <label htmlFor="create-activity-en">Название EN</label>
          <input
            id="create-activity-en"
            type="text"
            className="admin-input"
            required
            value={form.name_en}
            onChange={(event) => setForm((current) => ({ ...current, name_en: event.target.value }))}
          />
        </div>
        <div className="admin-field">
          <label htmlFor="create-activity-ru">Название RU</label>
          <input
            id="create-activity-ru"
            type="text"
            className="admin-input"
            value={form.name_ru}
            placeholder="Можно оставить пустым и перевести позже"
            onChange={(event) => setForm((current) => ({ ...current, name_ru: event.target.value }))}
          />
        </div>
        <div className="admin-field">
          <label htmlFor="create-activity-met">MET</label>
          <input
            id="create-activity-met"
            type="text"
            inputMode="decimal"
            className="admin-input"
            required
            placeholder="например: 5.8"
            value={form.met_value}
            onChange={(event) => setForm((current) => ({ ...current, met_value: event.target.value }))}
          />
        </div>
        <div className="admin-field admin-field--checkbox">
          <label htmlFor="create-activity-active">
            <input
              id="create-activity-active"
              type="checkbox"
              checked={form.is_active}
              onChange={(event) => setForm((current) => ({ ...current, is_active: event.target.checked }))}
            />
            Показывать атлетам в выборе активности
          </label>
        </div>
        {error ? <p className="auth-error">{error}</p> : null}
        <div className="admin-form__actions">
          <button type="submit" className="admin-btn admin-btn--primary" disabled={saving}>
            {saving ? "Добавляем…" : "Добавить"}
          </button>
          <button type="button" className="admin-btn" disabled={saving} onClick={onClose}>
            Отмена
          </button>
        </div>
      </form>
    </Modal>
  );
}
