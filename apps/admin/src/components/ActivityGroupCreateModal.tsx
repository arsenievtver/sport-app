import { useCallback, useEffect, useMemo, useState } from "react";
import {
  createAdminActivityCompendiumGroup,
  fetchAdminActivityCompendiumActivities,
  translateAdminActivityCompendiumGroupLabel,
} from "@sport-app/api-client";
import type { AdminActivityCompendiumItem } from "@sport-app/shared";
import {
  ACTIVITY_COMPENDIUM_PAGE_SIZE,
  formatActivityMajorHeading,
  formatMetValue,
} from "@sport-app/shared";

import { Modal } from "./Modal";

interface ActivityGroupCreateModalProps {
  majorHeadings: string[];
  headingLabels: Record<string, string>;
  translatorEnabled: boolean;
  onClose: () => void;
  onCreated: () => void;
}

function sortHeadings(headings: string[], labels: Record<string, string>): string[] {
  return [...headings].sort((left, right) =>
    formatActivityMajorHeading(left, labels).localeCompare(formatActivityMajorHeading(right, labels), "ru"),
  );
}

function activityDisplayName(item: AdminActivityCompendiumItem): string {
  return item.name_ru.trim() || item.name_en;
}

async function loadAllActivities(params: {
  q?: string;
  majorHeading?: string;
}): Promise<AdminActivityCompendiumItem[]> {
  const collected: AdminActivityCompendiumItem[] = [];
  let page = 1;
  let total = 0;

  do {
    const response = await fetchAdminActivityCompendiumActivities({
      page,
      pageSize: ACTIVITY_COMPENDIUM_PAGE_SIZE,
      q: params.q,
      majorHeading: params.majorHeading,
      sortBy: "name_ru",
      sortDir: "asc",
    });
    collected.push(...response.items);
    total = response.total;
    page += 1;
  } while (collected.length < total);

  return collected;
}

