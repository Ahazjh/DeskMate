import { describe, expect, it } from "vitest";
import { isNewerVersion } from "./presentation";

describe("isNewerVersion", () => {
  it("补丁号更大时算新版本", () => {
    expect(isNewerVersion("1.2.1", "1.2.0")).toBe(true);
    expect(isNewerVersion("1.3.0", "1.2.9")).toBe(true);
    expect(isNewerVersion("2.0.0", "1.9.9")).toBe(true);
  });

  it("版本相同时不算新版本", () => {
    expect(isNewerVersion("1.2.0", "1.2.0")).toBe(false);
    expect(isNewerVersion("v1.2.0", "1.2.0")).toBe(false);
  });

  it("旧版本不算新版本", () => {
    expect(isNewerVersion("1.2.0", "1.2.1")).toBe(false);
    expect(isNewerVersion("1.0.0", "2.0.0")).toBe(false);
  });

  it("忽略 v 前缀与预发布后缀", () => {
    expect(isNewerVersion("v1.2.1", "1.2.0")).toBe(true);
    expect(isNewerVersion("1.2.1-beta", "1.2.0")).toBe(true);
    // 同版本但带预发布后缀 —— 视作相同版本
    expect(isNewerVersion("1.2.1-beta", "1.2.1")).toBe(false);
  });

  it("缺失的段落按 0 补齐", () => {
    expect(isNewerVersion("1.2", "1.1.9")).toBe(true);
    expect(isNewerVersion("1.2", "1.2.0")).toBe(false);
    expect(isNewerVersion("2", "1.9.9")).toBe(true);
  });

  it("无法解析时返回 false（保守策略）", () => {
    expect(isNewerVersion("--", "1.2.0")).toBe(false);
    expect(isNewerVersion("", "1.2.0")).toBe(false);
    expect(isNewerVersion("1.2.1", "--")).toBe(false);
    expect(isNewerVersion("abc", "1.2.0")).toBe(false);
  });

  it("忽略首尾空白", () => {
    expect(isNewerVersion("  1.2.1 ", "1.2.0")).toBe(true);
  });
});
