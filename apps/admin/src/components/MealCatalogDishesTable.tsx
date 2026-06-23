import { useCallback, useEffect, useState } from "react";
import {
  deleteAdminMealCatalogDish,
  fetchAdminMealCatalogDishes,
  updateAdminMealCatalogDish,
} from "@sport-app/api-client";
import type { AdminMealCatalogDish } from "@sport-app/shared";
import {
  MEAL_CATALOG_DISH_PAGE_SIZE,
  formatMealCatalogDishType,
} from "@sport-app/shared";

import { Modal } from "./Modal";

interface EditFormState {
  name_ru: string;
  portion_size_g: string;
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

function formatPortion(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1).replace(".", ",");
}

function dishToEditForm(dish: AdminMealCatalogDish): EditFormState {
  return {
    name_ru: dish.name_ru ?? "",
    portion_size_g: dish.portion_size_g != null ? String(dish.portion_size_g) : "",
  };
}

interface MealCatalogDishesTableProps {
  refreshKey?: number;
  onDataChanged?: () => void;
}

export function MealCatalogDishesTable({ refreshKey = 0, onDataChanged }: MealCatalogDishesTableProps) {
  const [items, setItems] = useState<AdminMealCatalogDish[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingDish, setEditingDish] = useState<AdminMealCatalogDish | null>(null);
  const [editForm, setEditForm] = useState<EditFormState>({ name_ru: "", portion_size_g: "" });
  const [saving, setSaving] = useState(false);

  const totalPages = Math.max(1, Math.ceil(total / MEAL_CATALOG_DISH_PAGE_SIZE));

  const loadDishes = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchAdminMealCatalogDishes({
        page,
        pageSize: MEAL_CATALOG_DISH_PAGE_SIZE,
        q: query || undefined,
      });
      setItems(data.items);
      setTotal(data.total);
      if (data.page !== page) {
        setPage(data.page);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось загрузить каталог");
    } finally {
      setLoading(false);
    }
  }, [page, query]);

  useEffect(() => {
    void loadDishes();
  }, [loadDishes, refreshKey]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setPage(1);
      setQuery(searchInput.trim());
    }, 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const openEdit = (dish: AdminMealCatalogDish) => {
    setEditingDish(dish);
    setEditForm(dishToEditForm(dish));
    setError(null);
  };

  const closeEdit = () => {
    setEditingDish(null);
    setEditForm({ name_ru: "", portion_size_g: "" });
  };

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editingDish) return;

    const portionRaw = editForm.portion_size_g.trim().replace(",", ".");
    let portion_size_g: number | null = null;
    if (portionRaw) {
      const parsed = Number(portionRaw);
      if (!Number.isFinite(parsed) || parsed < 0) {
        setError("Укажите корректный вес порции в граммах");
        return;
      }
      portion_size_g = parsed;
    }

    setSaving(true);
    setError(null);
    try {
      await updateAdminMealCatalogDish(editingDish.logmeal_id, {
        name_ru: editForm.name_ru.trim() || null,
        portion_size_g,
      });
      closeEdit();
      await loadDishes();
      onDataChanged?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось сохранить изменения");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (dish: AdminMealCatalogDish) => {
    const label = dish.name_ru || dish.name_en;
    if (!window.confirm(`Удалить «${label}» (ID ${dish.logmeal_id}) из локального каталога?`)) {
      return;
    }

    setError(null);
    try {
      await deleteAdminMealCatalogDish(dish.logmeal_id);
      if (items.length === 1 && page > 1) {
        setPage((current) => current - 1);
      } else {
        await loadDishes();
      }
      onDataChanged?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось удалить блюдо");
    }
  };

  return (
    <section className="admin-catalog__table-section">
      <div className="admin-catalog__table-header">
        <h2 className="admin-catalog__table-title">Позиции в базе</h2>
        <div className="admin-catalog__table-search">
          <input
            type="search"
            className="admin-input"
            placeholder="Поиск по ID, EN или RU…"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
          />
        </div>
      </div>

      <p className="admin-catalog__table-meta text-secondary">
        {loading ? "Загрузка…" : `Показано ${items.length} из ${total} · страница ${page} из ${totalPages}`}
        {!loading ? (
          <span className="admin-catalog__table-note">
            {" "}
            · Порция — справочный размер из LogMeal при синхронизации; если пусто, задайте вручную или смотрите вес
            при выборе блюда у атлета
          </span>
        ) : null}
      </p>

      <div className="admin-table-wrap">
        {loading && items.length === 0 ? (
          <div className="admin-empty">Загрузка каталога…</div>
        ) : items.length === 0 ? (
          <div className="admin-empty">
            {query ? "Ничего не найдено по запросу" : "Каталог пуст — сначала обновите из LogMeal"}
          </div>
        ) : (
          <table className="admin-table admin-table--catalog">
            <thead>
              <tr>
                <th>ID</th>
                <th>Название EN</th>
                <th>Название RU</th>
                <th>Порция, г</th>
                <th>Тип</th>
                <th>Обновлено</th>
                <th>Действия</th>
              </tr>
            </thead>
            <tbody>
              {items.map((dish) => (
                <tr key={dish.logmeal_id}>
                  <td className="admin-table__mono">{dish.logmeal_id}</td>
                  <td>{dish.name_en}</td>
                  <td>{dish.name_ru ?? <span className="text-muted">—</span>}</td>
                  <td>{formatPortion(dish.portion_size_g)}</td>
                  <td>{formatMealCatalogDishType(dish.dish_type)}</td>
                  <td className="admin-table__nowrap">{formatCatalogDate(dish.updated_at)}</td>
                  <td>
                    <div className="admin-actions">
                      <button type="button" className="admin-btn" onClick={() => openEdit(dish)}>
                        Изменить
                      </button>
                      <button
                        type="button"
                        className="admin-btn admin-btn--danger"
                        onClick={() => void handleDelete(dish)}
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

      {editingDish ? (
        <Modal title={`Редактировать: ${editingDish.name_en}`} onClose={closeEdit}>
          <form className="admin-form" onSubmit={(event) => void handleSave(event)}>
            <div className="admin-field">
              <label htmlFor="catalog-dish-id">LogMeal ID</label>
              <input id="catalog-dish-id" type="text" value={editingDish.logmeal_id} disabled />
            </div>
            <div className="admin-field">
              <label htmlFor="catalog-dish-en">Название EN</label>
              <input id="catalog-dish-en" type="text" value={editingDish.name_en} disabled />
            </div>
            <div className="admin-field">
              <label htmlFor="catalog-dish-ru">Название RU</label>
              <input
                id="catalog-dish-ru"
                type="text"
                value={editForm.name_ru}
                placeholder="Русское название для поиска атлетов"
                onChange={(event) => setEditForm((current) => ({ ...current, name_ru: event.target.value }))}
              />
            </div>
            <div className="admin-field">
              <label htmlFor="catalog-dish-portion">Порция, г</label>
              <input
                id="catalog-dish-portion"
                type="text"
                inputMode="decimal"
                value={editForm.portion_size_g}
                placeholder="например: 100"
                onChange={(event) =>
                  setEditForm((current) => ({ ...current, portion_size_g: event.target.value }))
                }
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