export function ActivityGroupCreateModal({
  majorHeadings,
  headingLabels,
  translatorEnabled,
  onClose,
  onCreated,
}: ActivityGroupCreateModalProps) {
  const sortedHeadings = useMemo(
    () => sortHeadings(majorHeadings, headingLabels),
    [headingLabels, majorHeadings],
  );

  const [labelRu, setLabelRu] = useState("");
  const [headingEn, setHeadingEn] = useState("");
  const [translating, setTranslating] = useState(false);
  const [filterHeading, setFilterHeading] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [activities, setActivities] = useState<AdminActivityCompendiumItem[]>([]);
  const [activitiesLoading, setActivitiesLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setSearchQuery(searchInput.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const loadActivities = useCallback(async () => {
    setActivitiesLoading(true);
    setError(null);
    try {
      const items = await loadAllActivities({
        q: searchQuery || undefined,
        majorHeading: filterHeading || undefined,
      });
      setActivities(items);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось загрузить активности");
      setActivities([]);
    } finally {
      setActivitiesLoading(false);
    }
  }, [filterHeading, searchQuery]);

  useEffect(() => {
    void loadActivities();
  }, [loadActivities]);

  const visibleIds = useMemo(() => activities.map((item) => item.id), [activities]);
  const allVisibleSelected =
    visibleIds.length > 0 && visibleIds.every((id) => selectedIds.has(id));
  const someVisibleSelected = visibleIds.some((id) => selectedIds.has(id));

  const toggleAllVisible = () => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (allVisibleSelected) {
        for (const id of visibleIds) {
          next.delete(id);
        }
      } else {
        for (const id of visibleIds) {
          next.add(id);
        }
      }
      return next;
    });
  };

  const toggleActivity = (id: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleTranslate = async () => {
    const trimmed = labelRu.trim();
    if (!trimmed) {
      setError("Введите русское название");
      return;
    }
    if (!translatorEnabled) {
      setError("Переводчик не настроен");
      return;
    }

    setTranslating(true);
    setError(null);
    try {
      const result = await translateAdminActivityCompendiumGroupLabel({ label_ru: trimmed });
      setHeadingEn(result.heading_en);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось перевести название");
    } finally {
      setTranslating(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    const trimmedLabel = labelRu.trim();
    const trimmedHeading = headingEn.trim();
    if (!trimmedLabel) {
      setError("Введите русское название");
      return;
    }
    if (!trimmedHeading) {
      setError("Укажите английское название группы (нажмите «Перевести» или введите вручную)");
      return;
    }
    if (selectedIds.size === 0) {
      setError("Выберите хотя бы одну активность для переноса");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const result = await createAdminActivityCompendiumGroup({
        label_ru: trimmedLabel,
        heading_en: trimmedHeading,
        activity_ids: [...selectedIds],
      });
      if (result.moved === 0) {
        setError("Группа создана, но активности не перенесены");
        return;
      }
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось создать группу");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title="Создать группу" wide onClose={onClose}>
      <form className="admin-form admin-form--group-create" onSubmit={(event) => void handleSubmit(event)}>
        <p className="text-secondary admin-form__hint">
          Задайте название группы, выберите активности из других групп — они будут перенесены в новую группу
          (не скопированы).
        </p>

        <div className="admin-field">
          <label htmlFor="create-group-label-ru">Русское название</label>
          <div className="admin-field-row">
            <input
              id="create-group-label-ru"
              type="text"
              className="admin-input"
              required
              value={labelRu}
              placeholder="Например: Силовые тренировки"
              onChange={(event) => setLabelRu(event.target.value)}
            />
            <button
              type="button"
              className="admin-btn"
              disabled={translating || saving || !translatorEnabled || !labelRu.trim()}
              onClick={() => void handleTranslate()}
            >
              {translating ? "…" : "Перевести"}
            </button>
          </div>
        </div>

        <div className="admin-field">
          <label htmlFor="create-group-heading-en">Английское название (Compendium)</label>
          <input
            id="create-group-heading-en"
            type="text"
            className="admin-input"
            required
            value={headingEn}
            placeholder="Strength Training"
            onChange={(event) => setHeadingEn(event.target.value)}
          />
          <p className="admin-field__hint text-secondary">
            Используется как ключ группы в базе. Можно отредактировать после перевода.
          </p>
        </div>

        <div className="admin-field admin-field--activity-picker">
          <label>Активности для переноса</label>
          <div className="admin-activity-picker">
            <div className="admin-activity-picker__toolbar">
              <select
                className="admin-input admin-select admin-input--compact"
                value={filterHeading}
                aria-label="Фильтр по группе"
                onChange={(event) => setFilterHeading(event.target.value)}
              >
                <option value="">Все группы</option>
                {sortedHeadings.map((heading) => (
                  <option key={heading} value={heading}>
                    {formatActivityMajorHeading(heading, headingLabels)}
                  </option>
                ))}
              </select>
              <input
                type="search"
                className="admin-input admin-input--compact"
                placeholder="Поиск по названию…"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
              />
              <span className="admin-activity-picker__count">
                Выбрано: {selectedIds.size}
                {activitiesLoading ? " · …" : ` · ${activities.length}`}
              </span>
            </div>

            {activitiesLoading ? (
              <p className="admin-activity-picker__empty">Загрузка активностей…</p>
            ) : activities.length === 0 ? (
              <p className="admin-activity-picker__empty">Ничего не найдено</p>
            ) : (
              <div className="admin-activity-picker__table-wrap">
                <table className="admin-activity-picker__table">
                  <thead>
                    <tr>
                      <th className="admin-activity-picker__col-check">
                        <input
                          type="checkbox"
                          aria-label="Выбрать все в списке"
                          checked={allVisibleSelected}
                          ref={(element) => {
                            if (element) {
                              element.indeterminate = someVisibleSelected && !allVisibleSelected;
                            }
                          }}
                          onChange={toggleAllVisible}
                        />
                      </th>
                      <th className="admin-activity-picker__col-name">Название</th>
                      <th className="admin-activity-picker__col-met">MET</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activities.map((item) => {
                      const name = activityDisplayName(item);
                      return (
                        <tr
                          key={item.id}
                          className="admin-activity-picker__data-row"
                          onClick={() => toggleActivity(item.id)}
                        >
                          <td className="admin-activity-picker__col-check">
                            <input
                              type="checkbox"
                              checked={selectedIds.has(item.id)}
                              aria-label={name}
                              onChange={() => toggleActivity(item.id)}
                              onClick={(event) => event.stopPropagation()}
                            />
                          </td>
                          <td className="admin-activity-picker__col-name" title={name}>
                            {name}
                          </td>
                          <td className="admin-activity-picker__col-met">
                            {formatMetValue(item.met_value)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {error ? <p className="auth-error">{error}</p> : null}
        <div className="admin-form__actions">
          <button
            type="submit"
            className="admin-btn admin-btn--primary"
            disabled={saving || translating || activitiesLoading}
          >
            {saving ? "Создаём…" : "Создать группу и перенести"}
          </button>
          <button type="button" className="admin-btn" disabled={saving} onClick={onClose}>
            Отмена
          </button>
        </div>
      </form>
    </Modal>
  );
}
