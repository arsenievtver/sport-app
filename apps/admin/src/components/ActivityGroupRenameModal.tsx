import { useState } from "react";
import { renameAdminActivityCompendiumGroup } from "@sport-app/api-client";
import { formatActivityMajorHeading } from "@sport-app/shared";

import { MajorHeadingField } from "./MajorHeadingField";
import { Modal } from "./Modal";

interface ActivityGroupRenameModalProps {
  majorHeadings: string[];
  onClose: () => void;
  onRenamed: () => void;
}

export function ActivityGroupRenameModal({ majorHeadings, onClose, onRenamed }: ActivityGroupRenameModalProps) {
  const [fromHeading, setFromHeading] = useState(majorHeadings[0] ?? "");
  const [toHeading, setToHeading] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const result = await renameAdminActivityCompendiumGroup({
        from_heading: fromHeading.trim(),
        to_heading: toHeading.trim(),
      });
      if (result.updated === 0) {
        setError("Ничего не изменилось — проверьте названия групп");
        return;
      }
      onRenamed();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось переименовать группу");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title="Переименовать группу" onClose={onClose}>
      <form className="admin-form" onSubmit={(event) => void handleSubmit(event)}>
        <p className="text-secondary admin-form__hint">
          Переименование затронет все активности в выбранной группе. Чтобы перенести одну позицию в другую
          группу — откройте «Изменить» у этой активности.
        </p>
        <div className="admin-field">
          <label htmlFor="rename-group-from">Текущая группа</label>
          <select
            id="rename-group-from"
            className="admin-input"
            required
            value={fromHeading}
            onChange={(event) => setFromHeading(event.target.value)}
          >
            {majorHeadings.map((heading) => (
              <option key={heading} value={heading}>
                {formatActivityMajorHeading(heading)} ({heading})
              </option>
            ))}
          </select>
        </div>
        <div className="admin-field">
          <label htmlFor="rename-group-to">Новое название группы</label>
          <MajorHeadingField
            id="rename-group-to"
            majorHeadings={majorHeadings}
            value={toHeading}
            onChange={setToHeading}
          />
        </div>
        {error ? <p className="auth-error">{error}</p> : null}
        <div className="admin-form__actions">
          <button type="submit" className="admin-btn admin-btn--primary" disabled={saving}>
            {saving ? "Сохраняем…" : "Переименовать"}
          </button>
          <button type="button" className="admin-btn" disabled={saving} onClick={onClose}>
            Отмена
          </button>
        </div>
      </form>
    </Modal>
  );
}
