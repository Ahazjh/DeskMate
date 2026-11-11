import { describe, expect, test } from "vitest";
import {
  normalizeWeeks,
  parseColumnText,
  parseTimetableItems,
  type PdfTextItem,
} from "./timetablePdf";

/** 构造一个旋转 90° 的文字项（教务系统横向 PDF 的典型排版） */
function rotated(text: string, x: number, y: number, size = 8, pageIndex = 0): PdfTextItem {
  return {
    str: text,
    transform: [0, size, -size, 0, x, y],
    width: text.length * size * 0.7,
    pageIndex,
  };
}

/** 构造一个正常的横向文字项 */
function upright(text: string, x: number, y: number, size = 8, pageIndex = 0): PdfTextItem {
  return {
    str: text,
    transform: [size, 0, 0, size, x, y],
    width: text.length * size * 0.7,
    pageIndex,
  };
}

const WEEKDAY_LABELS = ["星期一", "星期二", "星期三", "星期四", "星期五", "星期六", "星期日"];

/** 一门课在单元格里的多行文字 */
function courseLines(
  name: string,
  periods: string,
  weeks: string,
  campus: string,
  room: string,
  teacher: string,
  credits: string,
): string[] {
  return [
    `${name}◆`,
    `(${periods}节)${weeks}/校区:${campus}`,
    `/场地:${room}/教师:${teacher}`,
    `/教学班:${name}-0001/考核方式:考试`,
    `/学分:${credits}`,
  ];
}

interface CellSpec {
  /** 1 = 周一 … 7 = 周日 */
  weekday: number;
  page: number;
  lines: string[];
  /** 覆盖起始 x，用于把「只有课名」的格子放到后续行位置 */
  x0?: number;
}

describe("parseTimetableItems —— 旋转 90° 且跨页的课表", () => {
  const HEADER_X = 74;
  const HEADER_Y0 = 133;
  const HEADER_STEP = 104;
  const CELL_X0 = 89.5;
  const LINE_STEP = 12;

  function buildItems(specs: CellSpec[]): PdfTextItem[] {
    const items: PdfTextItem[] = [];

    // 表头
    WEEKDAY_LABELS.forEach((label, index) => {
      items.push(rotated(label, HEADER_X, HEADER_Y0 + index * HEADER_STEP, 12));
    });
    // 时间段的三个分组标签
    ["上午", "下午", "晚上"].forEach((label, index) => {
      items.push(rotated(label, 62, 30 + index * 250, 12));
    });
    // 页眉 / 页脚 / 大标题，都应被过滤掉
    items.push(rotated("2026-2027学年第1学期", 42, 21));
    items.push(rotated("张三课表", 50, 361, 24));
    items.push(rotated("学号：302024509066", 42, 697));
    items.push(rotated("打印时间:2026-11-11", 363, 751.5));
    items.push(rotated("其他课程：某专题班◆某某(共2周)/1-2周/无", 346.5, 18));
    // 节次标号
    for (let period = 1; period <= 12; period += 1) {
      items.push(rotated(String(period), 89.5 + (period - 1) * 56, 75, 12));
    }

    // 单元格：第 2 页的表格左边缘比第 1 页更靠左，正是真实 PDF 的坑
    for (const spec of specs) {
      const y = HEADER_Y0 + (spec.weekday - 1) * HEADER_STEP;
      const x0 = spec.x0 ?? (spec.page === 0 ? CELL_X0 : 28);
      spec.lines.forEach((line, index) => {
        items.push(rotated(line, x0 + index * LINE_STEP, y, 8, spec.page));
      });
    }
    return items;
  }

  const specs: CellSpec[] = [
    { weekday: 1, page: 0, lines: courseLines("概率论与数理统计A", "3-4", "1-16周", "屏峰校区", "广A101", "周晶", "3.0") },
    { weekday: 1, page: 0, lines: ["创业基础与实务◆"], x0: 350 },
    { weekday: 2, page: 0, lines: courseLines("电路原理B", "1-2", "1-16周", "屏峰校区", "广A215", "余佩琼", "4.0") },
    { weekday: 2, page: 1, lines: courseLines("模拟电子技术A", "10-11", "5-16周", "屏峰校区", "广A403", "柴婉芳", "3.0") },
    { weekday: 3, page: 0, lines: courseLines("概率论与数理统计A", "1-2", "1-8周", "屏峰校区", "广A101", "周晶", "3.0") },
    { weekday: 4, page: 0, lines: ["Web服务器开发◆"], x0: 350 },
    { weekday: 4, page: 0, lines: courseLines("复变函数与积分变换", "3-4", "1-16周", "屏峰校区", "健B111", "潘永娟", "3.0") },
    { weekday: 5, page: 0, lines: courseLines("Web服务器开发", "1-2", "1-3周(单),4-8周", "屏峰校区", "计C311", "高华", "3.0") },
    { weekday: 6, page: 0, lines: courseLines("Web服务器开发", "1-2", "第3周", "屏峰校区", "计C311", "高华", "3.0") },
    // 这两门课的单元格被分页切开：课名在第 1 页，属性续到第 2 页
    {
      weekday: 1,
      page: 1,
      lines: [
        "(8-9节)1-16周/校区:屏峰校区",
        "/场地:健B107/教师:刘巍伟,吴亮亮",
        "/教学班:创业基础与实务-0008",
        "/学分:2.0",
      ],
    },
    {
      weekday: 4,
      page: 1,
      lines: [
        "(8-9节)1-16周/校区:屏峰校区",
        "/场地:计C311/教师:高华",
        "/教学班:Web服务器开发-0001",
        "/学分:3.0",
      ],
    },
  ];

  test("解析出全部课程且星期/节次/周次/地点/教师都正确", () => {
    const result = parseTimetableItems(buildItems(specs));
    expect(result.weekdayColumns).toBe(7);
    expect(result.warnings).toEqual([]);

    const summary = result.courses.map(
      (course) =>
        `${course.weekday}|${course.startPeriod}-${course.endPeriod}|${course.name}|${course.location}|${course.teacher}|${course.weeks}`,
    );
    expect(summary).toEqual([
      "1|3-4|概率论与数理统计A|广A101|周晶|1-16周",
      "1|8-9|创业基础与实务|健B107|刘巍伟,吴亮亮|1-16周",
      "2|1-2|电路原理B|广A215|余佩琼|1-16周",
      "2|10-11|模拟电子技术A|广A403|柴婉芳|5-16周",
      "3|1-2|概率论与数理统计A|广A101|周晶|1-8周",
      "4|3-4|复变函数与积分变换|健B111|潘永娟|1-16周",
      "4|8-9|Web服务器开发|计C311|高华|1-16周",
      "5|1-2|Web服务器开发|计C311|高华|1,3,4-8周",
      "6|1-2|Web服务器开发|计C311|高华|3周",
    ]);
  });

  test("页眉页脚与大标题不会被当成课程", () => {
    const result = parseTimetableItems(buildItems(specs));
    const names = result.courses.map((course) => course.name).join("|");
    expect(names).not.toContain("课表");
    expect(names).not.toContain("打印时间");
    expect(names).not.toContain("学号");
    expect(names).not.toContain("其他课程");
    expect(names).not.toContain("学年");
  });

  test("校区写进备注", () => {
    const result = parseTimetableItems(buildItems(specs));
    expect(result.courses[0].note).toBe("校区：屏峰校区");
  });
});

