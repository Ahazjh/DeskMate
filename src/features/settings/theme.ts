import type { ThemeOption } from "./types";

function resolveTheme(option: ThemeOption): "light" | "dark" {
  if (option === "system") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  return option;
}

let crossfadeTimer: ReturnType<typeof setTimeout> | null = null;
let revealing = false;

/** 圆形揭示动画期间由 themeReveal 独占主题切换。 */
export function setThemeRevealing(active: boolean): void {
  revealing = active;
}

export function isThemeRevealing(): boolean {
  return revealing;
}

export function applyTheme(option: ThemeOption, crossfade = true): void {
  const root = document.documentElement;
  const resolved = resolveTheme(option);
  // Cache to localStorage so the blocking script in index.html can set
  // data-theme before first paint, preventing a flash of wrong theme.
  localStorage.setItem("theme-option", option);
  localStorage.setItem("theme-resolved", resolved);
  if (root.getAttribute("data-theme") !== resolved) {
    if (crossfade) {
      // 连续切换时重置计时器，避免上一次的定时器提前关掉过渡
      if (crossfadeTimer) clearTimeout(crossfadeTimer);
      root.classList.add("theme-transition");
    }
    root.setAttribute("data-theme", resolved);
    if (crossfade) {
      crossfadeTimer = setTimeout(() => {
        root.classList.remove("theme-transition");
        crossfadeTimer = null;
      }, 400);
    }
  }
}

let systemListener: (() => void) | null = null;

export function watchSystemTheme(option: ThemeOption): () => void {
  if (systemListener) {
    systemListener();
    systemListener = null;
  }

  if (option !== "system") return () => {};

  const mql = window.matchMedia("(prefers-color-scheme: dark)");
  const handler = () => {
    if (!revealing) applyTheme("system");
  };
  mql.addEventListener("change", handler);

  const cleanup = () => {
    mql.removeEventListener("change", handler);
    // 仅当自己仍是当前单例时才清空全局引用；否则会把后来者
    // （如设置面板刚注册的监听）的注销入口抹掉，造成监听泄漏
    if (systemListener === cleanup) {
      systemListener = null;
    }
  };
  systemListener = cleanup;
  return cleanup;
}
