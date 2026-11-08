import { applyTheme } from "./theme";
import type { ThemeOption } from "./types";

type Origin = { x: number; y: number };

const EXPAND_DURATION = 460;
const FADE_DURATION = 140;
const EXPAND_EASING = "cubic-bezier(0.25, 0.46, 0.45, 0.94)";

const LIGHT_GRADIENT =
  "radial-gradient(circle at center, rgba(246,243,236,0.45) 0%, rgba(246,243,236,0.45) 70%, rgba(246,243,236,0) 100%)";
const DARK_GRADIENT =
  "radial-gradient(circle at center, rgba(34,33,32,0.45) 0%, rgba(34,33,32,0.45) 70%, rgba(34,33,32,0) 100%)";

function resolveTheme(option: ThemeOption): "light" | "dark" {
  if (option === "system") {
    return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  return option;
}

function prefersReducedMotion(): boolean {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}

function resolveOrigin(origin?: Origin): Origin {
  if (origin && Number.isFinite(origin.x) && Number.isFinite(origin.y)) {
    return origin;
  }
  const active = document.activeElement as HTMLElement | null;
  if (active && typeof active.getBoundingClientRect === "function") {
    const rect = active.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    }
  }
  return { x: window.innerWidth / 2, y: window.innerHeight / 2 };
}

/** 圆心到最远视口角的距离，保证圆完全覆盖屏幕。 */
function coverRadius(origin: Origin): number {
  const { innerWidth: width, innerHeight: height } = window;
  return Math.max(
    Math.hypot(origin.x, origin.y),
    Math.hypot(width - origin.x, origin.y),
    Math.hypot(origin.x, height - origin.y),
    Math.hypot(width - origin.x, height - origin.y),
  );
}

/**
 * 以被点击的按键为中心，用单个圆形色幕由圆心向外扩散完成深浅色转换。
 * 只动画 transform / opacity（GPU 合成层），不做全屏快照，避免卡顿。
 * 圆覆盖整屏后才切换 data-theme，随后淡出色幕露出新主题界面，全程无跳变。
 */
export function switchThemeWithReveal(option: ThemeOption, origin?: Origin): void {
  const root = document.documentElement;
  const apply = () => applyTheme(option, false);

  if (prefersReducedMotion() || root.classList.contains("theme-revealing")) {
    apply();
    return;
  }

  const center = resolveOrigin(origin);
  const radius = coverRadius(center);
  const circle = document.createElement("div");
  circle.className = "theme-reveal-circle";
  circle.style.width = `${radius * 2}px`;
  circle.style.height = `${radius * 2}px`;
  circle.style.left = `${center.x - radius}px`;
  circle.style.top = `${center.y - radius}px`;
  circle.style.background = resolveTheme(option) === "dark" ? DARK_GRADIENT : LIGHT_GRADIENT;
  document.body.appendChild(circle);

  if (typeof circle.animate !== "function") {
    circle.remove();
    apply();
    return;
  }

  root.classList.add("theme-revealing");
  const expand = circle.animate(
    [
      { transform: "scale(0)", opacity: 1 },
      { transform: "scale(1)", opacity: 1 },
    ],
    { duration: EXPAND_DURATION, easing: EXPAND_EASING, fill: "forwards" },
  );

  void expand.finished
    .then(() => {
      // 圆已覆盖整屏，此时切主题被色幕遮住，不会闪
      apply();
      return circle.animate(
        [{ opacity: 1 }, { opacity: 0 }],
        { duration: FADE_DURATION, easing: "ease-out", fill: "forwards" },
      ).finished;
    })
    .catch(() => undefined)
    .finally(() => {
      circle.remove();
      root.classList.remove("theme-revealing");
    });
}
