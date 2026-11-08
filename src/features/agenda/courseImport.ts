import type { CourseInput } from "./types";

export interface CourseParseError {
  line: number;
  message: string;
}

export interface CourseParseResult {
  rows: CourseInput[];
  errors: CourseParseError[];
}

export const COURSE_IMPORT_TEMPLATE = [
  "课程名称\t星期\t开始节次\t结束节次\t地点\t教师\t周次",
  "高等数学\t周一\t1\t2\t教一101\t张老师\t1-16周",
  "大学英语\t周三\t3\t4\t外语楼203\t李老师\t1-16周",
].join("\n");

const WEEKDAYS: Record<string, number> = {
  "1": 1,
  "2": 2,
  "3": 3,
  "4": 4,
  "5": 5,
  "6": 6,
  "7": 7,
  一: 1,
  二: 2,
  三: 3,
  四: 4,
  五: 5,
  六: 6,
  日: 7,
  天: 7,
  七: 7,
  mon: 1,
  monday: 1,
  tue: 2,
  tues: 2,
  tuesday: 2,
  wed: 3,
  wednesday: 3,
  thu: 4,
  thur: 4,
  thurs: 4,
  thursday: 4,
  fri: 5,
  friday: 5,
  sat: 6,
  saturday: 6,
  sun: 7,
  sunday: 7,
};

export function parseWeekday(raw: string): number | null {
  const value = raw.trim().toLowerCase().replace(/\s+/g, "");
  if (!value) return null;
  if (WEEKDAYS[value]) return WEEKDAYS[value];

  const match = value.match(/^(?:星期|周|礼拜)?([一二三四五六日天七1-7])$/);
  if (!match) return null;
  return WEEKDAYS[match[1]] ?? null;
}

function splitLine(line: string, delimiter: string): string[] {
  if (delimiter === "\t") {
    return line.split("\t").map((cell) => cell.trim());
  }

  const cells: string[] = [];
  let current = "";
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"') {
      if (quoted && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
      continue;
    }
    if (character === delimiter && !quoted) {
      cells.push(current.trim());
      current = "";
      continue;
    }
    current += character;
  }
  cells.push(current.trim());
  return cells;
}

function detectDelimiter(line: string): string | null {
  if (line.includes("\t")) return "\t";
  if (line.includes(",")) return ",";
  if (line.includes("，")) return "，";
  return null;
}

function isHeader(cells: string[]): boolean {
  const first = cells[0] ?? "";
  const second = cells[1] ?? "";
  return /课程|名称|course|subject/i.test(first) && /星期|weekday|day/i.test(second);
}

function parsePeriod(raw: string): number | null {
  const value = raw.replace(/[第节\s]/g, "");
  if (!/^\d{1,2}$/.test(value)) return null;
  const period = Number(value);
  return period >= 1 && period <= 12 ? period : null;
}

/**
 * Parse a pasted timetable table. Columns:
 * 课程名称, 星期, 开始节次, 结束节次, 地点, 教师, 周次
 * Extra columns are ignored; a header row is optional.
 */
export function parseCourseTable(text: string): CourseParseResult {
  const lines = text
    .split(/\r?\n/)
    .map((line, index) => ({ line, number: index + 1 }))
    .filter(({ line }) => line.trim() && !line.trim().startsWith("#"));

  const rows: CourseInput[] = [];
  const errors: CourseParseError[] = [];

  if (lines.length === 0) {
    return { rows, errors: [{ line: 0, message: "请先粘贴课程数据" }] };
  }

  const delimiter = detectDelimiter(lines[0].line);
  if (!delimiter) {
    return {
      rows,
      errors: [{ line: lines[0].number, message: "未识别到分隔符，请用 Tab 或逗号分隔" }],
    };
  }

  lines.forEach(({ line, number }, index) => {
    const cells = splitLine(line, delimiter);
    if (index === 0 && isHeader(cells)) return;

    const name = (cells[0] ?? "").trim();
    const weekday = parseWeekday(cells[1] ?? "");
    const startPeriod = parsePeriod(cells[2] ?? "");
    const rawEnd = (cells[3] ?? "").trim();
    const endPeriod = rawEnd ? parsePeriod(rawEnd) : startPeriod;

    if (!name) {
      errors.push({ line: number, message: "缺少课程名称" });
      return;
    }
    if (weekday === null) {
      errors.push({ line: number, message: `无法识别星期「${cells[1] ?? ""}」` });
      return;
    }
    if (startPeriod === null) {
      errors.push({ line: number, message: `无法识别开始节次「${cells[2] ?? ""}」` });
      return;
    }
    if (endPeriod === null) {
      errors.push({ line: number, message: `无法识别结束节次「${rawEnd}」` });
      return;
    }

    rows.push({
      name,
      weekday,
      startPeriod,
      endPeriod: Math.max(startPeriod, endPeriod),
      location: (cells[4] ?? "").trim(),
      teacher: (cells[5] ?? "").trim(),
      weeks: (cells[6] ?? "").trim(),
      color: null,
      note: "",
    });
  });

  if (rows.length === 0 && errors.length === 0) {
    errors.push({ line: 0, message: "没有解析到有效课程" });
  }

  return { rows, errors };
}
