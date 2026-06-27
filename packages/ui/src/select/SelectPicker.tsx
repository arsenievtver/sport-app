import { useEffect, useId, useMemo, useRef, useState } from "react";

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
  const [open, setOpen] = useState(false);

  const selectedLabel = useMemo(
    () => findSelectedLabel(value, groups, options),
    [value, groups, options],
  );

  const hasOptions = options.length > 0 || groups.some((group) => group.options.length > 0);

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target;
      if (!(target instanceof Node) || !rootRef.current?.contains(target)) {
        setOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
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
          {selected ? <span className="select-picker__check" aria-hidden="true">✓</span> : null}
        </button>
      </li>
    );
  };

  return (
    <div ref={rootRef} className={`select-picker${open ? " select-picker--open" : ""}`}>
      <button
        type="button"
        id={id}
        className={triggerClassName}
        disabled={disabled || !hasOptions}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((current) => !current)}
      >
        <span className="select-picker__value">{selectedLabel ?? emptyLabel}</span>
        <span className="select-picker__chevron" aria-hidden="true" />
      </button>

      {open ? (
        <ul id={listId} className="select-picker__list" role="listbox">
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
      ) : null}
    </div>
  );
}
