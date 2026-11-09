import { t, type TFunction } from "i18next";
import type { Note, NoteMetadata } from "./types";

export function getDisplayTitle(
  note: Pick<NoteMetadata, "title" | "preview">,
  translate: TFunction = t,
): string {
  const title = note.title.trim();
  if (title) return title;

  const preview = note.preview.trim();
  if (preview) return preview.slice(0, 20);

  return translate("common.untitledNote", { defaultValue: "无标题笔记" });
}

/**
 * 生成笔记预览。
 *
 * 早期实现用 `split(/\s+/)` 切分，中文正文没有空格，整篇会变成一个
 * 超长 token 再被截断成 80 字符 —— 搜索时跨行/跨空格的查询词就命中不了。
 * 现在改成按「换行 + 空白」切分并保留更多内容，中文句子也能完整进入索引。
 */
export function buildPreview(content: string): string {
  const normalized = content.replace(/\r\n/g, "\n").trim();
  if (!normalized) return "";
  // 按换行切成行，再把每行内部的连续空白压成单个空格
  const flattened = normalized
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join(" ");
  return flattened.slice(0, 240);
}

export function countNoteChars(content: string): number {
  let count = 0;
  for (const ch of content) {
    if (!/\s/.test(ch)) count++;
  }
  return count;
}

export function metadataFromNote(note: Note): NoteMetadata {
  return {
    id: note.id,
    title: note.title,
    fileName: note.fileName,
    category: note.category,
    createdAt: note.createdAt,
    updatedAt: note.updatedAt,
    wordCount: note.wordCount,
    preview: buildPreview(note.content),
  };
}

export interface CategoryGroup {
  category: string;
  notes: NoteMetadata[];
  latestUpdatedAt: string;
}

export function groupNotesByCategory(
  notes: NoteMetadata[],
  allCategories: string[] = [],
): CategoryGroup[] {
  const groups = new Map<string, NoteMetadata[]>();

  for (const cat of allCategories) {
    groups.set(cat, []);
  }

  for (const note of notes) {
    const key = note.category || "";
    const list = groups.get(key);
    if (list) {
      list.push(note);
    } else {
      groups.set(key, [note]);
    }
  }

  const result: CategoryGroup[] = [];
  for (const [category, categoryNotes] of groups) {
    categoryNotes.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    result.push({
      category,
      notes: categoryNotes,
      latestUpdatedAt: categoryNotes[0]?.updatedAt ?? "",
    });
  }

  result.sort((a, b) => {
    if (!a.category) return 1;
    if (!b.category) return -1;
    const aEmpty = a.notes.length === 0;
    const bEmpty = b.notes.length === 0;
    if (aEmpty && !bEmpty) return -1;
    if (!aEmpty && bEmpty) return 1;
    return a.category.localeCompare(b.category);
  });
  return result;
}

/**
 * 把查询串拆成多个关键词。
 *
 * 之前只做整串子串匹配，用户习惯用空格分词（「高等 数学」）就完全搜不到。
 * 现在按空白拆成 AND 关系的多个关键词，全部命中才算匹配。
 */
export function splitQueryKeywords(query: string): string[] {
  return query
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
}

/**
 * 笔记搜索：标题 / 预览 / 文件名 / 显示标题。
 * 多关键词之间是 AND 关系。
 */
export function filterNotes(notes: NoteMetadata[], query: string): NoteMetadata[] {
  const keywords = splitQueryKeywords(query);
  if (keywords.length === 0) return notes;

  return notes.filter((note) => {
    const haystack = [note.title, note.preview, note.fileName, getDisplayTitle(note)]
      .join(" ")
      .toLowerCase();
    return keywords.every((keyword) => haystack.includes(keyword));
  });
}

export function formatShortDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--";
  return `${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function formatTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--:--";
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}
