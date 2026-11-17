import { applyTheme, setThemeRevealing } from "./theme";
import type { ThemeOption } from "./types";

type Origin = { x: number; y: number };
type ViewTransitionLike = {
  ready: Promise<void>;
  finished: Promise<void>;
  skipTransition: () => void;
};
type DocumentWithViewTransition = Document & {
  startViewTransition?: (callback: () => void) => ViewTransitionLike;
};

const EXPAND_DURATION = 460;
const EXPAND_EASING = "cubic-bezier(0.25, 0.46, 0.45, 0.94)";

let activeTransition: ViewTransitionLike | null = null;

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

function stopActiveTransition(): void {
  if (!activeTransition) return;
  activeTransition.skipTransition();
  activeTransition = null;
  setThemeRevealing(false);
}

/**
 * 以被点击的按键为圆心，让新主题页面从圆心向外揭示旧主题页面。
 *
 * 用 View Transition 的快照做 clip-path 揭示：旧主题在下、新主题在上，
 * 不是半透明色幕叠在页面上，所以过渡中不会出现灰蒙蒙的叠加效果。
 */
export function switchThemeWithReveal(option: ThemeOption, origin?: Origin): void {
  const center = resolveOrigin(origin);
  const radius = coverRadius(center);
  const doc = document as DocumentWithViewTransition;

  if (prefersReducedMotion() || typeof doc.startViewTransition !== "function") {
    stopActiveTransition();
    applyTheme(option);
    return;
  }

  // 动画途中改选：跳过上一轮，从新按键重新开始揭示
  stopActiveTransition();
  setThemeRevealing(true);

  const transition = doc.startViewTransition(() => applyTheme(option, false));
  activeTransition = transition;

  void transition.ready
    .then(() =>
      document.documentElement.animate(
        {
          clipPath: [
            `circle(0px at ${center.x}px ${center.y}px)`,
            `circle(${radius}px at ${center.x}px ${center.y}px)`,
          ],
        },
        {
          duration: EXPAND_DURATION,
          easing: EXPAND_EASING,
          fill: "forwards",
          pseudoElement: "::view-transition-new(root)",
        },
      ).finished,
    )
    .catch(() => undefined)
    .finally(() => {
      // 只清理自己那一轮，不能被旧动画误关
      if (activeTransition === transition) {
        activeTransition = null;
        setThemeRevealing(false);
      }
    });
}
