import { describe, expect, test } from "vitest";
import {
  addDaysToKey,
  combineDateTime,
  dayKey,
  monthGrid,
  startOfWeek,
  weekKeys,
  weekdayLabels,
} from "./dateUtils";

describe("agenda date utils", () => {
  test("builds a fixed 42-cell month grid starting on Monday", () => {
    const days = monthGrid(2026, 10);
    expect(days).toHaveLength(42);
    expect(days[0]).toBe("2026-10-26");
    expect(days[6]).toBe("2026-11-01");
    expect(days[41]).toBe("2026-12-06");
  });

  test("keeps day keys local instead of shifting through UTC", () => {
    expect(dayKey(new Date(2026, 10, 6, 23, 30))).toBe("2026-11-06");
    expect(dayKey(new Date(2026, 10, 7, 0, 5))).toBe("2026-11-07");
  });

  test("returns seven consecutive week keys", () => {
    expect(weekKeys("2026-11-02")).toEqual([
      "2026-11-02",
      "2026-11-03",
      "2026-11-04",
      "2026-11-05",
      "2026-11-06",
      "2026-11-07",
      "2026-11-08",
    ]);
  });

  test("combines a day and wall clock time", () => {
    const iso = combineDateTime("2026-11-06", "15:30");
    const date = new Date(iso);
    expect(date.getHours()).toBe(15);
    expect(date.getMinutes()).toBe(30);
    expect(dayKey(date)).toBe("2026-11-06");
  });

  test("anchors week start on the configured weekday", () => {
    expect(dayKey(startOfWeek(new Date(2026, 10, 6), 1))).toBe("2026-11-02");
    expect(dayKey(startOfWeek(new Date(2026, 10, 6), 0))).toBe("2026-11-01");
  });

  test("generates weekday labels that follow the week start", () => {
    expect(weekdayLabels("en-US", 1)[0]).toBe("Mon");
    expect(weekdayLabels("en-US", 0)[0]).toBe("Sun");
    expect(weekdayLabels("zh-CN", 1)[0]).toContain("一");
  });

  test("adds days without mutating the source date", () => {
    expect(addDaysToKey("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDaysToKey("2026-03-01", -1)).toBe("2026-02-28");
  });
});
