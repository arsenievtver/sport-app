import { useEffect, useId, useState } from "react";
import { searchAthleteMealDishes } from "@sport-app/api-client";
import type { MealDishSearchItem } from "@sport-app/shared";

interface MealDishSearchPickerProps {
  label?: string;
  placeholder?: string;
  disabled?: boolean;
  onSelect: (item: MealDishSearchItem) => void;
}

export function MealDishSearchPicker({
  label = "Найти в базе блюд",
  placeholder = "гречка, омлет, курица…",
  disabled = false,
  onSelect,
}: MealDishSearchPickerProps) {
  const listId = useId();
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<MealDishSearchItem[]>([]);
  const [searching, setSearching] = useState(false);
  const [open, setOpen] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setItems([]);
      setSearching(false);
      setSearchError(null);
      return;
    }

    setSearching(true);
    setSearchError(null);
    const timer = window.setTimeout(() => {
      void searchAthleteMealDishes(trimmed)
        .then((result) => {
          setItems(result.items);
          setOpen(true);
        })
        .catch((err: unknown) => {
          setItems([]);
          setSearchError(err instanceof Error ? err.message : "Не удалось выполнить поиск");
        })
        .finally(() => setSearching(false));
    }, 300);

    return () => window.clearTimeout(timer);
  }, [query]);

  return (
    <label className="meal-panel__field meal-dish-search">
      <span className="meal-panel__label text-secondary">{label}</span>
      <input
        type="search"
        className="meal-panel__input"
        placeholder={placeholder}
        value={query}
        disabled={disabled}
        aria-controls={listId}
        aria-expanded={open && items.length > 0}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
        }}
        onFocus={() => {
          if (items.length > 0) setOpen(true);
        }}
      />
      {searching ? <p className="meal-dish-search__hint text-muted">Ищем в базе…</p> : null}
      {searchError ? <p className="auth-error meal-dish-search__hint">{searchError}</p> : null}
      {open && items.length > 0 ? (
        <ul id={listId} className="meal-dish-search__results" role="listbox">
          {items.map((item) => (
            <li key={item.logmeal_dish_id}>
              <button
                type="button"
                className="meal-dish-search__option"
                disabled={disabled}
                onClick={() => {
                  onSelect(item);
                  setQuery(item.name);
                  setOpen(false);
                }}
              >
                <span>{item.name}</span>
                {item.portion_size_g != null ? (
                  <span className="meal-dish-search__portion text-secondary">~{Math.round(item.portion_size_g)} г</span>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {open && !searching && query.trim().length >= 2 && items.length === 0 && !searchError ? (
        <p className="meal-dish-search__hint text-secondary">Ничего не найдено</p>
      ) : null}
    </label>
  );
}
