import { useEffect } from "react";

interface TileEditorOverlayProps {
  title: string;
  content: string;
  titleRef: React.RefObject<HTMLInputElement | null>;
  contentRef: React.RefObject<HTMLTextAreaElement | null>;
  onTitleChange: (value: string) => void;
  onContentChange: (value: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
  fontSize: number;
  showTitle: boolean;
}

/**
 * 磁贴内编辑层：盖在磁贴之上，提供标题 + 正文输入。
 * 磁贴本身没有编辑 UI，这个浮层让「钉在桌面上的小窗」也能直接改内容，
 * 而不必先切换成便签窗口。
 */
export function TileEditorOverlay({
  title,
  content,
  titleRef,
  contentRef,
  onTitleChange,
  onContentChange,
  onSubmit,
  onCancel,
  fontSize,
  showTitle,
}: TileEditorOverlayProps) {
  useEffect(() => {
    contentRef.current?.focus();
  }, [contentRef]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onCancel();
        return;
      }
      if ((event.ctrlKey || event.metaKey) && event.key === "s") {
        event.preventDefault();
        onSubmit();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onCancel, onSubmit]);

  return (
    <div
      className="absolute inset-0 z-20 flex flex-col bg-cloud/95 backdrop-blur-sm px-2.5 py-2"
      onMouseDown={(event) => event.stopPropagation()}
      onDoubleClick={(event) => event.stopPropagation()}
    >
      {showTitle ? (
        <input
          ref={titleRef}
          value={title}
          onChange={(event) => onTitleChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              onSubmit();
            }
          }}
          placeholder="标题"
          className="w-full text-[13px] font-body font-medium text-ink placeholder:text-ink-ghost/60 bg-transparent border-b border-paper-deep/40 pb-1 mb-1.5 focus:border-bamboo/50 outline-none"
        />
      ) : null}
      <textarea
        ref={contentRef}
        value={content}
        onChange={(event) => onContentChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
            event.preventDefault();
            onSubmit();
          }
        }}
        placeholder="写点什么…"
        style={{ fontSize: `${fontSize}px` }}
        className="flex-1 min-h-0 w-full resize-none bg-transparent text-ink placeholder:text-ink-ghost/50 font-body leading-relaxed outline-none"
      />
      <div className="mt-1.5 flex items-center justify-between gap-2 shrink-0">
        <span className="text-[9px] font-body text-ink-ghost/70">
          Ctrl+S 保存 · Esc 取消
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onCancel}
            className="px-2 h-6 rounded-md text-[10.5px] font-body text-ink-faint hover:bg-paper-warm transition-colors cursor-pointer"
          >
            取消
          </button>
          <button
            type="button"
            onClick={onSubmit}
            className="px-2.5 h-6 rounded-md bg-bamboo text-cloud text-[10.5px] font-body hover:bg-bamboo-light transition-colors cursor-pointer"
          >
            保存
          </button>
        </div>
      </div>
    </div>
  );
}
