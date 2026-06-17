import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";

const WEEKDAY_LABELS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

function parseIsoDate(iso: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const date = new Date(`${iso}T12:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function toIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatIsoDisplay(iso: string): string {
  const date = parseIsoDate(iso);
  if (!date) return "";
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}.${month}.${year}`;
}

function buildMonthGrid(year: number, month: number): (Date | null)[] {
  const firstDay = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const offset = (firstDay.getDay() + 6) % 7;
  const days: (Date | null)[] = Array.from({ length: offset }, () => null);
  for (let day = 1; day <= daysInMonth; day += 1) {
    days.push(new Date(year, month, day));
  }
  return days;
}

function isSameDay(left: Date, right: Date): boolean {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

function isDateDisabled(date: Date, min?: string, max?: string): boolean {
  const iso = toIsoDate(date);
  if (min && iso < min) return true;
  if (max && iso > max) return true;
  return false;
}

function clampViewDate(date: Date, min?: string, max?: string): Date {
  const iso = toIsoDate(date);
  if (max && iso > max) return parseIsoDate(max) ?? date;
  if (min && iso < min) return parseIsoDate(min) ?? date;
  return date;
}

interface DateFieldProps {
  value: string;
  onChange: (value: string) => void;
  min?: string;
  max?: string;
  className?: string;
  inputClassName?: string;
  onKeyDown?: (event: KeyboardEvent<HTMLInputElement>) => void;
}

export function DateField({
  value,
  onChange,
  min,
  max,
  className = "",
  inputClassName = "",
  onKeyDown,
}: DateFieldProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const selectedDate = useMemo(() => parseIsoDate(value), [value]);
  const [open, setOpen] = useState(false);
  const [viewDate, setViewDate] = useState(() => selectedDate ?? clampViewDate(new Date(), min, max));

  useEffect(() => {
    if (!open) return;
    setViewDate(selectedDate ?? clampViewDate(new Date(), min, max));
  }, [open, selectedDate, min, max]);

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
    };
  }, [open]);

  const monthDays = useMemo(
    () => buildMonthGrid(viewDate.getFullYear(), viewDate.getMonth()),
    [viewDate],
  );
  const monthTitle = new Intl.DateTimeFormat("ru-RU", {
    month: "long",
    year: "numeric",
  }).format(viewDate);
  const today = useMemo(() => new Date(), []);

  const moveMonth = (delta: number) => {
    setViewDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + delta, 1));
  };

  const handleSelect = (date: Date) => {
    if (isDateDisabled(date, min, max)) return;
    onChange(toIsoDate(date));
    setOpen(false);
  };

  return (
    <div ref={rootRef} className={`date-field${className ? ` ${className}` : ""}`}>
      <input
        type="text"
        readOnly
        className={`date-field__input${inputClassName ? ` ${inputClassName}` : ""}`}
        value={formatIsoDisplay(value)}
        placeholder="дд.мм.гггг"
        onClick={() => setOpen((prev) => !prev)}
        onKeyDown={onKeyDown}
        aria-haspopup="dialog"
        aria-expanded={open}
      />

      {open ? (
        <div className="date-field__calendar" role="dialog" aria-label="Выбор даты">
          <div className="date-field__calendar-header">
            <button type="button" className="date-field__nav" onClick={() => moveMonth(-1)} aria-label="Предыдущий месяц">
              ‹
            </button>
            <span className="date-field__month">{monthTitle}</span>
            <button type="button" className="date-field__nav" onClick={() => moveMonth(1)} aria-label="Следующий месяц">
              ›
            </button>
          </div>

          <div className="date-field__weekdays">
            {WEEKDAY_LABELS.map((label) => (
              <span key={label} className="date-field__weekday">
                {label}
              </span>
            ))}
          </div>

          <div className="date-field__days">
            {monthDays.map((date, index) => {
              if (!date) {
                return <span key={`empty-${index}`} className="date-field__day date-field__day--empty" />;
              }

              const disabled = isDateDisabled(date, min, max);
              const selected = selectedDate ? isSameDay(date, selectedDate) : false;
              const isToday = isSameDay(date, today);

              return (
                <button
                  key={toIsoDate(date)}
                  type="button"
                  className={`date-field__day${
                    selected ? " date-field__day--selected" : ""
                  }${isToday ? " date-field__day--today" : ""}`}
                  disabled={disabled}
                  onClick={() => handleSelect(date)}
                >
                  {date.getDate()}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
