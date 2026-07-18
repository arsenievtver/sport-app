import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";

import { useScrollableOverlayLock } from "../hooks/useScrollableOverlayLock";

export interface SelectPickerOption {
  value: string;
  label: string;
  /** Extra text used only for searchable filtering (e.g. EN name, aliases). */
  searchText?: string;
}

export interface SelectPickerGroup {
  id: string;
  label: string;
  options: SelectPickerOption[];
  /** Keep visible even when search is empty / other groups are collapsed. */
  pinned?: boolean;
}

export interface SelectPickerProps {
  id?: string;
  value: string;
  groups?: SelectPickerGroup[];
  options?: SelectPickerOption[];
  disabled?: boolean;
  emptyLabel?: string;
  triggerClassName?: string;
  /** Show typeahead filter inside the dropdown. */
  searchable?: boolean;
  searchPlaceholder?: string;
  /** When searchable and query empty, hide non-pinned groups if total options exceed this. */
  searchRequireQueryAbove?: number;
  matchOption?: (option: SelectPickerOption, query: string) => boolean;
  onChange: (value: string) => void;
}

const LIST_GAP_PX = 4;
const LIST_MAX_HEIGHT_PX = 360;
const LIST_MIN_SPACE_PX = 160;
const DEFAULT_SEARCH_REQUIRE_ABOVE = 24;

function findSelectedLabel(
  value: string,
  groups: SelectPickerGroup[],
  options: SelectPickerOption[],
): string | null {
  for (const option of options) {
    if (option.value === value) {
      return option.label;
    }
  }
  for (const group of groups) {
    for (const option of group.options) {
      if (option.value === value) {
        return option.label;
      }
    }
  }
  return null;
}

function defaultMatchOption(option: SelectPickerOption, query: string): boolean {
  const q = query.trim().toLocaleLowerCase("ru-RU");
  if (!q) return true;
  const haystack = `${option.label} ${option.searchText ?? ""}`.toLocaleLowerCase("ru-RU");
  return q.split(/\s+/).filter(Boolean).every((word) => haystack.includes(word));
}

function getListStyle(trigger: HTMLButtonElement): CSSProperties {
  const rect = trigger.getBoundingClientRect();
  const maxHeight = Math.min(LIST_MAX_HEIGHT_PX, window.innerHeight * 0.55);
  const spaceBelow = window.innerHeight - rect.bottom - LIST_GAP_PX;
  const spaceAbove = rect.top - LIST_GAP_PX;
  const openUp = spaceBelow < Math.min(maxHeight, LIST_MIN_SPACE_PX) && spaceAbove > spaceBelow;
  const available = openUp ? spaceAbove : spaceBelow;

  return {
    position: "fixed",
    left: rect.left,
    width: Math.max(rect.width, Math.min(420, window.innerWidth - rect.left - 12)),
    maxHeight: Math.max(160, Math.min(maxHeight, available)),
    zIndex: 200,
    ...(openUp
      ? { bottom: window.innerHeight - rect.top + LIST_GAP_PX }
      : { top: rect.bottom + LIST_GAP_PX }),
  };
}

