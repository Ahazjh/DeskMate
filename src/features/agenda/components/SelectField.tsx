import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { getViewportPopupPosition } from "../../../components/popupPosition";

export interface SelectFieldOption {
  value: number;
  label: string;
}

interface SelectFieldProps {
  value: number;
  options: SelectFieldOption[];
  onChange: (value: number) => void;
  ariaLabel?: string;
  className?: string;
}

interface FixedPosition {
  x: number;
  y: number;
}

/**
 * 自绘下拉选择器：按钮 + fixed 定位弹层（portal 渲染到 body）。
 *
 * 不使用原生 <select>：在 Tauri 透明/无边框窗口（WebView2）下，
 * 原生下拉弹层会丢失定位锚点，表现为选项列表偏移到窗口左上角。
 * 弹层自身绘制在页面内，坐标由按钮的 getBoundingClientRect 推算，
 * 并用 getViewportPopupPosition 做视口内夹紧，因此始终紧贴按钮。
 */
export function SelectField({ value, options, onChange, ariaLabel, className }: SelectFieldProps) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [position, setPosition] = useState<FixedPosition | null>(null);

  const selectedLabel =
    options.find((option) => option.value === value)?.label ?? String(value);

  const measureAndPlace = () => {
    const button = buttonRef.current;
    const list = listRef.current;
    if (!button || !list) return;

    const rect = button.getBoundingClientRect();
    const next = getViewportPopupPosition(
      { x: rect.left, y: rect.bottom + 2 },
      { width: list.offsetWidth, height: list.offsetHeight },
      { width: window.innerWidth, height: window.innerHeight },
    );
    setPosition((current) =>
      current?.x === next.x && current.y === next.y ? current : next,
    );
  };

  useLayoutEffect(() => {
    if (!open) return;

    measureAndPlace();

    const handleReposition = () => measureAndPlace();
    window.addEventListener("resize", handleReposition);
    window.addEventListener("scroll", handleReposition, true);

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node | null;
      if (buttonRef.current?.contains(target)) return;
      if (listRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener("pointerdown", handlePointerDown, true);

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        setOpen(false);
        buttonRef.current?.focus();
        return;
      }
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        setActiveIndex((current) => {
          if (options.length === 0) return 0;
          const delta = event.key === "ArrowDown" ? 1 : -1;
          return (current + delta + options.length) % options.length;
        });
        return;
      }
      if (event.key === "Enter") {
        event.preventDefault();
        const option = options[activeIndex];
        if (option) {
          onChange(option.value);
          setOpen(false);
          buttonRef.current?.focus();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("resize", handleReposition);
      window.removeEventListener("scroll", handleReposition, true);
      document.removeEventListener("pointerdown", handlePointerDown, true);
      window.removeEventListener("keydown", handleKeyDown);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, options]);

  useEffect(() => {
    if (!open) return;
    const index = options.findIndex((option) => option.value === value);
    setActiveIndex(index >= 0 ? index : 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handleSelect = (option: SelectFieldOption) => {
    onChange(option.value);
    setOpen(false);
    buttonRef.current?.focus();
  };

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={() => setOpen((current) => !current)}
        className={
          className ??
          "h-8 w-full px-1.5 rounded-lg border border-paper-deep bg-paper-warm/80 text-[11px] font-body text-ink-soft outline-none focus:border-bamboo/40"
        }
      >
        <span className="flex items-center justify-between gap-1">
          <span className="truncate">{selectedLabel}</span>
          <svg
            width="8"
            height="8"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={`shrink-0 text-ink-ghost transition-transform ${open ? "rotate-180" : ""}`}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </span>
      </button>

      {open
        ? createPortal(
            <div
              ref={listRef}
              role="listbox"
              style={{
                position: "fixed",
                left: position?.x ?? -9999,
                top: position?.y ?? -9999,
                minWidth: buttonRef.current?.offsetWidth ?? 64,
                zIndex: 9999,
              }}
              className="max-h-56 overflow-y-auto rounded-lg border border-paper-deep/60 bg-cloud shadow-lg shadow-ink-faint/10 py-1"
            >
              {options.map((option, index) => (
                <button
                  key={option.value}
                  type="button"
                  role="option"
                  aria-selected={option.value === value}
                  onClick={() => handleSelect(option)}
                  onMouseEnter={() => setActiveIndex(index)}
                  className={`w-full text-left px-2.5 h-7 flex items-center text-[11px] font-body transition-colors cursor-pointer ${
                    option.value === value
                      ? "text-bamboo font-medium"
                      : "text-ink-soft"
                  } ${index === activeIndex ? "bg-paper-warm/70" : ""}`}
                >
                  {option.label}
                </button>
              ))}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
