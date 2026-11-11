import { describe, expect, test } from "vitest";
import {
  DEFAULT_TIMETABLE_SCHEDULE,
  clockToMinutes,
  generatePeriodTimes,
  majorPeriodCount,
  minutesToClock,
  resolvePeriodTimes,
  resolveSeason,
  resolveSessionStarts,
  toMonthDay,
} from "./timetable";
import type { TimetableSchedule, TimetableSettings } from "./types";

function schedule(overrides: Partial<TimetableSchedule> = {}): TimetableSchedule {
  return { ...DEFAULT_TIMETABLE_SCHEDULE, ...overrides };
}

describe("clockToMinutes / minutesToClock", () => {
  test("互转", () => {
    expect(clockToMinutes("08:00")).toBe(480);
    expect(clockToMinutes("13:30")).toBe(810);
    expect(clockToMinutes("00:00")).toBe(0);
    expect(clockToMinutes("23:59")).toBe(1439);
  });

  test("格式不对返回 null", () => {
    expect(clockToMinutes("8:0")).toBeNull();
    expect(clockToMinutes("24:00")).toBeNull();
    expect(clockToMinutes("abc")).toBeNull();
  });

  test("分钟转时刻会补零、跨天折返", () => {
    expect(minutesToClock(480)).toBe("08:00");
    expect(minutesToClock(810)).toBe("13:30");
    expect(minutesToClock(1500)).toBe("01:00");
    expect(minutesToClock(-30)).toBe("23:30");
  });
});

describe("majorPeriodCount", () => {
  test("由每大节时长除以每小节时长推算", () => {
    expect(majorPeriodCount(schedule())).toBe(2);
    expect(
      majorPeriodCount(schedule({ periodMinutes: 40, majorPeriodMinutes: 120 })),
    ).toBe(3);
    expect(
      majorPeriodCount(schedule({ periodMinutes: 45, majorPeriodMinutes: 45 })),
    ).toBe(1);
  });
});

describe("generatePeriodTimes", () => {
  test("默认参数推出 12 节，含小课间与大课间", () => {
    const times = generatePeriodTimes(schedule(), {
      morning: "08:00",
      afternoon: "13:30",
      evening: "18:30",
    });
    expect(times).toHaveLength(12);
    expect(times.map((item) => `${item.period} ${item.start}-${item.end}`)).toEqual([
      "1 08:00-08:45",
      "2 08:55-09:40", // 小课间 10 分钟
      "3 09:55-10:40", // 大课间 15 分钟
      "4 10:50-11:35",
      "5 11:50-12:35",
      "6 13:30-14:15", // 下午独立开始时间
      "7 14:25-15:10",
      "8 15:25-16:10",
      "9 16:20-17:05",
      "10 18:30-19:15", // 晚上独立开始时间
      "11 19:25-20:10",
      "12 20:25-21:10",
    ]);
  });

  test("每小节时长与课间可调", () => {
    const times = generatePeriodTimes(
      schedule({
        periodMinutes: 40,
        majorPeriodMinutes: 80,
        shortBreakMinutes: 5,
        longBreakMinutes: 20,
        sessionPeriods: { morning: 2, afternoon: 0, evening: 0 },
      }),
      { morning: "09:00", afternoon: "13:30", evening: "18:30" },
    );
    expect(times.map((item) => `${item.start}-${item.end}`)).toEqual([
      "09:00-09:40",
      "09:45-10:25", // 小课间 5 分钟
    ]);
  });

  test("大课间按「一大节含几小节」判定", () => {
    const times = generatePeriodTimes(
      schedule({
        periodMinutes: 45,
        majorPeriodMinutes: 135, // 一大节含 3 小节
        shortBreakMinutes: 10,
        longBreakMinutes: 15,
        sessionPeriods: { morning: 3, afternoon: 0, evening: 0 },
      }),
      { morning: "08:00", afternoon: "13:30", evening: "18:30" },
    );
    expect(times.map((item) => item.start)).toEqual([
      "08:00",
      "08:55", // 第1节后是小课间
      "09:50", // 第2节后仍是小课间（同一大节内）
    ]);
  });

  test("三段节数可调，总节数随之变化", () => {
    const times = generatePeriodTimes(
      schedule({ sessionPeriods: { morning: 2, afternoon: 3, evening: 1 } }),
      { morning: "08:00", afternoon: "13:30", evening: "18:30" },
    );
    expect(times).toHaveLength(6);
    expect(times[5].start).toBe("18:30");
  });

  test("开始时间格式不对时该段跳过", () => {
    const times = generatePeriodTimes(
      schedule({ sessionPeriods: { morning: 2, afternoon: 1, evening: 0 } }),
      { morning: "乱写", afternoon: "13:30", evening: "18:30" },
    );
    expect(times.map((item) => item.period)).toEqual([1]);
  });
});

