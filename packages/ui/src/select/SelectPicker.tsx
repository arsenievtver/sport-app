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
  /** Cap rendered matches so short queries cannot mount hundreds of DOM nodes on mobile. */
  maxVisibleOptions?: number;
  matchOption?: (option: SelectPickerOption, query: string) => boolean;
  onChange: (value: string) => void;
}

const LIST_GAP_PX = 4;
const LIST_MAX_HEIGHT_PX = 360;
const LIST_MIN_SPACE_PX = 160;
const VIEWPORT_INSET_PX = 12;
const DEFAULT_SEARCH_REQUIRE_ABOVE = 24;
const DEFAULT_MAX_VISIBLE_OPTIONS = 40;
const SHEET_MQ = "(max-width: 720px), (pointer: coarse)";

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

function prefersSheetLayout(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  return window.matchMedia(SHEET_MQ).matches;
}

function getViewportBox() {
  const vv = window.visualViewport;
  if (vv) {
    return {
      left: vv.offsetLeft,
      top: vv.offsetTop,
      width: vv.width,
      height: vv.height,
    };
  }
  return {
    left: 0,
    top: 0,
    width: window.innerWidth,
    height: window.innerHeight,
  };
}

/** Anchored popover for desktop — keeps panel fully inside the visual viewport. */
function getFloatingStyle(trigger: HTMLButtonElement): CSSProperties {
  const rect = trigger.getBoundingClientRect();
  const viewport = getViewportBox();
  const maxWidth = Math.min(420, viewport.width - VIEWPORT_INSET_PX * 2);
  const width = Math.min(Math.max(rect.width, Math.min(320, maxWidth)), maxWidth);
  const left = Math.min(
    Math.max(viewport.left + VIEWPORT_INSET_PX, rect.left),
    viewport.left + viewport.width - width - VIEWPORT_INSET_PX,
  );

  const maxHeight = Math.min(LIST_MAX_HEIGHT_PX, viewport.height * 0.55);
  const spaceBelow = viewport.top + viewport.height - rect.bottom - LIST_GAP_PX;
  const spaceAbove = rect.top - viewport.top - LIST_GAP_PX;
  const openUp = spaceBelow < Math.min(maxHeight, LIST_MIN_SPACE_PX) && spaceAbove > spaceBelow;
  const available = Math.max(140, openUp ? spaceAbove : spaceBelow);

  return {
    position: "fixed",
    left,
    width,
    maxWidth,
    maxHeight: Math.min(maxHeight, available),
    zIndex: 240,
    ...(openUp
      ? { bottom: window.innerHeight - rect.top + LIST_GAP_PX, top: "auto" }
      : { top: rect.bottom + LIST_GAP_PX, bottom: "auto" }),
  };
}

/**
 * Bottom sheet inside the visual viewport — stable on Android when the keyboard
 * resizes/moves the visual viewport (no flip between above/below the trigger).
 */
function getSheetStyle(): CSSProperties {
  const viewport = getViewportBox();
  const width = Math.max(0, viewport.width - VIEWPORT_INSET_PX * 2);
  const maxHeight = Math.min(LIST_MAX_HEIGHT_PX, viewport.height * 0.52);
  const bottom = Math.max(
    VIEWPORT_INSET_PX,
    window.innerHeight - (viewport.top + viewport.height) + VIEWPORT_INSET_PX,
  );

  return {
    position: "fixed",
    left: viewport.left + VIEWPORT_INSET_PX,
    width,
    maxWidth: width,
    bottom,
    top: "auto",
    maxHeight: Math.max(180, maxHeight),
    zIndex: 240,
  };
}

function limitGroupedOptions(
  groups: SelectPickerGroup[],
  flat: SelectPickerOption[],
  maxVisible: number,
): { groups: SelectPickerGroup[]; options: SelectPickerOption[]; hiddenCount: number } {
  if (maxVisible <= 0) {
    return { groups, options: flat, hiddenCount: 0 };
  }

  let remaining = maxVisible;
  const limitedFlat: SelectPickerOption[] = [];
  for (const option of flat) {
    if (remaining <= 0) break;
    limitedFlat.push(option);
    remaining -= 1;
  }

  const limitedGroups: SelectPickerGroup[] = [];
  for (const group of groups) {
    if (remaining <= 0) break;
    const options = group.options.slice(0, remaining);
    if (options.length === 0) continue;
    limitedGroups.push({ ...group, options });
    remaining -= options.length;
  }

  const shown = limitedFlat.length + limitedGroups.reduce((sum, group) => sum + group.options.length, 0);
  const total = flat.length + groups.reduce((sum, group) => sum + group.options.length, 0);
  return { groups: limitedGroups, options: limitedFlat, hiddenCount: Math.max(0, total - shown) };
}

