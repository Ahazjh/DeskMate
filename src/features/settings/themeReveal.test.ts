import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { switchThemeWithReveal } from "./themeReveal";

describe("switchThemeWithReveal", () => {
  beforeEach(() => {
    // 双 rAF 用来等新主题完成首次绘制；测试里手动驱动
    vi.stubGlobal(
      "requestAnimationFrame",
      vi.fn((callback: FrameRequestCallback) => {
        callback(0);
        return 0;
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("expands a circle from the clicked button, then switches theme and removes the circle", async () => {
    const root = {
      classList: {
        add: vi.fn(),
        remove: vi.fn(),
        contains: vi.fn(() => false),
      },
      getAttribute: vi.fn(() => "light"),
      setAttribute: vi.fn(),
    };
    const circle = {
      className: "",
      style: {} as Record<string, string>,
      remove: vi.fn(),
      animate: vi.fn(() => ({ finished: Promise.resolve() })),
    };
    const doc = {
      documentElement: root,
      body: { appendChild: vi.fn() },
      createElement: vi.fn(() => circle),
      activeElement: null,
    };
    const storage = { setItem: vi.fn(), getItem: vi.fn() };

    vi.stubGlobal("document", doc);
    vi.stubGlobal("localStorage", storage);
    vi.stubGlobal("window", {
      matchMedia: () => ({ matches: false }),
      innerWidth: 800,
      innerHeight: 600,
    });

    switchThemeWithReveal("dark", { x: 200, y: 150 });

    expect(circle.className).toBe("theme-reveal-circle");
    // 圆心 (200,150)，最远角 (800,600)，半径 750
    expect(circle.style.width).toBe("1500px");
    expect(circle.style.left).toBe("-550px");
    expect(circle.style.top).toBe("-600px");
    const [keyframes] = circle.animate.mock.calls[0] as unknown as [
      Array<{ transform?: string }>,
      unknown,
    ];
    expect(keyframes[0].transform).toBe("scale(0)");
    expect(keyframes[1].transform).toBe("scale(1)");

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(root.setAttribute).toHaveBeenCalledWith("data-theme", "dark");
    expect(storage.setItem).toHaveBeenCalledWith("theme-option", "dark");
    expect(circle.animate).toHaveBeenCalledTimes(2);
    expect(circle.remove).toHaveBeenCalled();
  });

  it("waits for two animation frames before fading out so the new theme paints first", async () => {
    const root = {
      classList: { add: vi.fn(), remove: vi.fn(), contains: vi.fn(() => false) },
      getAttribute: vi.fn(() => "light"),
      setAttribute: vi.fn(),
    };
    const circle = {
      className: "",
      style: {} as Record<string, string>,
      remove: vi.fn(),
      animate: vi.fn(() => ({ finished: Promise.resolve() })),
    };
    const doc = {
      documentElement: root,
      body: { appendChild: vi.fn() },
      createElement: vi.fn(() => circle),
      activeElement: null,
    };

    vi.stubGlobal("document", doc);
    vi.stubGlobal("localStorage", { setItem: vi.fn(), getItem: vi.fn() });
    vi.stubGlobal("window", {
      matchMedia: () => ({ matches: false }),
      innerWidth: 800,
      innerHeight: 600,
    });

    switchThemeWithReveal("dark", { x: 200, y: 150 });

    // 第一帧还没走完时，主题已切换但淡出尚未开始
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(root.setAttribute).toHaveBeenCalledWith("data-theme", "dark");
    // 淡出是第二次 animate 调用
    expect(circle.animate).toHaveBeenCalledTimes(2);
    const fadeCall = circle.animate.mock.calls[1] as unknown as
      | [Array<{ opacity?: number }>, unknown]
      | undefined;
    const fadeKeyframes = fadeCall?.[0];
    expect(fadeKeyframes?.[0].opacity).toBe(1);
    expect(fadeKeyframes?.[1].opacity).toBe(0);
  });

  it("applies the theme immediately when the user prefers reduced motion", () => {
    const root = {
      classList: { add: vi.fn(), remove: vi.fn(), contains: vi.fn(() => false) },
      getAttribute: vi.fn(() => "light"),
      setAttribute: vi.fn(),
    };
    const doc = {
      documentElement: root,
      body: { appendChild: vi.fn() },
      createElement: vi.fn(),
      activeElement: null,
    };

    vi.stubGlobal("document", doc);
    vi.stubGlobal("localStorage", { setItem: vi.fn(), getItem: vi.fn() });
    vi.stubGlobal("window", {
      matchMedia: (query: string) => ({
        matches: query.includes("reduced-motion"),
      }),
      innerWidth: 800,
      innerHeight: 600,
    });

    switchThemeWithReveal("dark", { x: 200, y: 150 });

    expect(root.setAttribute).toHaveBeenCalledWith("data-theme", "dark");
    expect(doc.body.appendChild).not.toHaveBeenCalled();
  });
});
