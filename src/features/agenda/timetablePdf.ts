/**
 * 课程表 PDF 解析：把 pdf.js 的「文字项 + 坐标」还原成课程条目。
 *
 * 纯函数，不依赖 pdf.js，便于单元测试。两种排版都支持：
 * - 常规横向表格：星期表头横排，星期由 x 决定
 * - 旋转 90° 的表格（教务系统导出的横向 PDF 常见）：星期表头竖排，星期由 y 决定
 *
 * 判列逻辑刻意不用「文字中心点」——旋转排版里一行长文字的包围盒中心会漂到相邻列；
 * 改用「表头等距网格 + 文字行起点」，并对表格外的页眉页脚做过滤。
 */

export interface PdfTextItem {
  str: string;
  /** pdf.js 的 transform：[a, b, c, d, e, f]，其中 e = x，f = y */
  transform: number[];
  width: number;
  /** 所在页码，从 0 开始；跨页单元格需要按页序拼接 */
  pageIndex?: number;
}

export interface ParsedPdfCourse {
  name: string;
  weekday: number;
  startPeriod: number;
  endPeriod: number;
  location: string;
  teacher: string;
  weeks: string;
  note: string;
}

const WEEKDAY_PATTERNS: Array<[RegExp, number]> = [
  [/^(?:星期|周|礼拜)[一1]$|^mon(?:day)?$/i, 1],
  [/^(?:星期|周|礼拜)[二2]$|^tue(?:sday)?$/i, 2],
  [/^(?:星期|周|礼拜)[三3]$|^wed(?:nesday)?$/i, 3],
  [/^(?:星期|周|礼拜)[四4]$|^thu(?:rsday)?$/i, 4],
  [/^(?:星期|周|礼拜)[五5]$|^fri(?:day)?$/i, 5],
  [/^(?:星期|周|礼拜)[六6]$|^sat(?:urday)?$/i, 6],
  [/^(?:星期|周|礼拜)[日天7]$|^sun(?:day)?$/i, 7],
];

/** 课程名与属性之间的分隔符号（教务系统常用） */
const NAME_MARKERS = "◆☆★■◇●○※▲△▽▼";

const PERIOD_TOKEN = /[(（]\s*(\d{1,2})\s*(?:[-~—–]\s*(\d{1,2}))?\s*节\s*[)）]/;

/** 页面装饰性文字：表头、页脚、图例、节次标号，都不是课程内容 */
const FURNITURE_PATTERNS: RegExp[] = [
  /^时间段$/,
  /^节次$/,
  /^上午$|^下午$|^晚上$/,
  /^\d{1,2}$/,
  /打印时间/,
  /^学号/,
  /^其他课程/,
  /^[☆★■◇●○◆▪▫]/,
  /^\d{4}\s*[-—]\s*\d{4}\s*学年/,
];

function isFurniture(text: string): boolean {
  const compact = text.replace(/[\s\u3000]/g, "");
  if (!compact) return true;
  return FURNITURE_PATTERNS.some((pattern) => pattern.test(compact));
}

function cleanText(value: string): string {
  return value.replace(/[\u0000-\u001f]/g, "").replace(/\u00a0/g, " ").trim();
}

function weekdayOfText(text: string): number | null {
  const compact = text.replace(/[\s\u3000]/g, "");
  for (const [pattern, weekday] of WEEKDAY_PATTERNS) {
    if (pattern.test(compact)) return weekday;
  }
  return null;
}

/** 把 `1-3周(单),4-8周`、`第3周` 规整成课程表匹配器支持的写法 */
export function normalizeWeeks(raw: string): string {
  // 只取第一个 "/" 之前的部分：后面可能跟「校区:…」等其它字段
  const text = raw
    .split("/")[0]
    .replace(/[，、]/g, ",")
    .replace(/\s/g, "")
    .replace(/（/g, "(")
    .replace(/）/g, ")");
  const parts: string[] = [];
  for (const segment of text.split(",").filter(Boolean)) {
    const single = segment.includes("(单)");
    const double = segment.includes("(双)");
    const cleaned = segment
      .replace(/\(单\)/g, "")
      .replace(/\(双\)/g, "")
      .replace(/周/g, "")
      .replace(/^第/, "");
    const range = cleaned.match(/^(\d+)-(\d+)$/);
    if (range) {
      const from = Number(range[1]);
      const to = Number(range[2]);
      if (single || double) {
        for (let week = from; week <= to; week += 1) {
          if ((single && week % 2 === 1) || (double && week % 2 === 0)) {
            parts.push(String(week));
          }
        }
      } else {
        parts.push(`${from}-${to}`);
      }
      continue;
    }
    if (/^\d+$/.test(cleaned)) parts.push(cleaned);
  }
  return parts.length ? `${parts.join(",")}周` : "";
}