function stylesEqual(a: CSSProperties, b: CSSProperties): boolean {
  return (
    a.top === b.top &&
    a.bottom === b.bottom &&
    a.left === b.left &&
    a.width === b.width &&
    a.maxWidth === b.maxWidth &&
    a.maxHeight === b.maxHeight
  );
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
  maxVisibleOptions = DEFAULT_MAX_VISIBLE_OPTIONS,
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
  const [sheetMode, setSheetMode] = useState(() => prefersSheetLayout());

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

  const visible = useMemo(() => {
    // Empty-query pinned shortcuts stay uncapped; only search hits are limited.
    if (!trimmedQuery) {
      return { groups: filteredGroups, options: filteredOptions, hiddenCount: 0 };
    }
    return limitGroupedOptions(filteredGroups, filteredOptions, maxVisibleOptions);
  }, [filteredGroups, filteredOptions, trimmedQuery, maxVisibleOptions]);

  const hasFiltered =
    visible.options.length > 0 || visible.groups.some((group) => group.options.length > 0);

  const updateListPosition = () => {
    const nextSheet = prefersSheetLayout();
    setSheetMode(nextSheet);
    if (nextSheet) {
      const next = getSheetStyle();
      setListStyle((current) => (stylesEqual(current, next) ? current : next));
      return;
    }
    if (!triggerRef.current) return;
    const next = getFloatingStyle(triggerRef.current);
    setListStyle((current) => (stylesEqual(current, next) ? current : next));
  };

  useLayoutEffect(() => {
    if (!open) return;
    updateListPosition();
  }, [open, visible.groups, visible.options, query]);

  useEffect(() => {
    if (!open) {
      setQuery("");
      return;
    }
    // Autofocus opens the Android keyboard and jumps the visual viewport — only on desktop.
    if (searchable && !prefersSheetLayout()) {
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
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (panelRef.current?.contains(target)) return;
      // Sheet mode: keep panel pinned to visual viewport while page/keyboard moves.
      if (
        sheetMode ||
        target === document ||
        target === document.documentElement ||
        target === document.body
      ) {
        updateListPosition();
        return;
      }
      setOpen(false);
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("resize", handleReposition);
    window.addEventListener("scroll", handleScroll, true);
    window.visualViewport?.addEventListener("resize", handleReposition);
    window.visualViewport?.addEventListener("scroll", handleReposition);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("resize", handleReposition);
      window.removeEventListener("scroll", handleScroll, true);
      window.visualViewport?.removeEventListener("resize", handleReposition);
      window.visualViewport?.removeEventListener("scroll", handleReposition);
    };
  }, [open, sheetMode]);

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
      className={`select-picker__panel${
        sheetMode ? " select-picker__panel--sheet" : " select-picker__panel--floating"
      }`}
      style={listStyle}
      role="presentation"
    >
      {sheetMode ? (
        <div className="select-picker__sheet-handle" aria-hidden="true">
          <span />
        </div>
      ) : null}

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
            inputMode="search"
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
            Введите: бег, велосипед, плавание, спорт…
          </li>
        ) : null}
        {searchable && trimmedQuery && !hasFiltered ? (
          <li className="select-picker__hint text-muted" role="presentation">
            Ничего не найдено
          </li>
        ) : null}
        {visible.options.map((option) => renderOption(option))}
        {visible.groups.map((group) => (
          <li key={group.id} role="presentation" className="select-picker__group">
            <p className="select-picker__group-label">{group.label}</p>
            <ul className="select-picker__group-list" role="presentation">
              {group.options.map((option) => renderOption(option))}
            </ul>
          </li>
        ))}
        {visible.hiddenCount > 0 ? (
          <li className="select-picker__hint text-muted" role="presentation">
            Ещё {visible.hiddenCount} — уточните поиск
          </li>
        ) : null}
      </ul>
    </div>
  ) : null;

  return (
    <div
      ref={rootRef}
      className={`select-picker${open ? " select-picker--open" : ""}${
        sheetMode && open ? " select-picker--sheet" : ""
      }`}
    >
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
