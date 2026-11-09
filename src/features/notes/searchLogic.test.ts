import { describe, expect, it } from "vitest";
import { splitQueryKeywords, buildPreview, filterNotes } from "./noteUtils";
import type { NoteMetadata } from "./types";

function makeNote(overrides: Partial<NoteMetadata> = {}): NoteMetadata {
  return {
    id: "n1",
    title: "高等数学",
    fileName: "n1_高等数学.md",
    category: "课程笔记",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    wordCount: 10,
    preview: "第一章 极限与连续",
    ...overrides,
  };
}

describe("splitQueryKeywords", () => {
  it("按空白拆成多个关键词", () => {
    expect(splitQueryKeywords("高等 数学")).toEqual(["高等", "数学"]);
  });

  it("忽略首尾空白与多余空格", () => {
    expect(splitQueryKeywords("  高等   数学  ")).toEqual(["高等", "数学"]);
  });

  it("空串返回空数组", () => {
    expect(splitQueryKeywords("")).toEqual([]);
    expect(splitQueryKeywords("   ")).toEqual([]);
  });

  it("转小写", () => {
    expect(splitQueryKeywords("TODO")).toEqual(["todo"]);
  });
});

describe("buildPreview", () => {
  it("保留中文换行结构", () => {
    const preview = buildPreview("第一行内容\n第二行内容");
    expect(preview).toBe("第一行内容 第二行内容");
  });

  it("压掉行内连续空白", () => {
    expect(buildPreview("a    b")).toBe("a b");
  });

  it("空内容返回空串", () => {
    expect(buildPreview("   \n  ")).toBe("");
  });

  it("保留较长的内容用于搜索", () => {
    const long = "字".repeat(500);
    expect(buildPreview(long).length).toBe(240);
  });
});

describe("filterNotes", () => {
  it("空查询返回全部", () => {
    const notes = [makeNote()];
    expect(filterNotes(notes, "")).toBe(notes);
    expect(filterNotes(notes, "   ")).toBe(notes);
  });

  it("大小写不敏感", () => {
    const notes = [makeNote({ title: "TODO list", fileName: "n1_todo.md" })];
    expect(filterNotes(notes, "todo")).toHaveLength(1);
  });

  it("多关键词是 AND 关系", () => {
    const notes = [makeNote({ title: "高等数学", preview: "极限与连续" })];
    expect(filterNotes(notes, "高等 数学")).toHaveLength(1);
    // 「高等」命中但「概率」不命中 → 不返回
    expect(filterNotes(notes, "高等 概率")).toHaveLength(0);
  });

  it("命中预览里的正文内容", () => {
    const notes = [makeNote({ title: "", preview: "第一章 极限与连续" })];
    expect(filterNotes(notes, "极限")).toHaveLength(1);
  });
});