function fieldOf(block: string, keys: string[]): string {
  for (const key of keys) {
    const match = block.match(new RegExp(`${key}\\s*[:：]\\s*([^/]*)`));
    if (match) {
      const value = match[1].replace(/\s+/g, "").trim();
      if (value) return value;
    }
  }
  return "";
}

/** 解析一段（同一天的）拼接文字，返回其中的课程 */
export function parseColumnText(
  columnText: string,
  weekday: number,
): { courses: ParsedPdfCourse[]; warnings: string[] } {
  const courses: ParsedPdfCourse[] = [];
  const warnings: string[] = [];
  const flat = columnText.replace(/\s*\n\s*/g, "").replace(/\s{2,}/g, " ").trim();
  if (!flat) return { courses, warnings };

  // 每门课都以「学分:N」结尾，用它做块边界
  const blocks: string[] = [];
  const boundary = /学分\s*[:：]\s*\d+(?:\.\d+)?/g;
  let cursor = 0;
  let match: RegExpExecArray | null;
  while ((match = boundary.exec(flat)) !== null) {
    const end = match.index + match[0].length;
    blocks.push(flat.slice(cursor, end));
    cursor = end;
  }
  if (cursor < flat.length) {
    const tail = flat.slice(cursor).trim();
    if (tail) blocks.push(tail);
  }

  for (const rawBlock of blocks) {
    const block = rawBlock.trim();
    if (!block) continue;

    const periodMatch = block.match(PERIOD_TOKEN);
    const nameEnd = block.search(new RegExp(`[${NAME_MARKERS}]`));
    let name = "";
    if (nameEnd > 0) {
      name = block.slice(0, nameEnd);
    } else if (periodMatch && periodMatch.index! > 0) {
      name = block.slice(0, periodMatch.index);
    }
    name = name.replace(/[\s\d]+$/g, "").replace(/\s+/g, "").trim();

    if (!periodMatch || !name) {
      if (warnings.length < 20) warnings.push(block.slice(0, 80));
      continue;
    }

    const startPeriod = Number(periodMatch[1]);
    const periodEndRaw = periodMatch[2] ? Number(periodMatch[2]) : startPeriod;
    if (!(startPeriod >= 1 && periodEndRaw >= startPeriod && periodEndRaw <= 20)) {
      if (warnings.length < 20) warnings.push(block.slice(0, 80));
      continue;
    }

    const afterPeriods = block.slice(periodMatch.index! + periodMatch[0].length);
    const weeksRaw = afterPeriods.split("/")[0];
    const campus = fieldOf(block, ["校区"]);
    const location = fieldOf(block, ["场地", "地点", "教室", "上课地点"]);
    const teacher = fieldOf(block, ["教师", "老师", "任课教师"]);

    courses.push({
      name: name.slice(0, 80),
      weekday,
      startPeriod,
      endPeriod: periodEndRaw,
      location,
      teacher,
      weeks: normalizeWeeks(weeksRaw),
      note: campus ? `校区：${campus}` : "",
    });
  }
  return { courses, warnings };
}

interface Positioned {
  text: string;
  /** 沿阅读方向的起点 */
  read: number;
  /** 沿换行方向的坐标 */
  line: number;
  /** 字号，用于剔除标题 */
  size: number;
  pageIndex: number;
}

function median(values: number[]): number {
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}

/**
 * 从一份 PDF 的全部文字项里解析课程。
 * 传进来的 items 可以是多页混合，靠 pageIndex 排序拼接跨页单元格。
 */
