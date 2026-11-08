import { parseCourseTable, parseWeekday, type CourseParseResult } from "./courseImport";
import type { CourseInput } from "./types";

export const FREE_TEXT_TEMPLATE = [
  "周一 1-2节 高等数学 教一101 张老师 1-16周",
  "周三 3-4节 大学英语 @外语楼203 李老师 单周",
  "周五 第5节 线性代数 双周",
].join("\n");

export interface CoursePhrase {
  name: string;
  location: string;
  teacher: string;
  weeks: string;
  weekday: number | null;
  startPeriod: number | null;
  endPeriod: number | null;
}

const WEEKDAY_TOKEN = /(?:星期|礼拜|周)\s*([一二三四五六日天七1-7])(?![节周])/g;
const WEEKDAY_EN =
  /\b(mon(?:day)?|tue(?:s|sday)?|wed(?:nesday)?|thu(?:r|rs|rsday)?|fri(?:day)?|sat(?:urday)?|sun(?:day)?)\b/gi;
const PERIOD_RANGE = /第?\s*(\d{1,2})\s*[-~–—、,，]\s*(\d{1,2})\s*节?(?!\s*周)/g;
const PERIOD_SINGLE = /第\s*(\d{1,2})\s*节(?!\s*[-~–—])/g;
const WEEKS_RANGE =
  /(\d{1,2}\s*[-~–—]\s*\d{1,2}(?:\s*[,，]\s*\d{1,2}\s*[-~–—]\s*\d{1,2})*)\s*周/g;
const WEEKS_WORD = /(单周|双周|每周|全周|单双周)/g;
const LOCATION_AT = /@\s*([^\s,，;；()（）]+)/g;
const LOCATION_PLAIN =
  /(教[一二三四五六七八九十\d]{1,3}[-\w\d]{0,8}|[A-Za-z]{1,3}\d{2,4}|[东西南北中]?[一二三四]教\s*\d{2,4})/g;
const TEACHER = /[（(]?\s*([\u4e00-\u9fa5]{1,5}(?:老师|教授|讲师|博士))\s*[)）]?/g;

function clampPeriod(value: number): number | null {
  return value >= 1 && value <= 12 ? value : null;
}

/** 从一格/一行文字里抽出课程名、地点、教师、周次、星期与节次。 */
export function extractCoursePhrase(input: string): CoursePhrase {
  let rest = input.replace(/[\r\n]+/g, " ").trim();
  let weekday: number | null = null;
  let startPeriod: number | null = null;
  let endPeriod: number | null = null;
  let weeks = "";
  let location = "";
  let teacher = "";

  rest = rest.replace(WEEKDAY_TOKEN, (_match, day: string) => {
    const parsed = parseWeekday(day);
    if (parsed !== null) weekday = parsed;
    return " ";
  });
  rest = rest.replace(WEEKDAY_EN, (match) => {
    const parsed = parseWeekday(match);
    if (parsed !== null && weekday === null) weekday = parsed;
    return " ";
  });

  rest = rest.replace(WEEKS_RANGE, (_match, value: string) => {
    weeks = value.replace(/\s+/g, "") + "周";
    return " ";
  });
  rest = rest.replace(WEEKS_WORD, (_match, value: string) => {
    weeks = weeks || value;
    return " ";
  });

  rest = rest.replace(PERIOD_RANGE, (_match, start: string, end: string) => {
    const from = clampPeriod(Number(start));
    const to = clampPeriod(Number(end));
    if (from !== null && to !== null) {
      startPeriod = from;
      endPeriod = Math.max(from, to);
      return " ";
    }
    return _match;
  });
  rest = rest.replace(PERIOD_SINGLE, (_match, value: string) => {
    const period = clampPeriod(Number(value));
    if (period !== null) {
      startPeriod = period;
      endPeriod = period;
      return " ";
    }
    return _match;
  });

  rest = rest.replace(LOCATION_AT, (_match, value: string) => {
    location = value;
    return " ";
  });
  rest = rest.replace(LOCATION_PLAIN, (match) => {
    if (location) return match;
    location = match.replace(/\s+/g, "");
    return " ";
  });

  rest = rest.replace(TEACHER, (_match, value: string) => {
    teacher = value;
    return " ";
  });

  const name = rest
    .replace(/[（）()【】[\],，;；:：|]/g, " ")
    .replace(/\s+/g, " ")
    .replace(/^(?:课程|科目)\s*/, "")
    .trim();

  return { name, location, teacher, weeks, weekday, startPeriod, endPeriod };
}

function isHeader(line: string): boolean {
  return /课程|名称|course|subject/i.test(line) && /星期|节次|weekday|period/i.test(line);
}

/**
 * 宽松解析任意格式课表文字。每行一门课，字段顺序不限；
 * 若整段是 TSV/CSV 表格，则回退到既有的表格解析器。
 */
export function parseFreeTextCourses(text: string): CourseParseResult {
  if (text.includes("\t")) {
    return parseCourseTable(text);
  }

  const lines = text
    .split(/\r?\n/)
    .map((line, index) => ({ line: line.trim(), number: index + 1 }))
    .filter(({ line }) => line && !line.startsWith("#"));

  const rows: CourseInput[] = [];
  const errors: CourseParseResult["errors"] = [];

  if (lines.length === 0) {
    return { rows, errors: [{ line: 0, message: "请先粘贴课程文字" }] };
  }

  for (const { line, number } of lines) {
    if (isHeader(line)) continue;
    const phrase = extractCoursePhrase(line);
    if (!phrase.name) {
      errors.push({ line: number, message: "缺少课程名称" });
      continue;
    }
    if (phrase.weekday === null) {
      errors.push({ line: number, message: "无法识别星期" });
      continue;
    }
    if (phrase.startPeriod === null || phrase.endPeriod === null) {
      errors.push({ line: number, message: "无法识别节次" });
      continue;
    }
    rows.push({
      name: phrase.name,
      weekday: phrase.weekday,
      startPeriod: phrase.startPeriod,
      endPeriod: phrase.endPeriod,
      location: phrase.location,
      teacher: phrase.teacher,
      weeks: phrase.weeks,
      color: null,
      note: "",
    });
  }

  if (rows.length === 0 && errors.length === 0) {
    errors.push({ line: 0, message: "没有解析到有效课程" });
  }
  return { rows, errors };
}

/** OCR 网格里的格子 → 课程，星期与节次由网格坐标给定。 */
export function phraseToCourse(
  phrase: CoursePhrase,
  weekday: number,
  startPeriod: number,
  endPeriod: number,
): CourseInput | null {
  const name = phrase.name.trim();
  if (!name || /^(?:周一|周二|周三|周四|周五|周六|周日|星期|节次|时间)$/.test(name)) {
    return null;
  }
  return {
    name,
    weekday,
    startPeriod,
    endPeriod,
    location: phrase.location,
    teacher: phrase.teacher,
    weeks: phrase.weeks,
    color: null,
    note: "",
  };
}
