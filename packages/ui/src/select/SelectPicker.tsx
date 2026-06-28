import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";

export interface SelectPickerOption {
  value: string;
  label: string;
}

export interface SelectPickerGroup {
  id: string;
  label: string;
  options: SelectPickerOption[];
}

export interface SelectPickerProps {
  id?: string;
  value: string;
  groups?: SelectPickerGroup[];
  options?: SelectPickerOption[];
  disabled?: boolean;
  emptyLabel?: string;
  triggerClassName?: string;
  onChange: (value: string) => void;
}

const LIST_GAP_PX = 4;
const LIST_MAX_HEIGHT_PX = 288;
const LIST_MIN_SPACE_PX = 160;

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

function getListStyle(trigger: HTMLButtonElement): CSSProperties {
  const rect = trigger.getBoundingClientRect();
  const maxHeight = Math.min(LIST_MAX_HEIGHT_PX, window.innerHeight * 0.5);
  const spaceBelow = window.innerHeight - rect.bottom - LIST_GAP_PX;
  const spaceAbove = rect.top - LIST_GAP_PX;
  const openUp = spaceBelow < Math.min(maxHeight, LIST_MIN_SPACE_PX) && spaceAbove > spaceBelow;
  const available = openUp ? spaceAbove : spaceBelow;

  return {
    position: "fixed",
    left: rect.left,
    width: rect.width,
    maxHeight: Math.max(120, Math.min(maxHeight, available)),
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
  onChange,
}: SelectPickerProps) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [listStyle, setListStyle] = useState<CSSProperties>({});

  const selectedLabel = useMemo(
    () => findSelectedLabel(value, groups, options),
    [value, groups, options],
  );

  const hasOptions = options.length > 0 || groups.some((group) => group.options.length > 0);

  const updateListPosition = () => {
    if (!triggerRef.current) return;
    setListStyle(getListStyle(triggerRef.current));
  };

  useLayoutEffect(() => {
    if (!open) return;
    updateListPosition();
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (rootRef.current?.contains(target)) return;
      const list = document.getElementById(listId);
      if (list?.contains(target)) return;
      setOpen(false);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    const handleReposition = () => updateListPosition();
    const handleScroll = (event: Event) => {
      const list = document.getElementById(listId);
      if (list && event.target instanceof Node && list.contains(event.target)) {
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
  }, [open, listId]);

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
          {selected ? <span className="select-picker__check" aria-hidden="true">✓</span> : null}
        </button>
      </li>
    );
  };

  const list = open ? (
    <ul
      id={listId}
      className="select-picker__list select-picker__list--floating"
      style={listStyle}
      role="listbox"
    >
      {options.length > 0 ? options.map((option) => renderOption(option)) : null}
      {groups.map((group) => (
        <li key={group.id} role="presentation" className="select-picker__group">
          <p className="select-picker__group-label">{group.label}</p>
          <ul className="select-picker__group-list" role="presentation">
            {group.options.map((option) => renderOption(option))}
          </ul>
        </li>
      ))}
    </ul>
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

      {list ? createPortal(list, document.body) : null}
    </div>
  );
}
