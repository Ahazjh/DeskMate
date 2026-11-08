import { getVersion } from "@tauri-apps/api/app";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

interface AboutPanelProps {
  onClose: () => void;
}

export function AboutPanel({ onClose }: AboutPanelProps) {
  const { t } = useTranslation();
  const [version, setVersion] = useState("");

  useEffect(() => {
    getVersion().then(setVersion);
  }, []);

  return (
    <aside className="w-[360px] h-full shrink-0 border-l border-paper-deep/30 bg-cloud/92 backdrop-blur-sm flex flex-col">
      <div className="flex items-center justify-between h-11 px-4 border-b border-paper-deep/25">
        <h2 className="text-[13px] font-display font-medium text-ink-soft">
          {t("about.title", { defaultValue: "关于" })}
        </h2>
        <button
          type="button"
          onClick={onClose}
          className="w-7 h-7 flex items-center justify-center rounded-lg text-ink-ghost hover:text-ink-soft hover:bg-paper-warm transition-colors cursor-pointer"
          title={t("about.closeTitle", { defaultValue: "关闭关于" })}
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 12 12"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          >
            <path d="M2 2l8 8M10 2l-8 8" />
          </svg>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-hidden px-4 py-4">
        <section className="space-y-2">
          <h3 className="text-[20px] font-serif font-medium text-ink-soft">
            {t("about.productName", { defaultValue: "DeskMate" })}
          </h3>
          <p className="text-[11px] text-ink-ghost font-body leading-relaxed">
            {t("about.summary", { defaultValue: "轻量、优雅的本地课表与日程" })}
          </p>
          <p className="text-[11px] text-ink-ghost font-body leading-relaxed">
            Copyright © 2026 DeskMate Contributors,
            <br />
            Licensed under the MIT License.
          </p>
          {version && (
            <p className="text-[11px] text-ink-ghost font-mono">
              {t("about.version", { defaultValue: "版本：v{{version}}", version })}
            </p>
          )}
        </section>
      </div>
    </aside>
  );
}
