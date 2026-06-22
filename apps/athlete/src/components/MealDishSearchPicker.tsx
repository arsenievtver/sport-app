import { useEffect, useId, useState } from "react";
import { searchAthleteMealDishes } from "@sport-app/api-client";
import type { MealDishSearchItem } from "@sport-app/shared";

type ResultsMode = "inline" | "floating";

interface MealDishSearchPickerProps {
  label?: string;
  placeholder?: string;
  disabled?: boolean;
  inactive?: boolean;
  hideLabel?: boolean;
  catalogDishCount?: number | null;
  resetQueryOnSelect?: boolean;
  resultsMode?: ResultsMode;
  inputClassName?: string;
  onFocus?: () => void;
  onBlur?: () => void;
  onOpenChange?: (open: boolean) => void;
  onSelect: (item: MealDishSearchItem) => void;
}

function SearchIcon() {
  return (
    <svg className="meal-dish-search__icon-svg" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <circle cx="8.75" cy="8.75" r="5.75" stroke="currentColor" strokeWidth="1.6" />
      <path d="M13 13L17 17" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function MealDishSearchPicker({
  label = "Найти в базе блюд",
  placeholder = "введите название блюда",
  disabled = false,
  inactive = false,
  hideLabel = false,
  catalogDishCount = null,
  resetQueryOnSelect = false,
  resultsMode = "floating",
  inputClassName = "meal-panel__input",
  onFocus,
  onBlur,
  onOpenChange,
  onSelect,
}: MealDishSearchPickerProps) {
  const listId = useId();
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<MealDishSearchItem[]>([]);
  const [searching, setSearching] = useState(false);
  const [open, setOpen] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const setDropdownOpen = (next: boolean) => {
    setOpen(next);
    onOpenChange?.(next);
  };

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setItems([]);
      setSearching(false);
      setSearchError(null);
      setOpen(false);
      onOpenChange?.(false);
      return;
    }

    setSearching(true);
    setSearchError(null);
    const timer = window.setTimeout(() => {
      void searchAthleteMealDishes(trimmed)
        .then((result) => {
          setItems(result.items);
          setOpen(true);
          onOpenChange?.(true);
        })
        .catch((err: unknown) => {
          setItems([]);
          setSearchError(err instanceof Error ? err.message : "Не удалось выполнить поиск");
          setOpen(false);
          onOpenChange?.(false);
        })
        .finally(() => setSearching(false));
    }, 300);

    return () => window.clearTimeout(timer);
  }, [query, onOpenChange]);

  const isDisabled = disabled || inactive;
  const hasResults = open && items.length > 0;
  const resultsClassName = `meal-dish-search__results${resultsMode === "inline" ? " meal-dish-search__results--inline" : ""}`;
  const rootClassName = [
    "meal-dish-search",
    inactive ? "meal-dish-search--inactive" : "",
    hideLabel ? "meal-dish-search--compact" : "",
    resultsMode === "inline" ? "meal-dish-search--inline-mode" : "",
    hasResults ? "meal-dish-search--open" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const input = (
    <div className="meal-dish-search__field">
      <span className="meal-dish-search__icon" aria-hidden="true">
        <SearchIcon />
      </span>
      <input
        type="search"
        className={inputClassName}
        placeholder={placeholder}
        value={query}
        disabled={isDisabled}
        aria-label={hideLabel ? label : undefined}
        aria-controls={listId}
        aria-expanded={hasResults}
        onChange={(event) => {
          setQuery(event.target.value);
          setDropdownOpen(true);
        }}
        onFocus={() => {
          onFocus?.();
          if (items.length > 0) setDropdownOpen(true);
        }}
        onBlur={() => {
          onBlur?.();
        }}
      />
    </div>
  );

  const hints = (
    <>
      {!hideLabel && catalogDishCount === 0 ? (
        <p className="meal-dish-search__hint text-secondary">
          База пуста — попросите админа обновить каталог в админке.
        </p>
      ) : null}
      {searching ? <p className="meal-dish-search__hint meal-dish-search__hint--status">Ищем в базе…</p> : null}
      {searchError ? <p className="auth-error meal-dish-search__hint">{searchError}</p> : null}
      {hasResults ? (
        <ul id={listId} className={resultsClassName} role="listbox">
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
                  setDropdownOpen(false);
                }}
              >
                <span className="meal-dish-search__option-name">{item.name}</span>
                {item.portion_size_g != null ? (
                  <span className="meal-dish-search__portion">~{Math.round(item.portion_size_g)} г</span>
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
      <span className="meal-dish-search__label">{label}</span>
      {input}
      {hints}
    </label>
  );
}
