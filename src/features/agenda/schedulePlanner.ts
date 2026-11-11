import { addDaysToKey, combineDateTime, isoDayKey, isoTime, parseDayKey } from "./dateUtils";
import { todoDeadlineDay } from "./ddlPressure";
import { resolvePeriodTimes } from "./timetable";
import type { AgendaEvent, AgendaSnapshot, Todo } from "./types";

export interface PlanBlock {
  date: string;
  startAt: string;
  endAt: string;
  todoId: string;
  title: string;
  minutes: number;
}

export interface PlanSkipped {
  todoId: string;
  title: string;
  reason: "no-slot" | "no-deadline";
}

export interface PlanResult {
  blocks: PlanBlock[];
  skipped: PlanSkipped[];
}

export interface PlanOptions {
  from: string;
  days?: number;
  dayStart?: string;
  dayEnd?: string;
  defaultMinutes?: number;
}

interface Interval {
  start: number;
  end: number;
}

const SLOT_GAP_MINUTES = 5;
const MIN_BLOCK_MINUTES = 15;

function clockToMinutes(value: string): number | null {
  const [hours, minutes] = value.split(":").map(Number);
  if (
    !Number.isFinite(hours) ||
    !Number.isFinite(minutes) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    return null;
  }
  return hours * 60 + minutes;
}

