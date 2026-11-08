import { useTranslation } from "react-i18next";
import { showToast } from "../../../components/Toast";
import { getErrorMessage } from "../../notes/api";
import { dismissReminderToday, snoozeReminder } from "../api";
import type { ReminderItem } from "../types";

interface ReminderBannerProps {
  item: ReminderItem;
  onOpen: (item: ReminderItem) => void;
  onClose: () => void;
}

export function ReminderBanner({ item, onOpen, onClose }: ReminderBannerProps) {
  const { t } = useTranslation();

  const snooze = async (minutes: number) => {
    try {
      await snoozeReminder(item.key, minutes);
      onClose();
    } catch (cause) {
      showToast(getErrorMessage(cause));
    }
  };

  const dismiss = async () => {
    try {
      await dismissReminderToday(item.key);
      onClose();
    } catch (cause) {
      showToast(getErrorMessage(cause));
    }
  };

  return (
    <div className="fixed bottom-4 right-4 z-[60] w-[300px] rounded-xl border border-paper-deep/60 bg-cloud shadow-[0_12px_32px_rgba(0,0,0,0.18)] overflow-hidden">
      <div className="h-8 px-3 flex items-center justify-between border-b border-paper-deep/30">
        <span className="text-[10px] font-body tracking-wide text-bamboo">
          {t("agenda.reminder.bannerTitle", { defaultValue: "DeskMate · 提醒" })}
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label={t("common.close", { defaultValue: "关闭" })}
          className="w-5 h-5 flex items-center justify-center rounded text-ink-ghost hover:text-ink-soft hover:bg-paper-warm cursor-pointer"
        >
          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="px-3 py-2.5">
        <div className="text-[12px] font-body font-medium text-ink-soft truncate">{item.title}</div>
        <div className="mt-0.5 text-[10px] font-body text-ink-ghost truncate">{item.body}</div>

        <div className="mt-2.5 flex items-center gap-1">
          <button
            type="button"
            onClick={() => onOpen(item)}
            className="h-6 px-2.5 rounded-md bg-bamboo text-cloud text-[10px] font-body hover:bg-bamboo-light transition-colors cursor-pointer"
          >
            {t("agenda.reminder.open", { defaultValue: "查看" })}
          </button>
          <button
            type="button"
            onClick={() => void snooze(5)}
            className="h-6 px-2 rounded-md text-[10px] font-body text-ink-faint hover:bg-paper-warm cursor-pointer"
          >
            {t("agenda.reminder.snooze5", { defaultValue: "5 分钟后" })}
          </button>
          <button
            type="button"
            onClick={() => void snooze(60)}
            className="h-6 px-2 rounded-md text-[10px] font-body text-ink-faint hover:bg-paper-warm cursor-pointer"
          >
            {t("agenda.reminder.snooze60", { defaultValue: "1 小时后" })}
          </button>
          <button
            type="button"
            onClick={() => void dismiss()}
            className="ml-auto h-6 px-1.5 rounded-md text-[10px] font-body text-ink-ghost hover:text-ink-soft cursor-pointer"
          >
            {t("agenda.reminder.dismissToday", { defaultValue: "今天不再" })}
          </button>
        </div>
      </div>
    </div>
  );
}
