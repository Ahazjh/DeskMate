import { describe, expect, test } from "vitest";
import { parseCourseTable, parseWeekday } from "./courseImport";

describe("course table import", () => {
  test("parses tab separated rows with a header", () => {
    const text = [
      "课程名称\t星期\t开始节次\t结束节次\t地点\t教师\t周次",
      "高等数学\t周一\t1\t2\t教一101\t张老师\t1-16周",
      "大学英语\t周三\t3\t4\t外语楼203\t李老师\t1-16周",
    ].join("\n");

    const result = parseCourseTable(text);
    expect(result.errors).toEqual([]);
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0]).toMatchObject({
      name: "高等数学",
      weekday: 1,
      startPeriod: 1,
      endPeriod: 2,
      location: "教一101",
    });
    expect(result.rows[1].weekday).toBe(3);
  });

  test("parses comma separated rows with quoted fields", () => {
    const text = ["课程,星期,开始,结束,地点", '"设计,心理学",星期五,9,10,"艺术楼 101"'].join("\n");

    const result = parseCourseTable(text);
    expect(result.errors).toEqual([]);
    expect(result.rows[0].name).toBe("设计,心理学");
    expect(result.rows[0].weekday).toBe(5);
    expect(result.rows[0].location).toBe("艺术楼 101");
  });

  test("accepts chinese comma and weekday aliases", () => {
    const text = "体育，星期四，7，8，体育馆";
    const result = parseCourseTable(text);
    expect(result.errors).toEqual([]);
    expect(result.rows[0]).toMatchObject({
      name: "体育",
      weekday: 4,
      startPeriod: 7,
      endPeriod: 8,
    });
  });

  test("reports rows that cannot be parsed", () => {
    const text = ["课程\t星期\t开始\t结束", "坏数据\t第八天\t1\t2", "缺节次\t周一\tabc\t2"].join(
      "\n",
    );
    const result = parseCourseTable(text);
    expect(result.rows).toHaveLength(0);
    expect(result.errors).toHaveLength(2);
    expect(result.errors[0].message).toContain("星期");
    expect(result.errors[1].message).toContain("开始节次");
  });

  test("allows a missing header and clamps inverted periods", () => {
    const text = "自习\t周日\t6\t4\t图书馆";
    const result = parseCourseTable(text);
    expect(result.errors).toEqual([]);
    expect(result.rows[0].endPeriod).toBe(6);
  });

  test("maps weekday aliases", () => {
    expect(parseWeekday("星期一")).toBe(1);
    expect(parseWeekday("周三")).toBe(3);
    expect(parseWeekday("Wednesday")).toBe(3);
    expect(parseWeekday("7")).toBe(7);
    expect(parseWeekday("日")).toBe(7);
    expect(parseWeekday("第八天")).toBeNull();
  });
});
