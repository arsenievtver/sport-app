import { useCallback, useEffect, useState } from "react";
import {
  deleteAdminActivityCompendiumItem,
  fetchAdminActivityCompendiumActivities,
  updateAdminActivityCompendiumItem,
} from "@sport-app/api-client";
import type { AdminActivityCompendiumItem } from "@sport-app/shared";
import {
  ACTIVITY_COMPENDIUM_DEFAULT_SORT_BY,
  ACTIVITY_COMPENDIUM_DEFAULT_SORT_DIR,
  ACTIVITY_COMPENDIUM_PAGE_SIZE,
  activityCompendiumSortIndicator,
  formatActivityMajorHeading,
  formatMetValue,
} from "@sport-app/shared";
import type { ActivityCompendiumSortDir, ActivityCompendiumSortField } from "@sport-app/shared";

import { AdminSwitch } from "./AdminSwitch";
import { Modal } from "./Modal";

type AppFilter = "" | "active" | "inactive";

interface EditFormState {
  name_ru: string;
}

function formatCatalogDate(isoDateTime: string): string {
  const date = new Date(isoDateTime);
  if (Number.isNaN(date.getTime())) return isoDateTime;
  return date.toLocaleString("ru-RU", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

interface ActivityCompendiumTableProps {
  refreshKey?: number;
  majorHeadings: string[];
  onDataChanged?: () => void;
}

export function ActivityCompendiumTable({
  refreshKey = 0,
  majorHeadings,
  onDataChanged,
}: ActivityCompendiumTableProps) {
  const [items, setItems] = useState<AdminActivityCompendiumItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [majorHeading, setMajorHeading] = useState("");
  const [appFilter, setAppFilter] = useState<AppFilter>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingItem, setEditingItem] = useState<AdminActivityCompendiumItem | null>(null);
  const [editForm, setEditForm] = useState<EditFormState>({ name_ru: "" });
  const [saving, setSaving] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<ActivityCompendiumSortField>(ACTIVITY_COMPENDIUM_DEFAULT_SORT_BY);
  const [sortDir, setSortDir] = useState<ActivityCompendiumSortDir>(ACTIVITY_COMPENDIUM_DEFAULT_SORT_DIR);

  const totalPages = Math.max(1, Math.ceil(total / ACTIVITY_COMPENDIUM_PAGE_SIZE));

  const handleSort = (field: ActivityCompendiumSortField) => {
    setPage(1);
    if (sortBy === field) {
      setSortDir((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }
    setSortBy(field);
    setSortDir("asc");
  };

  const sortableHeader = (field: ActivityCompendiumSortField, label: string) => (
    <th key={field}>
      <button
        type="button"
        className={`admin-table__sort${sortBy === field ? " admin-table__sort--active" : ""}`}
        onClick={() => handleSort(field)}
      >
        {label}
        <span className="admin-table__sort-indicator" aria-hidden="true">
          {activityCompendiumSortIndicator(field, sortBy, sortDir)}
        </span>
      </button>
    </th>
  );

  const loadActivities = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchAdminActivityCompendiumActivities({
        page,
        pageSize: ACTIVITY_COMPENDIUM_PAGE_SIZE,
        q: query || undefined,
        majorHeading: majorHeading || undefined,
        isActive: appFilter === "" ? undefined : appFilter === "active",
        sortBy,
        sortDir,
      });
      setItems(data.items);
      setTotal(data.total);
      if (data.page !== page) {
        setPage(data.page);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось загрузить справочник");
    } finally {
      setLoading(false);
    }
  }, [page, query, majorHeading, appFilter, sortBy, sortDir]);

  useEffect(() => {
    void loadActivities();
  }, [loadActivities, refreshKey]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setPage(1);
      setQuery(searchInput.trim());
    }, 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const openEdit = (item: AdminActivityCompendiumItem) => {
    setEditingItem(item);
    setEditForm({ name_ru: item.name_ru || "" });
    setError(null);
  };

  const closeEdit = () => {
    setEditingItem(null);
    setEditForm({ name_ru: "" });
  };

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editingItem) return;

    setSaving(true);
    setError(null);
    try {
      await updateAdminActivityCompendiumItem(editingItem.id, {
        name_ru: editForm.name_ru.trim() || null,
      });
      closeEdit();
      await loadActivities();
      onDataChanged?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось сохранить изменения");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (item: AdminActivityCompendiumItem, nextActive: boolean) => {
    setTogglingId(item.id);
    setError(null);
    setItems((current) =>
      current.map((row) => (row.id === item.id ? { ...row, is_active: nextActive } : row)),
    );

    try {
      await updateAdminActivityCompendiumItem(item.id, { is_active: nextActive });
      onDataChanged?.();
      if (appFilter === "active" && !nextActive) {
        await loadActivities();
      } else if (appFilter === "inactive" && nextActive) {
        await loadActivities();
      }
    } catch (err) {
      setItems((current) =>
        current.map((row) => (row.id === item.id ? { ...row, is_active: item.is_active } : row)),
      );
      setError(err instanceof Error ? err.message : "Не удалось обновить видимость");
    } finally {
      setTogglingId(null);
    }
  };

  const handleDelete = async (item: AdminActivityCompendiumItem) => {
    const label = item.name_ru || item.name_en;
    if (!window.confirm(`Удалить «${label}» (код ${item.compendium_code}) из справочника?`)) {
      return;
    }

    setError(null);
    try {
      await deleteAdminActivityCompendiumItem(item.id);
      if (items.length === 1 && page > 1) {
        setPage((current) => current - 1);
      } else {
        await loadActivities();
      }
      onDataChanged?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось удалить активность");
    }
  };

  const hasFilters = Boolean(query || majorHeading || appFilter);

  return (
    <section className="admin-catalog__table-section">
      <div className="admin-catalog__table-header">
        <h2 className="admin-catalog__table-title">Активности в базе</h2>
        <div className="admin-catalog__table-search admin-catalog__table-filters">
          <select
            className="admin-input"
            value={appFilter}
            onChange={(event) => {
              setPage(1);
              setAppFilter(event.target.value as AppFilter);
            }}
          >
            <option value="">В приложении: все</option>
            <option value="active">Подключены к приложению</option>
            <option value="inactive">Не подключены</option>
          </select>
          <select
            className="admin-input"
            value={majorHeading}
            onChange={(event) => {
              setPage(1);
              setMajorHeading(event.target.value);
            }}
          >
            <option value="">Все группы</option>
            {majorHeadings.map((heading) => (
              <option key={heading} value={heading}>
                {formatActivityMajorHeading(heading)}
              </option>
            ))}
          </select>
          <input
            type="search"
            className="admin-input"
            placeholder="Поиск по коду, EN или RU…"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
          />
        </div>
      </div>

      <p className="admin-catalog__table-meta text-secondary">
        {loading ? "Загрузка…" : `Показано ${items.length} из ${total} · страница ${page} из ${totalPages}`}
      </p>

      <div className="admin-table-wrap">
        {loading && items.length === 0 ? (
          <div className="admin-empty">Загрузка справочника…</div>
        ) : items.length === 0 ? (
          <div className="admin-empty">
            {hasFilters ? "Ничего не найдено по фильтрам" : "Справочник пуст — загрузите PDF"}
          </div>
        ) : (
          <table className="admin-table admin-table--catalog">
            <thead>
              <tr>
                {sortableHeader("compendium_code", "Код")}
                {sortableHeader("major_heading", "Группа")}
                {sortableHeader("name_en", "Название EN")}
                {sortableHeader("name_ru", "Название RU")}
                {sortableHeader("met_value", "MET")}
                {sortableHeader("is_active", "В приложении")}
                {sortableHeader("updated_at", "Обновлено")}
                <th>Действия</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td className="admin-table__mono">{item.compendium_code}</td>
                  <td>{formatActivityMajorHeading(item.major_heading)}</td>
                  <td>{item.name_en}</td>
                  <td>{item.name_ru ? item.name_ru : <span className="text-muted">—</span>}</td>
                  <td>{formatMetValue(item.met_value)}</td>
                  <td>
                    <AdminSwitch
                      checked={item.is_active}
                      disabled={togglingId === item.id}
                      label={
                        item.is_active
                          ? "Активность видна атлетам — выключить"
                          : "Активность скрыта — включить для атлетов"
                      }
                      onChange={(nextActive) => void handleToggleActive(item, nextActive)}
                    />
                  </td>
                  <td className="admin-table__nowrap">{formatCatalogDate(item.updated_at)}</td>
                  <td>
                    <div className="admin-actions">
                      <button type="button" className="admin-btn" onClick={() => openEdit(item)}>
                        Изменить
                      </button>
                      <button
                        type="button"
                        className="admin-btn admin-btn--danger"
                        onClick={() => void handleDelete(item)}
                      >
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

      {totalPages > 1 ? (
        <div className="admin-catalog__pagination">
          <button
            type="button"
            className="admin-btn"
            disabled={loading || page <= 1}
            onClick={() => setPage((current) => Math.max(1, current - 1))}
          >
            Назад
          </button>
          <span className="admin-catalog__pagination-label text-secondary">
            {page} / {totalPages}
          </span>
          <button
            type="button"
            className="admin-btn"
            disabled={loading || page >= totalPages}
            onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
          >
            Вперёд
          </button>
        </div>
      ) : null}

      {error ? <p className="auth-error">{error}</p> : null}

      {editingItem ? (
        <Modal title={`Редактировать: ${editingItem.name_en}`} onClose={closeEdit}>
          <form className="admin-form" onSubmit={(event) => void handleSave(event)}>
            <div className="admin-field">
              <label htmlFor="activity-code">Код Compendium</label>
              <input id="activity-code" type="text" value={editingItem.compendium_code} disabled />
            </div>
            <div className="admin-field">
              <label htmlFor="activity-en">Название EN</label>
              <input id="activity-en" type="text" value={editingItem.name_en} disabled />
            </div>
            <div className="admin-field">
              <label htmlFor="activity-ru">Название RU</label>
              <input
                id="activity-ru"
                type="text"
                value={editForm.name_ru}
                placeholder="Русское название"
                onChange={(event) => setEditForm((current) => ({ ...current, name_ru: event.target.value }))}
              />
            </div>
            <div className="admin-form__actions">
              <button type="submit" className="admin-btn admin-btn--primary" disabled={saving}>
                {saving ? "Сохраняем…" : "Сохранить"}
              </button>
              <button type="button" className="admin-btn" disabled={saving} onClick={closeEdit}>
                Отмена
              </button>
            </div>
          </form>
        </Modal>
      ) : null}
    </section>
  );
}
