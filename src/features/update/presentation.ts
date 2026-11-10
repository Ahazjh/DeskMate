import type { TFunction } from "i18next";
import { getUpdateErrorMessage } from "./updateErrors";
import type { UpdateState } from "./types";

export const ABOUT_UPDATE_LABEL_DURATION_MS = 30_000;

/**
 * 比较两个语义化版本号，判断 candidate 是否比 current 新。
 *
 * 只比较「主版本.次版本.修订号」三段数字，忽略 v 前缀与预发布后缀
 * （1.2.1-beta 视作 1.2.1）。无法解析时返回 false —— 宁可保守地
 * 不显示「立即更新」，也不要给用户一个点了会失败的按钮。
 */
export function isNewerVersion(candidate: string, current: string): boolean {
  const parse = (value: string): number[] | null => {
    const core = value.trim().replace(/^v/i, "").split(/[-+]/)[0];
    if (!/^\d+(\.\d+)*$/.test(core)) return null;
    const parts = core.split(".").map((part) => Number.parseInt(part, 10));
    while (parts.length < 3) parts.push(0);
    return parts.slice(0, 3);
  };

  const left = parse(candidate);
  const right = parse(current);
  if (!left || !right) return false;

  for (let index = 0; index < 3; index += 1) {
    if (left[index] !== right[index]) return left[index] > right[index];
  }
  return false;
}

export type UpdateNoticeTone = "idle" | "success" | "error";

export interface UpdateInlineNotice {
  tone: UpdateNoticeTone;
  text: string;
}

export interface AboutUpdateReminderState {
  hasPendingUpdate: boolean;
  showText: boolean;
}

export function hasPendingUpdate(
  status: Pick<UpdateState, "latestVersion"> | null | undefined,
): boolean {
  return Boolean(status?.latestVersion);
}

export function createAboutUpdateReminderState(
  status: Pick<UpdateState, "latestVersion"> | null | undefined,
): AboutUpdateReminderState {
  return {
    hasPendingUpdate: hasPendingUpdate(status),
    showText: false,
  };
}

export function applyAboutUpdateStatus(
  current: AboutUpdateReminderState,
  status: Pick<UpdateState, "latestVersion"> | null | undefined,
): AboutUpdateReminderState {
  if (!hasPendingUpdate(status)) {
    return { hasPendingUpdate: false, showText: false };
  }

  if (!current.hasPendingUpdate) {
    return { hasPendingUpdate: true, showText: true };
  }

  return {
    hasPendingUpdate: true,
    showText: current.showText,
  };
}

export function dismissAboutUpdateReminderText(
  current: AboutUpdateReminderState,
): AboutUpdateReminderState {
  return {
    hasPendingUpdate: current.hasPendingUpdate,
    showText: false,
  };
}

export function getUpdateCheckCompletionNotice(
  status: UpdateState,
  translate: TFunction,
): UpdateInlineNotice | null {
  if (status.status === "available") {
    return {
      tone: "success",
      text: translate("settings.update.available", {
        version: status.latestVersion,
        defaultValue: "发现新版本 {{version}}",
      }),
    };
  }

  if (status.status === "idle" && status.checkedAt) {
    return {
      tone: "success",
      text: translate("settings.update.notAvailable", {
        defaultValue: "当前已是最新版本",
      }),
    };
  }

  if (status.status === "failed" && status.lastError) {
    return {
      tone: "error",
      text: getUpdateErrorMessage(status.lastError, translate),
    };
  }

  return null;
}

export function getInitialUpdateStatusNotice(
  status: UpdateState | null | undefined,
  translate: TFunction,
): UpdateInlineNotice | null {
  if (status?.status === "failed" && status.lastError) {
    return {
      tone: "error",
      text: getUpdateErrorMessage(status.lastError, translate),
    };
  }

  return null;
}

export function getUpdateStatusHydrationNotice(
  notice: UpdateInlineNotice | null,
  translate: TFunction,
): UpdateInlineNotice {
  if (notice?.tone === "error") {
    return notice;
  }

  return {
    tone: "idle",
    text: translate("settings.update.loading", {
      defaultValue: "正在读取更新设置...",
    }),
  };
}