function minutesToClock(value: number): string {
  const hours = Math.floor(value / 60);
  const minutes = value % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function weekdayOf(dateKey: string): number {
  return ((new Date(`${dateKey}T00:00:00`).getDay() + 6) % 7) + 1;
}

function courseIntervalsForDay(dateKey: string, snapshot: AgendaSnapshot): Interval[] {
  const weekday = weekdayOf(dateKey);
  const overrides = snapshot.courseOverrides.filter((item) => item.date === dateKey);
  const result: Interval[] = [];

  for (const course of snapshot.courses) {
    if (course.weekday !== weekday) continue;
    const override = overrides.find((item) => item.courseId === course.id);
    if (override?.action === "cancel") continue;
    const startPeriod =
      override?.action === "move" && override.startPeriod ? override.startPeriod : course.startPeriod;
    const endPeriod =
      override?.action === "move" && override.endPeriod ? override.endPeriod : course.endPeriod;
    const periodTimes = resolvePeriodTimes(
      snapshot.timetableSettings,
      parseDayKey(dateKey),
    );
    const start = periodTimes.find((item) => item.period === startPeriod);
    const end = periodTimes.find((item) => item.period === endPeriod);
    const from = start ? clockToMinutes(start.start) : null;
    const to = end ? clockToMinutes(end.end) : null;
    if (from !== null && to !== null && to > from) {
      result.push({ start: from, end: to });
    }
  }
  return result;
}

function eventIntervalsForDay(dateKey: string, events: AgendaEvent[]): Interval[] {
  const dayStart = new Date(`${dateKey}T00:00:00`).getTime();
  const dayEnd = dayStart + 24 * 60 * 60 * 1000;
  const result: Interval[] = [];

  for (const event of events) {
    if (event.allDay) {
      const start = event.startDate ?? isoDayKey(event.startAt);
      const end = event.endDate ?? isoDayKey(event.endAt);
      if (dateKey >= start && dateKey <= end) result.push({ start: 0, end: 1440 });
      continue;
    }
    const start = new Date(event.startAt).getTime();
    const end = new Date(event.endAt).getTime();
    if (start >= dayEnd || end <= dayStart) continue;
    const from = Math.max(0, Math.round((Math.max(start, dayStart) - dayStart) / 60000));
    const to = Math.min(1440, Math.round((Math.min(end, dayEnd) - dayStart) / 60000));
    if (to > from) result.push({ start: from, end: to });
  }
  return result;
}

function mergeIntervals(intervals: Interval[]): Interval[] {
  const sorted = [...intervals].sort((left, right) => left.start - right.start);
  const merged: Interval[] = [];
  for (const interval of sorted) {
    const last = merged[merged.length - 1];
    if (last && interval.start <= last.end) {
      last.end = Math.max(last.end, interval.end);
    } else {
      merged.push({ ...interval });
    }
  }
  return merged;
}

function freeIntervals(dayStart: number, dayEnd: number, busy: Interval[]): Interval[] {
  const free: Interval[] = [];
  let cursor = dayStart;
  // 每个占用区间后留出缓冲，避免「下课立刻开始」的紧绷排法
  for (const interval of mergeIntervals(busy).map((item) => ({
    start: item.start,
    end: Math.min(dayEnd, item.end + SLOT_GAP_MINUTES),
  }))) {
    if (interval.start > cursor) free.push({ start: cursor, end: Math.min(interval.start, dayEnd) });
    cursor = Math.max(cursor, interval.end);
    if (cursor >= dayEnd) break;
  }
  if (cursor < dayEnd) free.push({ start: cursor, end: dayEnd });
  return free.filter((interval) => interval.end > interval.start);
}

function blockMinutes(todo: Todo, fallback: number): number {
  const raw = todo.estimateMinutes ?? fallback;
  const rounded = Math.ceil(raw / MIN_BLOCK_MINUTES) * MIN_BLOCK_MINUTES;
  return Math.max(MIN_BLOCK_MINUTES, Math.min(480, rounded));
}

/**
 * 把「空档 × 未完成待办的 DDL × 预估时长」排成可写入日历的计划块。
 * 纯函数：不读文件、不写事件，调用方决定是否落库。
 */
export function planSchedule(
  snapshot: AgendaSnapshot,
  options: PlanOptions,
): PlanResult {
  const days = Math.max(1, options.days ?? 7);
  const dayStart = clockToMinutes(options.dayStart ?? "08:00") ?? 8 * 60;
  const dayEnd = clockToMinutes(options.dayEnd ?? "22:00") ?? 22 * 60;
  const defaultMinutes = Math.max(MIN_BLOCK_MINUTES, options.defaultMinutes ?? 30);

  const dayKeys = Array.from({ length: days }, (_, index) => addDaysToKey(options.from, index));
  const freeByDay = new Map<string, Interval[]>();
  for (const dayKey of dayKeys) {
    const busy = [
      ...courseIntervalsForDay(dayKey, snapshot),
      ...eventIntervalsForDay(dayKey, snapshot.events),
    ];
    freeByDay.set(dayKey, freeIntervals(dayStart, dayEnd, busy));
  }

  const pending = snapshot.todos
    .filter((todo) => !todo.done)
    .map((todo) => ({ todo, deadline: todoDeadlineDay(todo) }))
    .filter((entry) => entry.deadline !== null)
    .sort(
      (left, right) =>
        (left.deadline ?? "").localeCompare(right.deadline ?? "") ||
        right.todo.priority - left.todo.priority ||
        left.todo.sortOrder - right.todo.sortOrder,
    );

  const blocks: PlanBlock[] = [];
  const skipped: PlanSkipped[] = [];

  for (const { todo, deadline } of pending) {
    // 逾期任务按「今天必须做」处理，否则会被 deadline < from 直接跳过
    const target = deadline && deadline > options.from ? deadline : options.from;
    const minutes = blockMinutes(todo, defaultMinutes);
    let placed = false;

    for (const dayKey of dayKeys) {
      if (dayKey > target) break;
      const free = freeByDay.get(dayKey);
      if (!free) continue;
      const slot = free.find((interval) => interval.end - interval.start >= minutes);
      if (!slot) continue;

      const start = slot.start;
      const end = start + minutes;
      blocks.push({
        date: dayKey,
        startAt: combineDateTime(dayKey, minutesToClock(start)),
        endAt: combineDateTime(dayKey, minutesToClock(end)),
        todoId: todo.id,
        title: todo.title,
        minutes,
      });
      if (start === slot.start) slot.start = end + SLOT_GAP_MINUTES;
      placed = true;
      break;
    }

    if (!placed) {
      skipped.push({
        todoId: todo.id,
        title: todo.title,
        reason: "no-slot",
      });
    }
  }

  return { blocks, skipped };
}

/** 计划块的显示时间，如「09:45–10:15」。 */
export function formatPlanRange(block: PlanBlock): string {
  return `${isoTime(block.startAt)}–${isoTime(block.endAt)}`;
}
