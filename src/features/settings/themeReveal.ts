import { applyTheme } from "./theme";
import type { ThemeOption } from "./types";

type Origin = { x: number; y: number };

const EXPAND_DURATION = 380;
const FADE_DURATION = 160;
const EXPAND_EASING = "cubic-bezier(0.22, 0.61, 0.36, 1)";

const LIGHT_GRADIENT =
  "radial-gradient(circle at center, rgba(246,243,236,0.55) 0%, rgba(246,243,236,0.55) 72%, rgba(246,243,236,0) 100%)";
const DARK_GRADIENT =
  "radial-gradient(circle at center, rgba(34,33,32,0.55) 0%, rgba(34,33,32,0.55) 72%, rgba(34,33,32,0) 100%)";

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
 * 以被点击的按键为中心，用圆形色幕由圆心向外扩散完成深浅色转换。
 *
 * 性能要点（之前的实现切换时明显卡顿）：
 *
 * 1. **只做一次全屏重绘**。色幕本身是一个独立的合成层，展开与淡出都只动
 *    transform / opacity，浏览器不会因为它而重排整个页面。
 * 2. **切主题发生在色幕完全遮住屏幕之后**，此时 applyTheme 触发的那次全量
 *    样式重算被色幕盖住，用户看不到中间态，也不会有「闪一下」。
 * 3. **不在色幕上做全屏 backdrop-filter**。毛玻璃会让浏览器每帧重新采样
 *    背后内容，在大窗口下开销极高；这里改用不透明的径向渐变模拟。
 * 4. **动画结束再移除合成层提示**。will-change 用完即撤，避免长期占用 GPU 纹理。
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
  // 先把色幕固定在起点，避免第一帧从「未合成」的默认状态跳进来
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
      // 等一帧让新主题完成布局与绘制，再开始淡出；
      // 否则淡出会和首次绘制抢同一帧，看起来像「卡了一下」。
      return new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      }).then(() =>
        circle.animate(
          [{ opacity: 1 }, { opacity: 0 }],
          { duration: FADE_DURATION, easing: "ease-out", fill: "forwards" },
        ).finished,
      );
    })
    .catch(() => undefined)
    .finally(() => {
      circle.remove();
      root.classList.remove("theme-revealing");
    });
}
