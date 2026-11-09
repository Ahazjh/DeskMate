import { describe, expect, it } from "vitest";
import {
  filterNotes,
  matchesKeywords,
  splitQueryKeywords,
  tokenizeForSearch,
} from "./noteUtils";
import type { NoteMetadata } from "./types";

function n(over: Partial<NoteMetadata>): NoteMetadata {
  return {
    id: "1",
    title: "",
    fileName: "",
    category: "",
    createdAt: "",
    updatedAt: "",
    wordCount: 5,
    preview: "",
    ...over,
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

describe("tokenizeForSearch", () => {
  it("把连续数字切成独立词元", () => {
    expect(tokenizeForSearch("第 12 章")).toContain("12");
  });

  it("把日期里的数字分开", () => {
    const tokens = tokenizeForSearch("2026-12-03 到期");
    expect(tokens).toContain("2026");
    expect(tokens).toContain("12");
    expect(tokens).toContain("03");
  });

  it("中英混合都能切出来", () => {
    const tokens = tokenizeForSearch("高等Math矩阵");
    expect(tokens).toContain("math");
    expect(tokens).toContain("高等");
  });
});

describe("matchesKeywords", () => {
  it("子串命中", () => {
    expect(matchesKeywords("12月计划", ["12"])).toBe(true);
  });

  it("完整词元命中", () => {
    expect(matchesKeywords("第 12 章 极限", ["12"])).toBe(true);
  });

  it("不相关的内容不命中", () => {
    expect(matchesKeywords("第三章 概率论", ["12"])).toBe(false);
    expect(matchesKeywords("矩阵 3x3", ["12"])).toBe(false);
  });

  it("多关键词是 AND 关系", () => {
    expect(matchesKeywords("高等数学 第三章", ["高等", "数学"])).toBe(true);
    expect(matchesKeywords("高等数学", ["高等", "概率"])).toBe(false);
  });

  it("空关键词恒命中", () => {
    expect(matchesKeywords("任意内容", [])).toBe(true);
  });

  it("大小写不敏感", () => {
    expect(matchesKeywords("TODO list", ["todo"])).toBe(true);
  });
});

describe("filterNotes", () => {
  it("空查询返回全部", () => {
    const notes = [n({ title: "A" })];
    expect(filterNotes(notes, "")).toBe(notes);
    expect(filterNotes(notes, "   ")).toBe(notes);
  });

  it("搜 12 不命中只含 3 的笔记", () => {
    const notes = [
      n({ id: "a", title: "12月计划", fileName: "a_x.md", preview: "12月的安排" }),
      n({ id: "b", title: "第三章 概率论", fileName: "b_y.md", preview: "含 3 的内容" }),
      n({ id: "c", title: "线性代数", fileName: "c_z.md", preview: "矩阵 3x3" }),
    ];
    const hits = filterNotes(notes, "12");
    expect(hits.map((x) => x.id)).toEqual(["a"]);
  });

  it("搜 3 不命中只含 12 的笔记", () => {
    const notes = [
      n({ id: "a", title: "12月计划", fileName: "a_x.md", preview: "12月的安排" }),
    ];
    expect(filterNotes(notes, "3")).toHaveLength(0);
  });

  it("标题为空时用 preview 兜底", () => {
    const notes = [n({ id: "a", title: "", preview: "极限与连续" })];
    expect(filterNotes(notes, "极限")).toHaveLength(1);
  });

  it("分类名参与匹配", () => {
    const notes = [n({ id: "a", title: "无题", category: "每日回顾" })];
    expect(filterNotes(notes, "每日回顾")).toHaveLength(1);
  });

  it("多关键词是 AND 关系", () => {
    const notes = [
      n({ id: "a", title: "高等数学", preview: "极限" }),
      n({ id: "b", title: "高等代数", preview: "线性" }),
    ];
    const hits = filterNotes(notes, "高等 极限");
    expect(hits.map((x) => x.id)).toEqual(["a"]);
  });
});
