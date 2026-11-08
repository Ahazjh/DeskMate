import { describe, expect, it } from "vitest";
import { buildSharedFreeGrid, countSharedFreeSlots } from "./sharedSlots";
import type { Course } from "./types";

function course(overrides: Partial<Course> & Pick<Course, "id" | "name" | "weekday">): Course {
  return {
    startPeriod: 1,
    endPeriod: 2,
    location: "",
    teacher: "",
    weeks: "1-16周",
    color: null,
    note: "",
    createdAt: "2026-11-01T00:00:00.000Z",
    updatedAt: "2026-11-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("buildSharedFreeGrid", () => {
  it("双方都没课时是共同空档", () => {
    const grid = buildSharedFreeGrid([], [], 8);
    expect(grid).toHaveLength(7);
    expect(grid[0]).toHaveLength(12);
    expect(countSharedFreeSlots(grid)).toBe(84);
  });

  it("任意一方有课都不算共同空档", () => {
    const self = [course({ id: "s1", name: "高数", weekday: 1, startPeriod: 1, endPeriod: 2 })];
    const partner = [course({ id: "p1", name: "英语", weekday: 1, startPeriod: 2, endPeriod: 3 })];
    const grid = buildSharedFreeGrid(self, partner, 8);
    expect(grid[0][0]).toBe(false);
    expect(grid[0][1]).toBe(false);
    expect(grid[0][2]).toBe(false);
    expect(grid[0][3]).toBe(true);
  });

  it("按当前周过滤周次", () => {
    const partner = [
      course({ id: "p1", name: "单周课", weekday: 2, startPeriod: 1, endPeriod: 1, weeks: "单周" }),
    ];
    expect(buildSharedFreeGrid([], partner, 3)[1][0]).toBe(false);
    expect(buildSharedFreeGrid([], partner, 4)[1][0]).toBe(true);
  });

  it("week 为空时不做周次过滤", () => {
    const partner = [
      course({ id: "p1", name: "单周课", weekday: 2, startPeriod: 1, endPeriod: 1, weeks: "单周" }),
    ];
    expect(buildSharedFreeGrid([], partner, null)[1][0]).toBe(false);
  });
});