export function SelectPicker({
  id,
  value,
  groups = [],
  options = [],
  disabled = false,
  emptyLabel = "Выберите",
  triggerClassName = "select-picker__trigger",
  searchable = false,
  searchPlaceholder = "Поиск…",
  searchRequireQueryAbove = DEFAULT_SEARCH_REQUIRE_ABOVE,
  matchOption = defaultMatchOption,
  onChange,
}: SelectPickerProps) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [listStyle, setListStyle] = useState<CSSProperties>({});

  useScrollableOverlayLock(listRef, open);

  const selectedLabel = useMemo(
    () => findSelectedLabel(value, groups, options),
    [value, groups, options],
  );

  const totalOptions =
    options.length + groups.reduce((sum, group) => sum + group.options.length, 0);
  const hasOptions = totalOptions > 0;
  const trimmedQuery = query.trim();
  const requireQuery = searchable && !trimmedQuery && totalOptions > searchRequireQueryAbove;

  const filteredOptions = useMemo(() => {
    if (!searchable || !trimmedQuery) {
      return requireQuery ? [] : options;
    }
    return options.filter((option) => matchOption(option, trimmedQuery));
  }, [searchable, trimmedQuery, options, matchOption, requireQuery]);

  const filteredGroups = useMemo(() => {
    if (!searchable) return groups;

    if (!trimmedQuery) {
      if (!requireQuery) return groups;
      return groups
        .filter((group) => group.pinned)
        .map((group) => ({ ...group, options: group.options }))
        .filter((group) => group.options.length > 0);
    }

    return groups
      .map((group) => ({
        ...group,
        options: group.options.filter((option) => matchOption(option, trimmedQuery)),
      }))
      .filter((group) => group.options.length > 0);
  }, [searchable, trimmedQuery, groups, matchOption, requireQuery]);

  const hasFiltered =
    filteredOptions.length > 0 || filteredGroups.some((group) => group.options.length > 0);

  const updateListPosition = () => {
    if (!triggerRef.current) return;
    setListStyle(getListStyle(triggerRef.current));
  };

  useLayoutEffect(() => {
    if (!open) return;
    updateListPosition();
  }, [open, filteredGroups, filteredOptions, query]);

  useEffect(() => {
    if (!open) {
      setQuery("");
      return;
    }
    if (searchable) {
      const frame = window.requestAnimationFrame(() => searchRef.current?.focus());
      return () => window.cancelAnimationFrame(frame);
    }
  }, [open, searchable]);

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (rootRef.current?.contains(target)) return;
      if (panelRef.current?.contains(target)) return;
      setOpen(false);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    const handleReposition = () => updateListPosition();
    const handleScroll = (event: Event) => {
      if (panelRef.current && event.target instanceof Node && panelRef.current.contains(event.target)) {
        return;
      }
      setOpen(false);
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("resize", handleReposition);
    window.addEventListener("scroll", handleScroll, true);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("resize", handleReposition);
      window.removeEventListener("scroll", handleScroll, true);
    };
  }, [open]);

  const handleSelect = (nextValue: string) => {
    onChange(nextValue);
    setOpen(false);
  };

  const renderOption = (option: SelectPickerOption) => {
    const selected = option.value === value;
    return (
      <li key={option.value} role="presentation">
        <button
          type="button"
          role="option"
          aria-selected={selected}
          className={`select-picker__option${selected ? " select-picker__option--selected" : ""}`}
          disabled={disabled}
          onClick={() => handleSelect(option.value)}
        >
          <span className="select-picker__option-label">{option.label}</span>
          {selected ? (
            <span className="select-picker__check" aria-hidden="true">
              ✓
            </span>
          ) : null}
        </button>
      </li>
    );
  };

  const panel = open ? (
    <div
      ref={panelRef}
      id={listId}
      className="select-picker__panel select-picker__panel--floating"
      style={listStyle}
      role="presentation"
    >
      {searchable ? (
        <div className="select-picker__search">
          <input
            ref={searchRef}
            type="search"
            className="select-picker__search-input"
            value={query}
            placeholder={searchPlaceholder}
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="search"
            aria-label={searchPlaceholder}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.stopPropagation();
                setOpen(false);
              }
            }}
          />
        </div>
      ) : null}

      <ul ref={listRef} className="select-picker__list" role="listbox" data-overlay-scroll="">
        {requireQuery && !hasFiltered ? (
          <li className="select-picker__hint text-muted" role="presentation">
            Начните вводить: бег, boxing, йога…
          </li>
        ) : null}
        {!requireQuery && searchable && trimmedQuery && !hasFiltered ? (
          <li className="select-picker__hint text-muted" role="presentation">
            Ничего не найдено
          </li>
        ) : null}
        {filteredOptions.map((option) => renderOption(option))}
        {filteredGroups.map((group) => (
          <li key={group.id} role="presentation" className="select-picker__group">
            <p className="select-picker__group-label">{group.label}</p>
            <ul className="select-picker__group-list" role="presentation">
              {group.options.map((option) => renderOption(option))}
            </ul>
          </li>
        ))}
      </ul>
    </div>
  ) : null;

  return (
    <div ref={rootRef} className={`select-picker${open ? " select-picker--open" : ""}`}>
      <button
        ref={triggerRef}
        type="button"
        id={id}
        className={triggerClassName}
        disabled={disabled || !hasOptions}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        onClick={() => setOpen((current) => !current)}
      >
        <span className="select-picker__value">{selectedLabel ?? emptyLabel}</span>
        <span className="select-picker__chevron" aria-hidden="true" />
      </button>

      {panel ? createPortal(panel, document.body) : null}
    </div>
  );
}
