import { useEffect, useId, useState } from "react";
import { searchAthleteMealDishes } from "@sport-app/api-client";
import type { MealDishSearchItem } from "@sport-app/shared";

interface MealDishSearchPickerProps {
  label?: string;
  placeholder?: string;
  disabled?: boolean;
  inactive?: boolean;
  hideLabel?: boolean;
  catalogDishCount?: number | null;
  resetQueryOnSelect?: boolean;
  inputClassName?: string;
  onFocus?: () => void;
  onBlur?: () => void;
  onSelect: (item: MealDishSearchItem) => void;
}

export function MealDishSearchPicker({
  label = "Найти в базе блюд",
  placeholder = "введите название блюда",
  disabled = false,
  inactive = false,
  hideLabel = false,
  catalogDishCount = null,
  resetQueryOnSelect = false,
  inputClassName = "meal-panel__input",
  onFocus,
  onBlur,
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

  const isDisabled = disabled || inactive;
  const rootClassName = `meal-dish-search${inactive ? " meal-dish-search--inactive" : ""}${hideLabel ? " meal-dish-search--compact" : ""}`;
  const input = (
    <input
      type="search"
      className={inputClassName}
      placeholder={placeholder}
      value={query}
      disabled={isDisabled}
      aria-label={hideLabel ? label : undefined}
      aria-controls={listId}
      aria-expanded={open && items.length > 0}
      onChange={(event) => {
        setQuery(event.target.value);
        setOpen(true);
      }}
      onFocus={() => {
        onFocus?.();
        if (items.length > 0) setOpen(true);
      }}
      onBlur={() => {
        onBlur?.();
      }}
    />
  );

  const hints = (
    <>
      {!hideLabel && catalogDishCount === 0 ? (
        <p className="meal-dish-search__hint text-secondary">
          База пуста — попросите админа обновить каталог в админке.
        </p>
      ) : null}
      {searching ? <p className="meal-dish-search__hint text-muted">Ищем в базе…</p> : null}
      {searchError ? <p className="auth-error meal-dish-search__hint">{searchError}</p> : null}
      {open && items.length > 0 ? (
        <ul id={listId} className="meal-dish-search__results" role="listbox">
          {items.map((item) => (
            <li key={item.logmeal_dish_id}>
              <button
                type="button"
                className="meal-dish-search__option"
                disabled={isDisabled}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  onSelect(item);
                  setQuery(resetQueryOnSelect ? "" : item.name);
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
        <p className="meal-dish-search__hint text-secondary">
          {hideLabel
            ? "Ничего не найдено"
            : "Ничего не найдено — попробуйте другое слово или по-английски."}
        </p>
      ) : null}
    </>
  );

  if (hideLabel) {
    return (
      <div className={rootClassName}>
        {input}
        {hints}
      </div>
    );
  }

  return (
    <label className={`meal-panel__field ${rootClassName}`}>
      <span className="meal-panel__label text-secondary">{label}</span>
      {input}
      {hints}
    </label>
  );
}