export function parseTimetableItems(items: PdfTextItem[]): {
  courses: ParsedPdfCourse[];
  warnings: string[];
  weekdayColumns: number;
} {
  const usable = items.filter((item) => item.str && cleanText(item.str));
  if (usable.length === 0) return { courses: [], warnings: [], weekdayColumns: 0 };

  // 判断文字方向：多数项旋转超过 45° 时视为竖排表格
  const sample = usable.slice(0, Math.min(usable.length, 40));
  let rotatedCount = 0;
  for (const item of sample) {
    const angle = (Math.atan2(item.transform[1], item.transform[0]) * 180) / Math.PI;
    if (Math.abs(angle) > 45) rotatedCount += 1;
  }
  const rotated = rotatedCount * 2 > sample.length;

  const positioned: Positioned[] = [];
  for (const item of usable) {
    const text = cleanText(item.str);
    const x = item.transform[4];
    const y = item.transform[5];
    const size = Math.hypot(item.transform[2], item.transform[3]) || 0;
    positioned.push({
      text,
      read: rotated ? y : x,
      line: rotated ? x : y,
      size,
      pageIndex: item.pageIndex ?? 0,
    });
  }

  // 找星期表头（取首次出现，避免重复）
  const headerMap = new Map<number, { read: number; line: number }>();
  for (const item of positioned) {
    const weekday = weekdayOfText(item.text);
    if (weekday !== null && !headerMap.has(weekday)) {
      headerMap.set(weekday, { read: item.read, line: item.line });
    }
  }
  if (headerMap.size < 3) {
    return { courses: [], warnings: [], weekdayColumns: headerMap.size };
  }

  const centers = [...headerMap.entries()]
    .map(([weekday, value]) => ({ weekday, read: value.read }))
    .sort((left, right) => left.read - right.read);

  // 列宽取相邻表头间距的中位数；表头等距是这个版式的强特征
  const gaps: number[] = [];
  for (let index = 1; index < centers.length; index += 1) {
    gaps.push(centers[index].read - centers[index - 1].read);
  }
  const gap = gaps.length > 0 ? median(gaps) : 0;
  if (gap <= 0) return { courses: [], warnings: [], weekdayColumns: centers.length };

  const tableStart = centers[0].read - gap / 2;
  const tableEnd = centers[centers.length - 1].read + gap / 2;
  // 「往表格内部走」的换行方向：竖排表格 x 递增，横排表格 y 递减
  const lineDir = rotated ? 1 : -1;

  const columnOf = (read: number): number | null => {
    if (read < tableStart || read >= tableEnd) return null;
    const index = Math.floor((read - tableStart) / gap);
    if (index < 0 || index >= centers.length) return null;
    return index;
  };

  // 正文字号的中位数：明显更大的文字（如「张三课表」大标题）要丢掉
  const bodySizes: number[] = [];
  for (const item of positioned) {
    if (item.size > 0 && columnOf(item.read) !== null) bodySizes.push(item.size);
  }
  const bodySize = bodySizes.length > 0 ? median(bodySizes) : 0;
  const maxBodySize = bodySize > 0 ? bodySize * 1.9 : Number.POSITIVE_INFINITY;

  // weekday -> pageIndex -> 文字项
  const buckets = new Map<number, Map<number, Positioned[]>>();
  for (const item of positioned) {
    if (weekdayOfText(item.text) !== null) continue;
    if (isFurniture(item.text)) continue;
    if (item.size > maxBodySize) continue;
    const index = columnOf(item.read);
    if (index === null) continue;
    const weekday = centers[index].weekday;
    const pages = buckets.get(weekday) ?? new Map<number, Positioned[]>();
    const list = pages.get(item.pageIndex) ?? [];
    list.push(item);
    pages.set(item.pageIndex, list);
    buckets.set(weekday, pages);
  }

  const courses: ParsedPdfCourse[] = [];
  const warnings: string[] = [];
  for (const { weekday } of centers) {
    const pages = buckets.get(weekday);
    if (!pages) continue;
    // 跨页拼接：页序优先，再按行推进方向排序
    const pageKeys = [...pages.keys()].sort((left, right) => left - right);
    let columnText = "";
    for (const pageKey of pageKeys) {
      const list = pages.get(pageKey)!;
      list.sort(
        (left, right) =>
          left.line * lineDir - right.line * lineDir || left.read - right.read,
      );
      let lastLine: number | null = null;
      for (const item of list) {
        if (lastLine !== null && Math.abs(item.line - lastLine) > 1.5) {
          columnText += "\n";
        }
        columnText += item.text;
        lastLine = item.line;
      }
      columnText += "\n";
    }
    const parsed = parseColumnText(columnText, weekday);
    courses.push(...parsed.courses);
    warnings.push(...parsed.warnings);
  }

  courses.sort(
    (left, right) =>
      left.weekday - right.weekday ||
      left.startPeriod - right.startPeriod ||
      left.name.localeCompare(right.name),
  );
  return { courses, warnings, weekdayColumns: centers.length };
}
