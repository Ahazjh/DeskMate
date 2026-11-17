import { afterEach, describe, expect, it, vi } from "vitest";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function flush() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

async function setup(options: { reduced?: boolean; supportsViewTransition?: boolean } = {}) {
  vi.resetModules();
  const { reduced = false, supportsViewTransition = true } = options;
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
    animate: vi.fn(() => {
      const gate = deferred<void>();
      animations.push(gate.resolve);
      return { finished: gate.promise };
    }),
  };
  const animations: Array<() => void> = [];
  const transitions: Array<{ ready: () => void; skipTransition: ReturnType<typeof vi.fn> }> = [];
  const startViewTransition = vi.fn((callback: () => void) => {
    const ready = deferred<void>();
    const finished = deferred<void>();
    const skipTransition = vi.fn(() => {
      ready.reject(new Error("skipped"));
      finished.resolve();
    });
    transitions.push({ ready: ready.resolve, skipTransition });
    callback();
    return { ready: ready.promise, finished: finished.promise, skipTransition };
  });
  const storage = { setItem: vi.fn(), getItem: vi.fn() };

  vi.stubGlobal("document", {
    documentElement: root,
    activeElement: null,
    startViewTransition: supportsViewTransition ? startViewTransition : undefined,
  });
  vi.stubGlobal("localStorage", storage);
  vi.stubGlobal("window", {
    matchMedia: (query: string) => ({ matches: query.includes("reduce") ? reduced : false }),
    innerWidth: 800,
    innerHeight: 600,
  });

  const { switchThemeWithReveal } = await import("./themeReveal");
  const { isThemeRevealing } = await import("./theme");
  return {
    switchThemeWithReveal,
    isThemeRevealing,
    root,
    storage,
    transitions,
    animations,
    startViewTransition,
  };
}

function appliedThemes(storage: { setItem: ReturnType<typeof vi.fn> }): unknown[] {
  return storage.setItem.mock.calls
    .filter(([key]) => key === "theme-option")
    .map(([, value]) => value);
}

describe("switchThemeWithReveal", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("reveals the new theme with a circular clip-path from the clicked button", async () => {
    const env = await setup();

    env.switchThemeWithReveal("dark", { x: 200, y: 150 });

    expect(env.startViewTransition).toHaveBeenCalledTimes(1);
    expect(appliedThemes(env.storage)).toEqual(["dark"]);
    expect(env.isThemeRevealing()).toBe(true);
    expect(env.root.animate).not.toHaveBeenCalled();

    env.transitions[0].ready();
    await flush();

    expect(env.root.animate).toHaveBeenCalledTimes(1);
    const [keyframes, options] = env.root.animate.mock.calls[0] as unknown as [
      { clipPath: string[] },
      { duration: number; pseudoElement: string },
    ];
    expect(keyframes.clipPath[0]).toBe("circle(0px at 200px 150px)");
    expect(keyframes.clipPath[1]).toBe("circle(750px at 200px 150px)");
    expect(options.duration).toBe(460);
    expect(options.pseudoElement).toBe("::view-transition-new(root)");

    env.animations[0]();
    await flush();
    expect(env.isThemeRevealing()).toBe(false);
  });

  it("restarts the reveal from the new button when clicked mid-animation", async () => {
    const env = await setup();

    env.switchThemeWithReveal("dark", { x: 200, y: 150 });
    env.transitions[0].ready();
    await flush();

    env.switchThemeWithReveal("light", { x: 800, y: 600 });

    expect(env.transitions[0].skipTransition).toHaveBeenCalledTimes(1);
    expect(env.startViewTransition).toHaveBeenCalledTimes(2);
    expect(appliedThemes(env.storage)).toEqual(["dark", "light"]);
    expect(env.isThemeRevealing()).toBe(true);

    env.transitions[1].ready();
    await flush();
    const [keyframes] = env.root.animate.mock.calls[1] as unknown as [{ clipPath: string[] }];
    expect(keyframes.clipPath[1]).toBe("circle(1000px at 800px 600px)");

    // 旧动画结束不能把新一轮的标记清掉
    env.animations[0]();
    await flush();
    expect(env.isThemeRevealing()).toBe(true);

    env.animations[1]();
    await flush();
    expect(env.isThemeRevealing()).toBe(false);
  });

  it("falls back to a plain theme switch when view transitions are unavailable", async () => {
    const env = await setup({ supportsViewTransition: false });

    env.switchThemeWithReveal("dark", { x: 200, y: 150 });

    expect(appliedThemes(env.storage)).toEqual(["dark"]);
    expect(env.root.animate).not.toHaveBeenCalled();
    expect(env.isThemeRevealing()).toBe(false);
  });

  it("applies directly when reduced motion is requested", async () => {
    const env = await setup({ reduced: true });

    env.switchThemeWithReveal("dark", { x: 200, y: 150 });

    expect(appliedThemes(env.storage)).toEqual(["dark"]);
    expect(env.startViewTransition).not.toHaveBeenCalled();
  });
});
