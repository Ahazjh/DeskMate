import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

async function setup() {
  let currentTheme = "light";
  const root = {
    classList: {
      add: vi.fn(),
      remove: vi.fn(),
      contains: vi.fn(() => false),
    },
    getAttribute: vi.fn((key: string) => (key === "data-theme" ? currentTheme : null)),
    setAttribute: vi.fn((key: string, value: string) => {
      if (key === "data-theme") currentTheme = value;
    }),
  };
  vi.stubGlobal("document", { documentElement: root });
  vi.stubGlobal("localStorage", { setItem: vi.fn(), getItem: vi.fn() });
  vi.stubGlobal("window", { matchMedia: () => ({ matches: false }) });
  const { applyTheme } = await import("./theme");
  return { applyTheme, root };
}

describe("applyTheme", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.resetModules();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("crossfades the theme colors without any overlay element", async () => {
    const { applyTheme, root } = await setup();

    applyTheme("dark");

    expect(root.setAttribute).toHaveBeenCalledWith("data-theme", "dark");
    expect(root.classList.add).toHaveBeenCalledWith("theme-transition");
    vi.advanceTimersByTime(400);
    expect(root.classList.remove).toHaveBeenCalledWith("theme-transition");
  });

  it("keeps the transition active when switching again before it finishes", async () => {
    const { applyTheme, root } = await setup();

    applyTheme("dark");
    vi.advanceTimersByTime(200);
    applyTheme("light");

    // 旧的 400ms 定时器若没被清掉，会在这里提前关掉第二次切换的过渡
    vi.advanceTimersByTime(200);
    expect(root.classList.remove).not.toHaveBeenCalledWith("theme-transition");

    vi.advanceTimersByTime(200);
    expect(root.classList.remove).toHaveBeenCalledTimes(1);
  });

  it("does not restart a transition for the already active theme", async () => {
    const { applyTheme, root } = await setup();

    applyTheme("light");

    expect(root.setAttribute).not.toHaveBeenCalledWith("data-theme", "light");
    expect(root.classList.add).not.toHaveBeenCalledWith("theme-transition");
  });
});
