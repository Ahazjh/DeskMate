import { describe, expect, it } from "vitest";
import { extractCoursePhrase, parseFreeTextCourses, phraseToCourse } from "./freeTextCourses";

describe("extractCoursePhrase", () => {
  it("解析完整的一行", () => {
    const result = extractCoursePhrase("周一 1-2节 高等数学 教一101 张老师 1-16周");
    expect(result).toMatchObject({
      name: "高等数学",
      weekday: 1,
      startPeriod: 1,
      endPeriod: 2,
      location: "教一101",
      teacher: "张老师",
      weeks: "1-16周",
    });
  });

  it("字段顺序打乱也能解析", () => {
    const result = extractCoursePhrase("1-16周 高等数学 周三 3-4节");
    expect(result.name).toBe("高等数学");
    expect(result.weekday).toBe(3);
    expect(result.startPeriod).toBe(3);
    expect(result.endPeriod).toBe(4);
    expect(result.weeks).toBe("1-16周");
  });

  it("@ 前缀地点", () => {
    expect(extractCoursePhrase("周一 1-2节 英语 @外语楼203").location).toBe("外语楼203");
  });

  it("单节与单双周", () => {
    const result = extractCoursePhrase("星期五 第5节 线性代数 双周");
    expect(result.weekday).toBe(5);
    expect(result.startPeriod).toBe(5);
    expect(result.endPeriod).toBe(5);
    expect(result.weeks).toBe("双周");
  });

  it("多段周次", () => {
    expect(extractCoursePhrase("周二 1-2节 物理 1-8,10-16周").weeks).toBe("1-8,10-16周");
  });

  it("括号里的教师", () => {
    expect(extractCoursePhrase("周一 1-2节 化学（李老师）").teacher).toBe("李老师");
  });

  it("英文星期", () => {
    expect(parseFreeTextCourses("Mon 1-2节 Calculus").rows[0]?.weekday).toBe(1);
  });

  it("波浪号节次范围", () => {
    expect(extractCoursePhrase("周日 10~12节 实验课").endPeriod).toBe(12);
  });

  it("顿号分隔的节次", () => {
    expect(extractCoursePhrase("周四 3、4节 体育").endPeriod).toBe(4);
  });
});

describe("parseFreeTextCourses", () => {
  it("单行完整课程", () => {
    const result = parseFreeTextCourses("周一 1-2节 高等数学 教一101 张老师 1-16周");
    expect(result.errors).toHaveLength(0);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toMatchObject({
      name: "高等数学",
      weekday: 1,
      startPeriod: 1,
      endPeriod: 2,
      location: "教一101",
      teacher: "张老师",
      weeks: "1-16周",
    });
  });

  it("多行课程", () => {
    const result = parseFreeTextCourses(
      ["周一 1-2节 高等数学", "周三 3-4节 大学英语", "周五 第5节 线性代数 双周"].join("\n"),
    );
    expect(result.rows).toHaveLength(3);
    expect(result.rows.map((row) => row.name)).toEqual(["高等数学", "大学英语", "线性代数"]);
  });

  it("跳过表头与注释与空行", () => {
    const result = parseFreeTextCourses(
      ["# 我的课表", "课程名称 星期 节次 地点", "", "周一 1-2节 高数"].join("\n"),
    );
    expect(result.rows).toHaveLength(1);
    expect(result.errors).toHaveLength(0);
  });

  it("缺少星期报错", () => {
    const result = parseFreeTextCourses("1-2节 高等数学");
    expect(result.rows).toHaveLength(0);
    expect(result.errors[0]?.message).toContain("星期");
  });

  it("缺少节次报错", () => {
    const result = parseFreeTextCourses("周一 高等数学");
    expect(result.rows).toHaveLength(0);
    expect(result.errors[0]?.message).toContain("节次");
  });

  it("节次越界报错", () => {
    const result = parseFreeTextCourses("周一 13-14节 高等数学");
    expect(result.rows).toHaveLength(0);
  });

  it("空输入", () => {
    const result = parseFreeTextCourses("");
    expect(result.rows).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
  });

  it("TSV 表格自动回退到既有的表格解析器", () => {
    const result = parseFreeTextCourses("高等数学\t周一\t1\t2\t教一101\t张老师\t1-16周");
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]?.name).toBe("高等数学");
  });

  it("CSV 表格回退", () => {
    const result = parseFreeTextCourses("高等数学,周一,1,2,教一101,张老师,1-16周");
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]?.weekday).toBe(1);
  });

  it("1-16周不会被误判成节次", () => {
    const result = parseFreeTextCourses("周一 1-2节 高等数学 1-16周");
    expect(result.rows[0]?.startPeriod).toBe(1);
    expect(result.rows[0]?.endPeriod).toBe(2);
    expect(result.rows[0]?.name).toBe("高等数学");
  });

  it("只有表头时给出提示", () => {
    const result = parseFreeTextCourses("课程名称 星期 节次 地点");
    expect(result.rows).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
  });
});

describe("phraseToCourse", () => {
  it("用网格坐标补齐星期与节次", () => {
    const phrase = extractCoursePhrase("高等数学 教一101 1-16周");
    const course = phraseToCourse(phrase, 2, 3, 4);
    expect(course).toMatchObject({
      name: "高等数学",
      weekday: 2,
      startPeriod: 3,
      endPeriod: 4,
      location: "教一101",
      weeks: "1-16周",
    });
  });

  it("忽略纯表头格子", () => {
    expect(phraseToCourse(extractCoursePhrase("周三"), 3, 1, 2)).toBeNull();
  });

  it("空格子返回 null", () => {
    expect(phraseToCourse(extractCoursePhrase("   "), 1, 1, 1)).toBeNull();
  });
});
