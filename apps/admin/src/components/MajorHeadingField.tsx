import { useEffect, useMemo, useState } from "react";
import { formatActivityMajorHeading } from "@sport-app/shared";

interface MajorHeadingFieldProps {
  id: string;
  value: string;
  majorHeadings: string[];
  headingLabels?: Record<string, string>;
  onChange: (value: string) => void;
  required?: boolean;
  /** Allow typing a new group name (create form). Edit uses select only. */
  allowCustom?: boolean;
}

function sortedHeadings(
  headings: string[],
  currentValue: string,
  headingLabels?: Record<string, string>,
): string[] {
  const unique = new Set(headings);
  const trimmed = currentValue.trim();
  if (trimmed) {
    unique.add(trimmed);
  }
  return [...unique].sort((left, right) =>
    formatActivityMajorHeading(left, headingLabels).localeCompare(
      formatActivityMajorHeading(right, headingLabels),
      "ru",
    ),
  );
}

export function MajorHeadingField({
  id,
  value,
  majorHeadings,
  headingLabels,
  onChange,
  required = true,
  allowCustom = false,
}: MajorHeadingFieldProps) {
  const options = useMemo(
    () => sortedHeadings(majorHeadings, value, headingLabels),
    [headingLabels, majorHeadings, value],
  );
  const valueInList = value.trim() !== "" && options.includes(value);
  const [customMode, setCustomMode] = useState(() => allowCustom && value.trim() !== "" && !majorHeadings.includes(value));

  useEffect(() => {
    if (!allowCustom) {
      setCustomMode(false);
      return;
    }
    if (value.trim() !== "" && majorHeadings.includes(value)) {
      setCustomMode(false);
    }
  }, [allowCustom, majorHeadings, value]);

  if (allowCustom && customMode) {
    return (
      <div className="admin-field-stack">
        <input
          id={id}
          type="text"
          className="admin-input"
          required={required}
          value={value}
          placeholder="Название новой группы"
          onChange={(event) => onChange(event.target.value)}
        />
        <button type="button" className="admin-link-button" onClick={() => setCustomMode(false)}>
          Выбрать из списка
        </button>
      </div>
    );
  }

  return (
    <select
      id={id}
      className="admin-input admin-select"
      required={required}
      value={valueInList ? value : ""}
      onChange={(event) => {
        const next = event.target.value;
        if (next === "__custom__") {
          setCustomMode(true);
          onChange("");
          return;
        }
        onChange(next);
      }}
    >
      {!required ? <option value="">—</option> : null}
      {!valueInList && value.trim() ? (
        <option value={value}>{formatActivityMajorHeading(value, headingLabels)}</option>
      ) : null}
      {options.map((heading) => (
        <option key={heading} value={heading}>
          {formatActivityMajorHeading(heading, headingLabels)}
        </option>
      ))}
      {allowCustom ? <option value="__custom__">+ Новая группа…</option> : null}
    </select>
  );
}
