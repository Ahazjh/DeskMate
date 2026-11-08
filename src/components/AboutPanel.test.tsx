import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";
import { AboutPanel } from "./AboutPanel";

vi.mock("@tauri-apps/api/app", () => ({
  getVersion: vi.fn(() => Promise.resolve("1.0.4")),
}));

describe("AboutPanel", () => {
  test("renders only the software introduction", () => {
    const markup = renderToStaticMarkup(<AboutPanel onClose={vi.fn()} />);

    expect(markup).toContain("关于");
    expect(markup).toContain("DeskMate");
    expect(markup).toContain("轻量、优雅的本地课表与日程");
    expect(markup).toContain("MIT License");
    expect(markup).not.toContain("GitHub");
    expect(markup).not.toContain("反馈问题");
    expect(markup).not.toContain("许可证");
    expect(markup).not.toContain("贡献者");
    expect(markup).not.toContain("您知道吗");
    expect(markup).not.toContain("正在读取更新设置");
    expect(markup).not.toContain("检查更新");
  });
});
