import { addDaysToKey, isoDayKey } from "./dateUtils";
import type { Todo } from "./types";

export interface DdlDay {
  date: string;
  count: number;
  high: number;
  overdue: boolean;
}

export interface DdlPressure {
  days: DdlDay[];
  total: number;
  overdueCount: number;
  peak: DdlDay | null;
}

export function todoDeadlineDay(todo: Todo): string | null {
  if (todo.dueAt) return isoDayKey(todo.dueAt);
  return todo.dueDate;
}

/**
 * 未来 N 天每天到期的未完成待办数。逾期的单独计数，不挤占第一天，
 * 避免「今天」永远显示最高值。
 */
export function ddlPressure(todos: Todo[], today: string, days = 14): DdlPressure {
  const list: DdlDay[] = Array.from({ length: days }, (_, index) => ({
    date: addDaysToKey(today, index),
    count: 0,
    high: 0,
    overdue: false,
  }));
  const indexByDate = new Map(list.map((day, index) => [day.date, index]));

  let total = 0;
  let overdueCount = 0;
  for (const todo of todos) {
    if (todo.done) continue;
    const day = todoDeadlineDay(todo);
    if (!day) continue;
    if (day < today) {
      overdueCount += 1;
      continue;
    }
    const index = indexByDate.get(day);
    if (index === undefined) continue;
    list[index].count += 1;
    if (todo.priority >= 2) list[index].high += 1;
    total += 1;
  }

  const peak = list.reduce<DdlDay | null>(
    (best, day) => (day.count > 0 && (!best || day.count > best.count) ? day : best),
    null,
  );

  return { days: list, total, overdueCount, peak };
}
