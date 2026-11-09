import { useEffect, useMemo, useRef, useState } from "react";
import { searchNotes } from "./api";
import { filterNotes, splitQueryKeywords } from "./noteUtils";
import type { NoteMetadata } from "./types";

const DEBOUNCE_MS = 180;

export interface NoteSearchResult {
  /** 过滤后的笔记列表 */
  notes: NoteMetadata[];
  /** 是否正在做全文搜索 */
  searching: boolean;
}

/**
 * 笔记搜索。
 *
 * 两层过滤：
 * 1. **即时筛选** —— 用 metadata（标题/预览/文件名/分类）本地过滤，
 *    输入时立刻有反馈，不等后端。
 * 2. **全文搜索** —— 防抖后走后端 notes_search 读完整正文匹配，
 *    补上「正文靠后的内容也能搜到」这一层。
 *
 * 全文结果比本地筛选更宽（能搜到正文里的词），因此最终以全文结果为准，
 * 再按本地排序规则整理，保证列表顺序稳定。
 */
export function useNoteSearch(
  notes: NoteMetadata[],
  query: string,
): NoteSearchResult {
  const [fullTextIds, setFullTextIds] = useState<string[] | null>(null);
  const [searching, setSearching] = useState(false);
  const requestRef = useRef(0);

  const localMatches = useMemo(() => filterNotes(notes, query), [notes, query]);
  const keywordCount = splitQueryKeywords(query).length;

  useEffect(() => {
    // 空查询：不做全文搜索，直接显示全部
    if (keywordCount === 0) {
      requestRef.current += 1;
      setFullTextIds(null);
      setSearching(false);
      return;
    }

    const seq = ++requestRef.current;
    setSearching(true);

    const timer = window.setTimeout(() => {
      searchNotes(query)
        .then((ids) => {
          // 丢弃过期请求的结果，避免快速输入时结果来回跳
          if (seq !== requestRef.current) return;
          setFullTextIds(ids);
        })
        .catch(() => {
          if (seq !== requestRef.current) return;
          // 全文搜索失败时退回本地筛选，不阻断搜索功能
          setFullTextIds(null);
        })
        .finally(() => {
          if (seq !== requestRef.current) return;
          setSearching(false);
        });
    }, DEBOUNCE_MS);

    return () => window.clearTimeout(timer);
  }, [query, keywordCount]);

  const filtered = useMemo(() => {
    if (keywordCount === 0) return notes;
    // 全文搜索还没回来（或失败）：先显示本地命中结果
    if (fullTextIds === null) return localMatches;

    const byId = new Map(notes.map((note) => [note.id, note]));
    const result: NoteMetadata[] = [];
    for (const id of fullTextIds) {
      const note = byId.get(id);
      if (note) result.push(note);
    }
    // 按更新时间倒序（与未搜索时的默认排序一致）
    result.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
    return result;
  }, [notes, keywordCount, localMatches, fullTextIds]);

  return { notes: filtered, searching };
}
