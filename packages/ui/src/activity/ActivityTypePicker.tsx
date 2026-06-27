import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { ActivityType } from "@sport-app/shared";
import {
  RECENT_ACTIVITY_TYPES_LABEL,
  groupActivityTypesByMajorHeading,
} from "@sport-app/shared";

interface ActivityTypePickerProps {
  id?: string;
  activityTypes: ActivityType[];
  headingLabels?: Record<string, string>;
  recentActivityTypeIds?: string[];
  value: string;
  disabled?: boolean;
  emptyLabel?: string;
  triggerClassName?: string;
  onChange: (activityTypeId: string) => void;
}

function formatActivityLabel(item: ActivityType): string {
  return `${item.name_ru} · MET ${item.met_value}`;
}

export function ActivityTypePicker({
  id,
  activityTypes,
  headingLabels = {},
  recentActivityTypeIds = [],
  value,
  disabled = false,
  emptyLabel = "Выберите вид",
  triggerClassName = "activity-type-picker__trigger",
  onChange,
}: ActivityTypePickerProps) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);

  const selectedActivity = useMemo(
    () => activityTypes.find((item) => item.id === value) ?? null,
    [activityTypes, value],
  );

  const recentActivityTypes = useMemo(
    () =>
      recentActivityTypeIds
        .map((activityId) => activityTypes.find((item) => item.id === activityId))
        .filter((item): item is ActivityType => item != null),
    [activityTypes, recentActivityTypeIds],
  );

  const recentActivityTypeIdSet = useMemo(
    () => new Set(recentActivityTypes.map((item) => item.id)),
    [recentActivityTypes],
  );

  const groupedActivityTypes = useMemo(
    () =>
      groupActivityTypesByMajorHeading(activityTypes, headingLabels, {
        excludeIds: recentActivityTypeIdSet,
      }),
    [activityTypes, headingLabels, recentActivityTypeIdSet],
  );

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

  const handleSelect = (activityTypeId: string) => {
    onChange(activityTypeId);
    setOpen(false);
  };

  const renderOption = (item: ActivityType) => {
    const selected = item.id === value;
    return (
      <li key={item.id} role="presentation">
        <button
          type="button"
          role="option"
          aria-selected={selected}
          className={`activity-type-picker__option${selected ? " activity-type-picker__option--selected" : ""}`}
          disabled={disabled}
          onClick={() => handleSelect(item.id)}
        >
          <span className="activity-type-picker__option-label">{formatActivityLabel(item)}</span>
          {selected ? <span className="activity-type-picker__check" aria-hidden="true">✓</span> : null}
        </button>
      </li>
    );
  };

  return (
    <div
      ref={rootRef}
      className={`activity-type-picker${open ? " activity-type-picker--open" : ""}`}
    >
      <button
        type="button"
        id={id}
        className={triggerClassName}
        disabled={disabled || activityTypes.length === 0}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((current) => !current)}
      >
        <span className="activity-type-picker__value">
          {selectedActivity ? formatActivityLabel(selectedActivity) : emptyLabel}
        </span>
        <span className="activity-type-picker__chevron" aria-hidden="true" />
      </button>

      {open ? (
        <ul id={listId} className="activity-type-picker__list" role="listbox">
          {recentActivityTypes.length > 0 ? (
            <li role="presentation" className="activity-type-picker__group">
              <p className="activity-type-picker__group-label">{RECENT_ACTIVITY_TYPES_LABEL}</p>
              <ul className="activity-type-picker__group-list" role="presentation">
                {recentActivityTypes.map((item) => renderOption(item))}
              </ul>
            </li>
          ) : null}
          {groupedActivityTypes.map((group) => (
            <li key={group.heading || "__ungrouped__"} role="presentation" className="activity-type-picker__group">
              <p className="activity-type-picker__group-label">{group.label}</p>
              <ul className="activity-type-picker__group-list" role="presentation">
                {group.items.map((item) => renderOption(item))}
              </ul>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
