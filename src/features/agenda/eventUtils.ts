import type { AgendaEvent } from "./types";
import {
  addDaysToKey,
  endOfDayIso,
  isoDayKey,
  minutesFromMidnight,
  parseDayKey,
  startOfDayIso,
} from "./dateUtils";

export const EVENT_COLORS = [
  "#2d5a3d",
  "#c2703d",
  "#4a6fa5",
  "#8b5e8f",
  "#b08a2e",
  "#5f7a6a",
] as const;

export const DEFAULT_EVENT_COLOR = EVENT_COLORS[0];

export function eventStartKey(event: AgendaEvent): string {
  return event.startDate ?? isoDayKey(event.startAt);
}

export function eventEndKey(event: AgendaEvent): string {
  if (event.endDate) return event.endDate;
  return event.allDay ? eventStartKey(event) : isoDayKey(event.endAt);
}

export function eventOccursOn(event: AgendaEvent, key: string): boolean {
  if (event.allDay) {
    return key >= eventStartKey(event) && key <= eventEndKey(event);
  }

  const start = new Date(event.startAt).getTime();
  const end = new Date(event.endAt).getTime();
  return (
    start < new Date(endOfDayIso(key)).getTime() && end > new Date(startOfDayIso(key)).getTime()
  );
}

export function eventsForDay(events: AgendaEvent[], key: string): AgendaEvent[] {
  return events
    .filter((event) => eventOccursOn(event, key))
    .sort((left, right) => {
      if (left.allDay !== right.allDay) return left.allDay ? -1 : 1;
      return new Date(left.startAt).getTime() - new Date(right.startAt).getTime();
    });
}

export function allDayEventsForDay(events: AgendaEvent[], key: string): AgendaEvent[] {
  return eventsForDay(events, key).filter((event) => event.allDay);
}

export function timedEventsForDay(events: AgendaEvent[], key: string): AgendaEvent[] {
  return eventsForDay(events, key).filter((event) => !event.allDay);
}

export interface EventLayout {
  event: AgendaEvent;
  top: number;
  height: number;
  lane: number;
  lanes: number;
}

/** Position timed events inside a day column; overlapping items get their own lane. */
export function layoutDayEvents(events: AgendaEvent[], key: string): EventLayout[] {
  const dayStart = parseDayKey(key).getTime();
  const dayEnd = dayStart + 24 * 60 * 60 * 1000;

  const positioned = timedEventsForDay(events, key)
    .map((event) => {
      const start = Math.max(new Date(event.startAt).getTime(), dayStart);
      const end = Math.min(new Date(event.endAt).getTime(), dayEnd);
      const startMinutes = Math.max(0, (start - dayStart) / 60000);
      const endMinutes = Math.min(24 * 60, (end - dayStart) / 60000);
      return {
        event,
        top: (startMinutes / 1440) * 100,
        height: Math.max(((endMinutes - startMinutes) / 1440) * 100, 1.2),
      };
    })
    .sort((left, right) => left.top - right.top || right.height - left.height);

  const laneEnds: number[] = [];
  const laidOut = positioned.map((item) => {
    let lane = laneEnds.findIndex((end) => end <= item.top);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(0);
    }
    laneEnds[lane] = item.top + item.height;
    return { ...item, lane };
  });

  return laidOut.map((item) => ({ ...item, lanes: Math.max(laneEnds.length, 1) }));
}

export function eventColor(event: AgendaEvent, index = 0): string {
  if (event.color) return event.color;
  return EVENT_COLORS[index % EVENT_COLORS.length];
}

export function eventTimeLabel(event: AgendaEvent, locale: string, allDayLabel: string): string {
  if (event.allDay) return allDayLabel;
  const formatter = new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit" });
  return `${formatter.format(new Date(event.startAt))} – ${formatter.format(new Date(event.endAt))}`;
}

export function eventStartMinutes(event: AgendaEvent): number {
  return minutesFromMidnight(event.startAt);
}

export function eventDaySpan(event: AgendaEvent): string[] {
  const start = eventStartKey(event);
  const end = eventEndKey(event);
  if (end <= start) return [start];

  const days: string[] = [];
  let cursor = start;
  let guard = 0;
  while (cursor <= end && guard < 366) {
    days.push(cursor);
    cursor = addDaysToKey(cursor, 1);
    guard += 1;
  }
  return days;
}
