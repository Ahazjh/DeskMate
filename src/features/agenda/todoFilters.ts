import type { SmartList, Todo } from "./types";
import {
  addDaysToKey,
  isoDayKey,
  parseDayKey,
  startOfWeek,
  todayKey,
  WEEK_STARTS_ON,
  dayKey,
} from "./dateUtils";

export const SMART_LISTS: SmartList[] = ["today", "tomorrow", "week", "overdue", "all", "done"];

export function todoDay(todo: Todo): string | null {
  if (todo.dueAt) return isoDayKey(todo.dueAt);
  if (todo.dueDate) return todo.dueDate;
  return null;
}

export function isOverdue(todo: Todo, now: Date = new Date()): boolean {
  if (todo.done) return false;
  if (todo.dueAt) return new Date(todo.dueAt).getTime() < now.getTime();
  if (todo.dueDate) return todo.dueDate < todayKey(now);
  return false;
}

export function isDueToday(todo: Todo, now: Date = new Date()): boolean {
  return !todo.done && todoDay(todo) === todayKey(now);
}

export function weekRange(now: Date = new Date()): { start: string; end: string } {
  const start = dayKey(startOfWeek(now, WEEK_STARTS_ON));
  return { start, end: addDaysToKey(start, 6) };
}

export function matchesSmartList(todo: Todo, list: SmartList, now: Date = new Date()): boolean {
  const today = todayKey(now);

  if (list === "done") return todo.done;
  if (todo.done) return false;

  const day = todoDay(todo);

  switch (list) {
    case "today":
      return day === today;
    case "tomorrow":
      return day === addDaysToKey(today, 1);
    case "week": {
      if (!day) return false;
      const { start, end } = weekRange(now);
      return day >= start && day <= end;
    }
    case "overdue":
      return isOverdue(todo, now);
    case "all":
      return true;
    default:
      return true;
  }
}

export function filterTodos(
  todos: Todo[],
  list: SmartList,
  now: Date = new Date(),
  tag?: string | null,
): Todo[] {
  return sortTodos(
    todos.filter((todo) => {
      if (!matchesSmartList(todo, list, now)) return false;
      if (tag && !todo.tags.includes(tag)) return false;
      return true;
    }),
  );
}

export function sortTodos(todos: Todo[]): Todo[] {
  return [...todos].sort((left, right) => {
    if (left.done !== right.done) return left.done ? 1 : -1;
    if (left.done && right.done) {
      return (right.completedAt ?? "").localeCompare(left.completedAt ?? "");
    }

    const leftDay = todoDay(left);
    const rightDay = todoDay(right);
    if (leftDay !== rightDay) {
      if (!leftDay) return 1;
      if (!rightDay) return -1;
      return leftDay.localeCompare(rightDay);
    }

    if (left.priority !== right.priority) return right.priority - left.priority;
    if (left.sortOrder !== right.sortOrder) return left.sortOrder - right.sortOrder;
    return left.createdAt.localeCompare(right.createdAt);
  });
}

export function countTodos(
  todos: Todo[],
  now: Date = new Date(),
  tag?: string | null,
): Record<SmartList, number> {
  const scoped = tag ? todos.filter((todo) => todo.tags.includes(tag)) : todos;
  return {
    today: scoped.filter((todo) => matchesSmartList(todo, "today", now)).length,
    tomorrow: scoped.filter((todo) => matchesSmartList(todo, "tomorrow", now)).length,
    week: scoped.filter((todo) => matchesSmartList(todo, "week", now)).length,
    overdue: scoped.filter((todo) => matchesSmartList(todo, "overdue", now)).length,
    all: scoped.filter((todo) => matchesSmartList(todo, "all", now)).length,
    done: scoped.filter((todo) => matchesSmartList(todo, "done", now)).length,
  };
}

export function allTags(todos: Todo[]): string[] {
  const counts = new Map<string, number>();
  for (const todo of todos) {
    for (const tag of todo.tags) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .map(([tag]) => tag);
}

export type DueTone = "overdue" | "today" | "soon" | "none" | "done";

export function dueTone(todo: Todo, now: Date = new Date()): DueTone {
  if (todo.done) return "done";
  if (isOverdue(todo, now)) return "overdue";
  const day = todoDay(todo);
  if (!day) return "none";
  const today = todayKey(now);
  if (day === today) return "today";
  const soon = addDaysToKey(today, 2);
  return day <= soon ? "soon" : "none";
}

export function parseDueInput(value: string): string | null {
  const trimmed = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return null;
  const date = parseDayKey(trimmed);
  if (Number.isNaN(date.getTime())) return null;
  return trimmed;
}
