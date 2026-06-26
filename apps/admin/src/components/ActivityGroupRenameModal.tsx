import { useEffect, useMemo, useState } from "react";
import {
  mergeAdminActivityCompendiumGroup,
  updateAdminActivityCompendiumGroupLabel,
} from "@sport-app/api-client";
import {
  defaultActivityMajorHeadingLabel,
  formatActivityMajorHeading,
} from "@sport-app/shared";

import { Modal } from "./Modal";

interface ActivityGroupRenameModalProps {
  majorHeadings: string[];
  headingLabels: Record<string, string>;
  onClose: () => void;
  onChanged: () => void;
}

type GroupChangeMode = "label" | "merge";

function sortHeadings(headings: string[], labels: Record<string, string>): string[] {
  return [...headings].sort((left, right) =>
    formatActivityMajorHeading(left, labels).localeCompare(formatActivityMajorHeading(right, labels), "ru"),
  );
}

export function ActivityGroupRenameModal({
  majorHeadings,
  headingLabels,
  onClose,
  onChanged,
}: ActivityGroupRenameModalProps) {
  const sortedHeadings = useMemo(
    () => sortHeadings(majorHeadings, headingLabels),
    [headingLabels, majorHeadings],
  );
  const [fromHeading, setFromHeading] = useState(sortedHeadings[0] ?? "");
  const [mode, setMode] = useState<GroupChangeMode>("label");
  const [labelRu, setLabelRu] = useState("");
  const [mergeInto, setMergeInto] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mergeTargets = useMemo(
    () => sortedHeadings.filter((heading) => heading !== fromHeading),
    [fromHeading, sortedHeadings],
  );

  const defaultLabel = defaultActivityMajorHeadingLabel(fromHeading);

  useEffect(() => {
    setLabelRu(headingLabels[fromHeading] ?? formatActivityMajorHeading(fromHeading, headingLabels));
  }, [fromHeading, headingLabels]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!fromHeading.trim()) {
      setError("Выберите группу");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      if (mode === "label") {
        const trimmed = labelRu.trim();
        if (!trimmed) {
          setError("Введите русское название");
          return;
        }
        await updateAdminActivityCompendiumGroupLabel({
          heading: fromHeading.trim(),
          label_ru: trimmed,
        });
      } else {
        if (!mergeInto.trim()) {
          setError("Выберите группу, с которой объединить");
          return;
        }
        if (fromHeading.trim() === mergeInto.trim()) {
          setError("Выберите другую группу для объединения");
          return;
        }
        const result = await mergeAdminActivityCompendiumGroup({
          from_heading: fromHeading.trim(),
          to_heading: mergeInto.trim(),
        });
        if (result.updated === 0) {
          setError("Ничего не изменилось — проверьте выбранные группы");
          return;
        }
      }
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось изменить группу");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title="Изменить группу" onClose={onClose}>
      <form className="admin-form" onSubmit={(event) => void handleSubmit(event)}>
        <p className="text-secondary admin-form__hint">
          Переименуйте русское название группы или объедините две группы. Чтобы перенести одну активность —
          откройте «Изменить» у неё.
        </p>

        <div className="admin-field">
          <label htmlFor="rename-group-from">Группа</label>
          <select
            id="rename-group-from"
            className="admin-input admin-select"
            required
            value={fromHeading}
            onChange={(event) => setFromHeading(event.target.value)}
          >
            {sortedHeadings.map((heading) => (
              <option key={heading} value={heading}>
                {formatActivityMajorHeading(heading, headingLabels)}
              </option>
            ))}
          </select>
          <p className="admin-field__hint text-secondary">Compendium: {fromHeading}</p>
        </div>

        <fieldset className="admin-field admin-fieldset">
          <legend>Что сделать</legend>
          <label className="admin-radio">
            <input
              type="radio"
              name="group-change-mode"
              checked={mode === "label"}
              onChange={() => setMode("label")}
            />
            <span>Изменить русское название</span>
          </label>
          <label className="admin-radio">
            <input
              type="radio"
              name="group-change-mode"
              checked={mode === "merge"}
              onChange={() => setMode("merge")}
            />
            <span>Объединить с другой группой</span>
          </label>
        </fieldset>

        {mode === "label" ? (
          <div className="admin-field">
            <label htmlFor="rename-group-label">Русское название</label>
            <input
              id="rename-group-label"
              type="text"
              className="admin-input"
              required
              value={labelRu}
              onChange={(event) => setLabelRu(event.target.value)}
            />
            {defaultLabel ? (
              <p className="admin-field__hint text-secondary">
                Стандартный перевод Compendium: {defaultLabel}
                {labelRu.trim() !== defaultLabel ? (
                  <>
                    {" "}
                    ·{" "}
                    <button
                      type="button"
                      className="admin-link-button"
                      onClick={() => setLabelRu(defaultLabel)}
                    >
                      Вернуть стандартный
                    </button>
                  </>
                ) : null}
              </p>
            ) : (
              <p className="admin-field__hint text-secondary">
                Для этой группы нет стандартного перевода в Compendium.
              </p>
            )}
          </div>
        ) : (
          <div className="admin-field">
            <label htmlFor="rename-group-merge">Объединить с группой</label>
            <select
              id="rename-group-merge"
              className="admin-input admin-select"
              required
              value={mergeInto}
              onChange={(event) => setMergeInto(event.target.value)}
            >
              <option value="" disabled>
                Выберите группу
              </option>
              {mergeTargets.map((heading) => (
                <option key={heading} value={heading}>
                  {formatActivityMajorHeading(heading, headingLabels)}
                </option>
              ))}
            </select>
            <p className="admin-field__hint text-secondary">
              Все активности из «{formatActivityMajorHeading(fromHeading, headingLabels)}» будут перенесены в
              выбранную группу. Группа «{formatActivityMajorHeading(fromHeading, headingLabels)}» исчезнет, если
              в ней не останется активностей.
            </p>
          </div>
        )}

        {error ? <p className="auth-error">{error}</p> : null}
        <div className="admin-form__actions">
          <button type="submit" className="admin-btn admin-btn--primary" disabled={saving}>
            {saving ? "Сохраняем…" : "Сохранить"}
          </button>
          <button type="button" className="admin-btn" disabled={saving} onClick={onClose}>
            Отмена
          </button>
        </div>
      </form>
    </Modal>
  );
}
