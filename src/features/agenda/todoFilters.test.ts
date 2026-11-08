import { describe, expect, test } from "vitest";
import type { Todo } from "./types";
import { countTodos, filterTodos, isOverdue, sortTodos, todoDay } from "./todoFilters";

const NOW = new Date(2026, 10, 6, 12, 0, 0);

function todo(overrides: Partial<Todo> & Pick<Todo, "id" | "title">): Todo {
  return {
    notes: "",
    done: false,
    completedAt: null,
    dueDate: null,
    dueAt: null,
    priority: 0,
    tags: [],
    courseId: null,
    platform: "",
    kind: "task",
    remindMinutes: null,
    estimateMinutes: null,
    sortOrder: 0,
    createdAt: "2026-11-01T00:00:00.000Z",
    updatedAt: "2026-11-01T00:00:00.000Z",
    ...overrides,
  };
}

const overdueByDate = todo({ id: "a", title: "过期", dueDate: "2026-11-05" });
const overdueByTime = todo({
  id: "b",
  title: "今天早些时候",
  dueDate: "2026-11-06",
  dueAt: new Date(2026, 10, 6, 10, 0).toISOString(),
});
const today = todo({ id: "c", title: "今天", dueDate: "2026-11-06" });
const tomorrow = todo({ id: "d", title: "明天", dueDate: "2026-11-07" });
const nextWeek = todo({ id: "e", title: "下周", dueDate: "2026-11-10" });
const someday = todo({ id: "f", title: "无日期" });
const completed = todo({
  id: "g",
  title: "已完成",
  done: true,
  completedAt: "2026-11-06T01:00:00.000Z",
  dueDate: "2026-11-06",
});

const all = [overdueByDate, overdueByTime, today, tomorrow, nextWeek, someday, completed];

describe("agenda todo filters", () => {
  test("detects overdue by date and by time", () => {
    expect(isOverdue(overdueByDate, NOW)).toBe(true);
    expect(isOverdue(overdueByTime, NOW)).toBe(true);
    expect(isOverdue(today, NOW)).toBe(false);
    expect(isOverdue(completed, NOW)).toBe(false);
  });

  test("groups smart lists", () => {
    expect(filterTodos(all, "today", NOW).map((item) => item.id)).toEqual(["b", "c"]);
    expect(filterTodos(all, "tomorrow", NOW).map((item) => item.id)).toEqual(["d"]);
    expect(filterTodos(all, "week", NOW).map((item) => item.id)).toEqual(["a", "b", "c", "d"]);
    expect(filterTodos(all, "overdue", NOW).map((item) => item.id)).toEqual(["a", "b"]);
    expect(filterTodos(all, "all", NOW)).toHaveLength(6);
    expect(filterTodos(all, "done", NOW).map((item) => item.id)).toEqual(["g"]);
  });

  test("counts every smart list", () => {
    expect(countTodos(all, NOW)).toEqual({
      today: 2,
      tomorrow: 1,
      week: 4,
      overdue: 2,
      all: 6,
      done: 1,
    });
  });

  test("filters by tag on top of the smart list", () => {
    const tagged = { ...today, tags: ["工作"] };
    expect(filterTodos([tagged, someday], "all", NOW, "工作").map((item) => item.id)).toEqual([
      "c",
    ]);
  });

  test("sorts overdue first, then dated, then undated", () => {
    const sorted = sortTodos([someday, nextWeek, today, overdueByDate, overdueByTime]);
    expect(sorted.map((item) => item.id)).toEqual(["a", "c", "b", "e", "f"]);
  });

  test("derives the effective due day from time when present", () => {
    expect(todoDay(overdueByTime)).toBe("2026-11-06");
    expect(todoDay(someday)).toBeNull();
  });
});
