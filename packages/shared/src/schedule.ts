export type ScheduleMode = "week" | "template";

export interface CoachScheduleSettings {
  work_days: number[];
  slot_start: string;
  slot_end: string;
  lunch_start: string | null;
  lunch_end: string | null;
  slot_duration_min: number;
  timezone: string;
}

export interface ScheduleAthleteRef {
  athlete_id: string;
  display_name: string;
  avatar_url: string | null;
}

export interface ScheduleDayColumn {
  day_of_week: number;
  date: string | null;
  label: string;
}

export interface ScheduleSlotCell {
  day_of_week: number;
  date: string | null;
  start_time: string;
  athlete: ScheduleAthleteRef | null;
  activity_type_id: string | null;
  activity_name: string | null;
  is_exception: boolean;
  is_from_template: boolean;
}

export interface ScheduleGridResponse {
  mode: ScheduleMode;
  week_start: string | null;
  week_end: string | null;
  settings: CoachScheduleSettings;
  days: ScheduleDayColumn[];
  time_slots: string[];
  cells: ScheduleSlotCell[];
}

export const WEEKDAY_LABELS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"] as const;

export const WEEKDAY_OPTIONS = WEEKDAY_LABELS.map((label, index) => ({
  value: index,
  label,
}));

export function scheduleCellKey(dayOfWeek: number, startTime: string, date?: string | null): string {
  return date ? `${date}-${startTime}` : `${dayOfWeek}-${startTime}`;
}

export function formatWeekRange(weekStart: string, weekEnd: string): string {
  const start = new Date(`${weekStart}T12:00:00`);
  const end = new Date(`${weekEnd}T12:00:00`);
  const startLabel = start.toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
  const endLabel = end.toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
  return `${startLabel} — ${endLabel}`;
}

export function formatScheduleSlotContext(
  mode: ScheduleMode,
  dayOfWeek: number,
  startTime: string,
  date?: string | null,
): string {
  if (mode === "week" && date) {
    const parsed = new Date(`${date}T12:00:00`);
    const dateLabel = parsed.toLocaleDateString("ru-RU", {
      day: "numeric",
      month: "short",
      weekday: "short",
    });
    return `${dateLabel} · ${startTime}`;
  }
  const dayLabel = WEEKDAY_LABELS[dayOfWeek] ?? "";
  return `${dayLabel} · ${startTime}`;
}

export interface AthleteUpcomingSession {
  coach_id: string;
  coach_display_name: string;
  coach_avatar_url: string | null;
  sessions_balance: number;
  occurrence_date: string;
  start_time: string;
  duration_min: number;
  activity_type_id?: string | null;
  activity_name?: string | null;
}

export function formatAthleteUpcomingSession(session: AthleteUpcomingSession): string {
  const parsed = new Date(`${session.occurrence_date}T12:00:00`);
  const dateLabel = parsed.toLocaleDateString("ru-RU", {
    weekday: "short",
    day: "numeric",
    month: "long",
  });
  return `${dateLabel} · ${session.start_time}`;
}

export function toIsoDate(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function mondayOfWeek(value: Date): Date {
  const copy = new Date(value);
  const day = copy.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  copy.setDate(copy.getDate() + diff);
  copy.setHours(12, 0, 0, 0);
  return copy;
}

export function addDays(value: Date, days: number): Date {
  const copy = new Date(value);
  copy.setDate(copy.getDate() + days);
  return copy;
}

export function formatCoachDayNavLabel(value: Date, referenceToday = new Date()): string {
  const iso = toIsoDate(value);
  const todayIso = toIsoDate(referenceToday);
  const yesterdayIso = toIsoDate(addDays(referenceToday, -1));
  const tomorrowIso = toIsoDate(addDays(referenceToday, 1));

  const dateLabel = value.toLocaleDateString("ru-RU", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  if (iso === todayIso) return `Сегодня · ${dateLabel}`;
  if (iso === yesterdayIso) return `Вчера · ${dateLabel}`;
  if (iso === tomorrowIso) return `Завтра · ${dateLabel}`;
  return dateLabel;
}

export interface ScheduleSlotCompletion {
  athlete_id: string;
  start_time: string;
  activity_name?: string | null;
  effort?: number | null;
}

export interface CompleteScheduleSlotPayload {
  athlete_id: string;
  occurrence_date: string;
  start_time: string;
  activity_type_id: string;
  effort: number;
}

export interface CompleteScheduleSlotResponse {
  athlete_id: string;
  occurrence_date: string;
  start_time: string;
  sessions_balance: number;
  activity_name: string;
  effort: number;
}

export function scheduleSessionKey(
  occurrenceDate: string,
  startTime: string,
  athleteId: string,
): string {
  return `${occurrenceDate}-${startTime}-${athleteId}`;
}
