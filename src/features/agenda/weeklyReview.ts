import { addDaysToKey, isoDayKey, parseDayKey, startOfWeek } from "./dateUtils";
import { courseMatchesWeek, resolvePeriodTimes, semesterWeek } from "./timetable";
import type { AgendaSnapshot } from "./types";

export const WEEKLY_REVIEW_CATEGORY = "每周回顾";

export interface WeeklyStats {
  weekStart: string;
  weekEnd: string;
  courseMinutes: number;
  eventMinutes: number;
  completedTodos: number;
  dailyDone: number;
  dailyTotal: number;
  pendingByCourse: { name: string; count: number }[];
}

function minutesOf(value: string): number | null {
  const [hours, minutes] = value.split(":").map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  return hours * 60 + minutes;
}

export function weeklyStats(snapshot: AgendaSnapshot, today: string): WeeklyStats {
  const start = startOfWeek(parseDayKey(today));
  const weekStart = isoDayKey(start.toISOString());
  const weekEnd = addDaysToKey(weekStart, 6);
  const days = Array.from({ length: 7 }, (_, index) => addDaysToKey(weekStart, index));
  const currentWeek = semesterWeek(snapshot.timetableSettings.semesterStart, today);

  let courseMinutes = 0;
  for (const day of days) {
    const weekday = ((parseDayKey(day).getDay() + 6) % 7) + 1;
    for (const course of snapshot.courses) {
      if (course.weekday !== weekday) continue;
      if (
        currentWeek !== null &&
        currentWeek > 0 &&
        !courseMatchesWeek(course.weeks, currentWeek)
      ) {
        continue;
      }
      const override = snapshot.courseOverrides.find(
        (item) => item.courseId === course.id && item.date === day,
      );
      if (override?.action === "cancel") continue;
      const startPeriod =
        override?.action === "move" && override.startPeriod
          ? override.startPeriod
          : course.startPeriod;
      const endPeriod =
        override?.action === "move" && override.endPeriod
          ? override.endPeriod
          : course.endPeriod;
      const periodTimes = resolvePeriodTimes(
        snapshot.timetableSettings,
        parseDayKey(today),
      );
      const from = periodTimes.find((item) => item.period === startPeriod);
      const to = periodTimes.find((item) => item.period === endPeriod);
      const startMinutes = from ? minutesOf(from.start) : null;
      const endMinutes = to ? minutesOf(to.end) : null;
      if (startMinutes !== null && endMinutes !== null && endMinutes > startMinutes) {
        courseMinutes += endMinutes - startMinutes;
      }
    }
  }

  let eventMinutes = 0;
  for (const event of snapshot.events) {
    if (event.allDay) continue;
    const eventStart = new Date(event.startAt).getTime();
    const eventEnd = new Date(event.endAt).getTime();
    for (const day of days) {
      const dayStart = new Date(`${day}T00:00:00`).getTime();
      const dayEnd = dayStart + 24 * 60 * 60 * 1000;
      const overlap = Math.min(eventEnd, dayEnd) - Math.max(eventStart, dayStart);
      if (overlap > 0) eventMinutes += Math.round(overlap / 60000);
    }
  }

  const completedTodos = snapshot.todos.filter(
    (todo) =>
      todo.done &&
      todo.completedAt &&
      isoDayKey(todo.completedAt) >= weekStart &&
      isoDayKey(todo.completedAt) <= weekEnd,
  ).length;

  const activeDaily = snapshot.dailyTasks.filter((task) => task.active);
  const dailyDone = days.reduce(
    (sum, day) => sum + (snapshot.dailyChecks[day]?.length ?? 0),
    0,
  );

  const byCourse = new Map<string, number>();
  for (const todo of snapshot.todos) {
    if (todo.done || !todo.courseId) continue;
    byCourse.set(todo.courseId, (byCourse.get(todo.courseId) ?? 0) + 1);
  }
  const pendingByCourse = [...byCourse.entries()]
    .map(([courseId, count]) => ({
      name: snapshot.courses.find((course) => course.id === courseId)?.name ?? "未命名课程",
      count,
    }))
    .sort((left, right) => right.count - left.count);

  return {
    weekStart,
    weekEnd,
    courseMinutes,
    eventMinutes,
    completedTodos,
    dailyDone,
    dailyTotal: activeDaily.length * 7,
    pendingByCourse,
  };
}

function hours(minutes: number): string {
  const value = Math.round((minutes / 60) * 10) / 10;
  return `${value} 小时`;
}

export function buildWeeklyReview(
  snapshot: AgendaSnapshot,
  today: string,
): { title: string; content: string; category: string } {
  const stats = weeklyStats(snapshot, today);
  const title = `每周回顾 · ${stats.weekStart.slice(5)} – ${stats.weekEnd.slice(5)}`;
  const rate =
    stats.dailyTotal > 0 ? Math.round((stats.dailyDone / stats.dailyTotal) * 100) : 0;

  const lines = [
    `# ${title}`,
    "",
    "## 本周概览",
    `- 上课：${hours(stats.courseMinutes)}`,
    `- 日程：${hours(stats.eventMinutes)}`,
    `- 完成待办：${stats.completedTodos} 项`,
    `- 每日必做完成率：${rate}%（${stats.dailyDone}/${stats.dailyTotal}）`,
    "",
  ];

  if (stats.pendingByCourse.length > 0) {
    lines.push("## 未完成的课程作业");
    for (const item of stats.pendingByCourse) {
      lines.push(`- ${item.name}：${item.count} 项`);
    }
    lines.push("");
  }

  const pendingToday = snapshot.todos.filter(
    (todo) => !todo.done && (todo.dueDate ?? (todo.dueAt ? isoDayKey(todo.dueAt) : null)),
  );
  if (pendingToday.length > 0) {
    lines.push("## 仍未完成");
    for (const todo of pendingToday.slice(0, 12)) {
      const due = todo.dueDate ?? (todo.dueAt ? isoDayKey(todo.dueAt) : "");
      lines.push(`- ${todo.title}${due ? `（截止 ${due}）` : ""}`);
    }
    if (pendingToday.length > 12) lines.push(`- …还有 ${pendingToday.length - 12} 项`);
    lines.push("");
  }

  lines.push("## 下周想做什么");
  lines.push("");
  lines.push("- ");
  return { title, content: lines.join("\n"), category: WEEKLY_REVIEW_CATEGORY };
}
