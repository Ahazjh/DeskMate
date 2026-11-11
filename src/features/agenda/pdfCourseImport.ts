/**
 * 课程表 PDF 导入：读文件字节 → pdf.js 取文字项与坐标 → 纯函数解析成课程。
 *
 * pdf.js 与 cmap 都按需加载，只有真正挑了一份 PDF 才会付出这份体积。
 */
import { readCoursePdfBytes } from "./api";
import { parseTimetableItems, type PdfTextItem } from "./timetablePdf";
import type { CourseFileImport } from "./types";

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

/** cMap 目录随应用一起发布，中文 CID 字体没有它解不出字 */
function cMapBase(): string {
  const base = import.meta.env.BASE_URL || "/";
  return `${base.endsWith("/") ? base : `${base}/`}pdfjs/cmaps/`;
}

/** 从 PDF 文件导入课程表 */
export async function importCoursesFromPdf(path: string): Promise<CourseFileImport> {
  const base64 = await readCoursePdfBytes(path);
  const data = base64ToBytes(base64);

  const pdfjs = await import("pdfjs-dist");
  const worker = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;

  const doc = await pdfjs.getDocument({
    data,
    cMapUrl: cMapBase(),
    cMapPacked: true,
  }).promise;

  try {
    const items: PdfTextItem[] = [];
    for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber += 1) {
      const page = await doc.getPage(pageNumber);
      const content = await page.getTextContent();
      for (const raw of content.items) {
        const item = raw as { str?: string; transform?: number[]; width?: number };
        if (!item.str || !item.transform) continue;
        items.push({
          str: item.str,
          transform: item.transform,
          width: typeof item.width === "number" ? item.width : 0,
          pageIndex: pageNumber - 1,
        });
      }
      page.cleanup();
    }

    const parsed = parseTimetableItems(items);
    const courses = parsed.courses.map((course) => ({
      name: course.name,
      weekday: course.weekday,
      startPeriod: course.startPeriod,
      endPeriod: course.endPeriod,
      location: course.location,
      teacher: course.teacher,
      weeks: course.weeks,
      color: null,
      note: course.note,
    }));

    return {
      courses,
      warnings: parsed.warnings,
      sheet: `${doc.numPages} 页`,
    };
  } finally {
    await doc.destroy();
  }
}
