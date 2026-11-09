import { useCallback, useEffect, useRef, useState } from "react";

export interface ToastItem {
  id: number;
  message: string;
  type?: "error" | "warning" | "info" | "success";
  /** 悬停提示：挂在图标上，鼠标移上去才显示 */
  description?: string;
  /** 不透明背景：用于「回顾笔记已生成」这类需要清晰可读的提示 */
  opaque?: boolean;
}

let nextId = 0;
const listeners = new Set<(item: ToastItem) => void>();

export function showToast(
  message: string,
  type: ToastItem["type"] = "error",
  description?: string,
  options?: { opaque?: boolean },
) {
  const item: ToastItem = {
    id: nextId++,
    message,
    type,
    description,
    opaque: options?.opaque,
  };
  listeners.forEach((fn) => fn(item));
}
const AUTO_DISMISS_MS = 5000;
const EXIT_DURATION_MS = 200;

const iconPaths: Record<NonNullable<ToastItem["type"]>, React.ReactNode> = {
  warning: (
    <>
      <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
    </>
  ),
  error: (
    <>
      <circle cx="12" cy="12" r="10" />
      <line x1="15" y1="9" x2="9" y2="15" />
      <line x1="9" y1="9" x2="15" y2="15" />
    </>
  ),
  success: (
    <>
      <circle cx="12" cy="12" r="10" />
      <polyline points="8 12.5 11 15.5 16 9.5" />
    </>
  ),
};

const iconColor: Record<NonNullable<ToastItem["type"]>, string> = {
  error: "text-red-400",
  warning: "text-amber-400",
  info: "text-ink-faint",
  success: "text-emerald-600 dark:text-emerald-500",
};

function ToastEntry({ item, onDismiss }: { item: ToastItem; onDismiss: (id: number) => void }) {
  const [exiting, setExiting] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const dismiss = useCallback(() => {
    setExiting(true);
    timerRef.current = setTimeout(() => onDismiss(item.id), EXIT_DURATION_MS);
  }, [item.id, onDismiss]);

  useEffect(() => {
    timerRef.current = setTimeout(dismiss, AUTO_DISMISS_MS);
    return () => clearTimeout(timerRef.current);
  }, [dismiss]);

  const type = item.type ?? "error";

  return (
    <div
      className={`toast-entry ${item.opaque ? "toast-entry-opaque" : ""} ${exiting ? "toast-exit" : "toast-enter"}`}
      role="alert"
    >
      <div className="flex items-start gap-2.5 min-w-0">
        <span
          className={`mt-px shrink-0 ${iconColor[type]}`}
          title={item.description}
          aria-label={item.description}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            {iconPaths[type]}
          </svg>
        </span>
        <span className="text-[12.5px] leading-relaxed text-ink-soft break-words min-w-0">
          {item.message}
        </span>
      </div>
      <button
        onClick={dismiss}
        className="shrink-0 mt-px ml-2 p-0.5 rounded text-ink-ghost hover:text-ink-faint transition-colors cursor-pointer"
      >
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>
  );
}

export function ToastContainer() {
  const [items, setItems] = useState<ToastItem[]>([]);

  useEffect(() => {
    const handler = (item: ToastItem) => setItems((prev) => [...prev.slice(-4), item]);
    listeners.add(handler);
    return () => {
      listeners.delete(handler);
    };
  }, []);

  const handleDismiss = useCallback((id: number) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
  }, []);

  if (items.length === 0) return null;

  return (
    <div className="fixed top-12 right-4 z-[9999] flex flex-col gap-2 pointer-events-none">
      {items.map((item) => (
        <div key={item.id} className="pointer-events-auto">
          <ToastEntry item={item} onDismiss={handleDismiss} />
        </div>
      ))}
    </div>
  );
}