describe("resolveSeason / resolveSessionStarts", () => {
  test("全年一致时不做切换", () => {
    const value = schedule({ seasonal: false });
    expect(resolveSeason(value, new Date(2026, 5, 15))).toBe("winter");
    expect(resolveSessionStarts(value, new Date(2026, 5, 15))).toEqual({
      morning: "08:00",
      afternoon: "13:30",
      evening: "18:30",
    });
  });

  test("夏令时区间内取夏季时间", () => {
    const value = schedule({
      seasonal: true,
      summerStartDate: "05-01",
      winterStartDate: "10-01",
      summerStarts: { morning: "07:00", afternoon: "12:30", evening: "17:30" },
      winterStarts: { morning: "08:00", afternoon: "13:30", evening: "18:30" },
    });
    expect(resolveSeason(value, new Date(2026, 5, 15))).toBe("summer");
    expect(resolveSessionStarts(value, new Date(2026, 5, 15)).morning).toBe("07:00");
    expect(resolveSeason(value, new Date(2026, 10, 15))).toBe("winter");
    expect(resolveSessionStarts(value, new Date(2026, 10, 15)).morning).toBe("08:00");
  });

  test("切换日期跨年也能正确判断", () => {
    const value = schedule({
      seasonal: true,
      summerStartDate: "10-01",
      winterStartDate: "05-01",
    });
    // 夏令时 10-01 起、冬令时 05-01 起：
    // 1–4 月仍是去年 10 月延续下来的夏令时，5–9 月是冬令时，10–12 月是夏令时
    expect(resolveSeason(value, new Date(2026, 1, 15))).toBe("summer");
    expect(resolveSeason(value, new Date(2026, 3, 1))).toBe("summer");
    expect(resolveSeason(value, new Date(2026, 6, 1))).toBe("winter");
    expect(resolveSeason(value, new Date(2026, 8, 30))).toBe("winter");
    expect(resolveSeason(value, new Date(2026, 10, 15))).toBe("summer");
    expect(resolveSeason(value, new Date(2026, 11, 30))).toBe("summer");
  });

  test("切换日期非法时退回冬令时", () => {
    const value = schedule({ seasonal: true, summerStartDate: "13-45" });
    expect(resolveSeason(value, new Date(2026, 5, 15))).toBe("winter");
  });

  test("toMonthDay 只认 MM-DD", () => {
    expect(toMonthDay("05-01")).toBe(501);
    expect(toMonthDay("5-1")).toBe(501);
    expect(toMonthDay("2026-05-01")).toBeNull();
    expect(toMonthDay("13-01")).toBeNull();
  });
});

describe("resolvePeriodTimes", () => {
  const settings: TimetableSettings = {
    semesterStart: null,
    periodTimes: [
      { period: 1, start: "07:00", end: "07:45" },
      { period: 2, start: "07:55", end: "08:40" },
    ],
    schedule: null,
  };

  test("没有作息参数时沿用手动设置", () => {
    const times = resolvePeriodTimes(settings, new Date(2026, 5, 15));
    expect(times.map((item) => item.start)).toEqual(["07:00", "07:55"]);
  });

  test("有作息参数时按参数推算，并随时令切换", () => {
    const withSchedule: TimetableSettings = {
      ...settings,
      schedule: schedule({
        seasonal: true,
        summerStartDate: "05-01",
        winterStartDate: "10-01",
        sessionPeriods: { morning: 1, afternoon: 0, evening: 0 },
        summerStarts: { morning: "06:30", afternoon: "12:00", evening: "17:00" },
      }),
    };
    expect(resolvePeriodTimes(withSchedule, new Date(2026, 6, 1))[0].start).toBe(
      "06:30",
    );
    expect(resolvePeriodTimes(withSchedule, new Date(2026, 11, 1))[0].start).toBe(
      "08:00",
    );
  });
});
