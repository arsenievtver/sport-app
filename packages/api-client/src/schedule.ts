import type {
  CoachScheduleSettings,
  ScheduleGridResponse,
} from "@sport-app/shared";

import { authenticatedFetchOk } from "./auth";

export async function fetchCoachScheduleSettings(): Promise<CoachScheduleSettings> {
  const res = await authenticatedFetchOk("/coach/schedule/settings");
  return res.json() as Promise<CoachScheduleSettings>;
}

export async function updateCoachScheduleSettings(
  payload: CoachScheduleSettings,
): Promise<CoachScheduleSettings> {
  const res = await authenticatedFetchOk("/coach/schedule/settings", {
    method: "PUT",
    body: JSON.stringify(payload),
  });
  return res.json() as Promise<CoachScheduleSettings>;
}

export async function fetchCoachScheduleTemplate(): Promise<ScheduleGridResponse> {
  const res = await authenticatedFetchOk("/coach/schedule/template");
  return res.json() as Promise<ScheduleGridResponse>;
}

export async function fetchCoachScheduleWeek(date?: string): Promise<ScheduleGridResponse> {
  const query = date ? `?date=${encodeURIComponent(date)}` : "";
  const res = await authenticatedFetchOk(`/coach/schedule/week${query}`);
  return res.json() as Promise<ScheduleGridResponse>;
}

export async function setCoachScheduleSlot(payload: {
  day_of_week: number;
  start_time: string;
  athlete_id: string | null;
  occurrence_date?: string | null;
}): Promise<ScheduleGridResponse> {
  const res = await authenticatedFetchOk("/coach/schedule/slot", {
    method: "PUT",
    body: JSON.stringify(payload),
  });
  return res.json() as Promise<ScheduleGridResponse>;
}

export async function clearCoachScheduleWeekSlot(payload: {
  date: string;
  start_time: string;
}): Promise<ScheduleGridResponse> {
  const query = new URLSearchParams({
    date: payload.date,
    start_time: payload.start_time,
  });
  const res = await authenticatedFetchOk(`/coach/schedule/week/slot?${query}`, {
    method: "DELETE",
  });
  return res.json() as Promise<ScheduleGridResponse>;
}

export async function moveCoachScheduleWeekSlot(payload: {
  from_date: string;
  from_time: string;
  to_date: string;
  to_time: string;
}): Promise<ScheduleGridResponse> {
  const res = await authenticatedFetchOk("/coach/schedule/week/move", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return res.json() as Promise<ScheduleGridResponse>;
}