describe("parseTimetableItems —— 常规横向表格", () => {
  test("星期表头横排时按 x 判断星期", () => {
    const items: PdfTextItem[] = [];
    ["星期一", "星期二", "星期三"].forEach((label, index) => {
      items.push(upright(label, 100 + index * 100, 700, 12));
    });

    // 周三的一门课：三行文字，y 逐行递减
    const lines = courseLines("数据结构", "3-4", "1-16周", "朝晖校区", "计B201", "王老师", "3.5");
    lines.forEach((line, index) => {
      items.push(upright(line, 300, 660 - index * 10));
    });

    const result = parseTimetableItems(items);
    expect(result.weekdayColumns).toBe(3);
    expect(result.courses).toHaveLength(1);
    expect(result.courses[0]).toMatchObject({
      name: "数据结构",
      weekday: 3,
      startPeriod: 3,
      endPeriod: 4,
      weeks: "1-16周",
      location: "计B201",
      teacher: "王老师",
      note: "校区：朝晖校区",
    });
  });
});

describe("parseTimetableItems —— 边界情况", () => {
  test("星期表头不足三个时判定为不是课表", () => {
    const items = [upright("星期一", 100, 700, 12), upright("星期二", 200, 700, 12)];
    expect(parseTimetableItems(items).courses).toEqual([]);
  });

  test("空输入不抛错", () => {
    expect(parseTimetableItems([]).courses).toEqual([]);
    expect(parseTimetableItems([]).weekdayColumns).toBe(0);
  });
});

describe("normalizeWeeks", () => {
  test("常见周次写法", () => {
    expect(normalizeWeeks("1-16周")).toBe("1-16周");
    expect(normalizeWeeks("第3周")).toBe("3周");
    expect(normalizeWeeks("1-3周(单),4-8周")).toBe("1,3,4-8周");
    expect(normalizeWeeks("1-4周(双)")).toBe("2,4周");
    expect(normalizeWeeks("1-2周/校区:屏峰校区")).toBe("1-2周");
    expect(normalizeWeeks("")).toBe("");
  });
});

describe("parseColumnText", () => {
  test("一个单元格里有多门课时按「学分」切开", () => {
    const text =
      "课程甲◆(1-2节)1-8周/校区:屏峰校区/场地:广A101/教师:甲/学分:2.0" +
      "课程乙◆(3-4节)9-16周/校区:屏峰校区/场地:广B202/教师:乙/学分:3.0";
    const result = parseColumnText(text, 2);
    expect(result.warnings).toEqual([]);
    expect(result.courses.map((course) => course.name)).toEqual(["课程甲", "课程乙"]);
    expect(result.courses[1].weeks).toBe("9-16周");
  });

  test("缺节次信息的片段进警告而不是丢弃", () => {
    const result = parseColumnText("只是一段说明文字", 1);
    expect(result.courses).toEqual([]);
    expect(result.warnings).toHaveLength(1);
  });
});
