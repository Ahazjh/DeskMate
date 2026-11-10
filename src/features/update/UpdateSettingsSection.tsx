import { useEffect, useMemo, useRef, useState } from "react";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { message } from "@tauri-apps/plugin-dialog";
import { useTranslation } from "react-i18next";
import { openUrl } from "@tauri-apps/plugin-opener";

// MSIX installs are updated by the Microsoft Store; the About panel links
// there instead of exposing the in-app updater (mirror酱 sources included).
export const MICROSOFT_STORE_PRODUCT_ID = "9NRCC0ZSG81R";
export const MICROSOFT_STORE_PDP_URL = `ms-windows-store://pdp/?productid=${MICROSOFT_STORE_PRODUCT_ID}`;
import { SlidingButtonGroup } from "../../components/SlidingButtonGroup";
import {
  cancelUpdate,
  checkForUpdates,
  downloadUpdate,
  getUpdateSettings,
  getUpdateStatus,
  installUpdate,
  saveUpdateSettings,
} from "./api";
import {
  getInitialUpdateStatusNotice,
  getUpdateCheckCompletionNotice,
  getUpdateStatusHydrationNotice,
  isNewerVersion,
  type UpdateInlineNotice,
} from "./presentation";
import { getUpdateErrorCode, getUpdateErrorMessage } from "./updateErrors";
import type {
  DownloadSourcePreference,
  DownloadSourceUsed,
  UpdateChannel,
  UpdateDownloadProgress,
  UpdateErrorPayload,
  UpdateInstallResult,
  UpdateSettings,
  UpdateState,
} from "./types";

// Rust event payloads always carry installKind: null (the backend injects it
// only when the install is MSIX and we hydrate it via getUpdateStatus).
// Merging preserves the hydrated value so the MSIX store-managed gate below
// never silently reopens after an event overwrites the status.
export function mergeStatusPayload(
  current: UpdateState | null,
  incoming: UpdateState,
): UpdateState {
  if (incoming.installKind == null && current?.installKind != null) {
    return { ...incoming, installKind: current.installKind };
  }
  return incoming;
}

type BusyAction = "settings" | "checking" | "cdk" | "download" | "cancel" | "install" | null;

interface UpdateSettingsSectionProps {
  initialSettings?: UpdateSettings;
  initialStatus?: UpdateState;
  /**
   * - `full`：检查控件 + 更新设置都显示
   * - `checkOnly`：只显示检查/下载/安装控件
   * - `settingsOnly`：只显示更新设置
   * - `manual`：检查控件 + 更新设置都显示，但检查区额外突出「立即更新」入口
   */
  mode?: "full" | "checkOnly" | "settingsOnly" | "manual";
}

type IntervalOption = string;

export function UpdateSettingsSection({
  initialSettings,
  initialStatus,
  mode = "full",
}: UpdateSettingsSectionProps) {
  const { t } = useTranslation();
  const [settings, setSettings] = useState<UpdateSettings | null>(initialSettings ?? null);
  const [status, setStatus] = useState<UpdateState | null>(initialStatus ?? null);
  const [downloadProgress, setDownloadProgress] = useState<UpdateDownloadProgress | null>(null);
  const [busyAction, setBusyAction] = useState<BusyAction>(null);
  const [notice, setNotice] = useState<UpdateInlineNotice | null>(() =>
    getInitialUpdateStatusNotice(initialStatus, t),
  );
  const latestChannelRef = useRef<UpdateChannel>(
    initialSettings?.channel ?? initialStatus?.channel ?? "stable",
  );
  const translateRef = useRef(t);

  useEffect(() => {
    translateRef.current = t;
  }, [t]);

  useEffect(() => {
    latestChannelRef.current = settings?.channel ?? status?.channel ?? latestChannelRef.current;
  }, [settings?.channel, status?.channel]);

  const sourceOptions = useMemo<Array<{ value: DownloadSourcePreference; label: string }>>(
    () => [
      {
        value: "githubFirst",
        label: t("settings.update.source.github", { defaultValue: "GitHub" }),
      },
    ],
    [t],
  );

  const intervalOptions = useMemo<Array<{ value: IntervalOption; label: string }>>(() => {
    const options = [
      {
        value: "24",
        label: t("settings.update.interval.daily", { defaultValue: "每天" }),
      },
      {
        value: "168",
        label: t("settings.update.interval.weekly", { defaultValue: "每周" }),
      },
    ];
    const current = settings?.checkIntervalHours;
    if (current && current !== 24 && current !== 168) {
      return [
        {
          value: String(current),
          label: t("settings.update.interval.custom", {
            hours: current,
            defaultValue: "{{hours}} 小时",
          }),
        },
        ...options,
      ];
    }
    return options;
  }, [settings?.checkIntervalHours, t]);

  useEffect(() => {
    if (initialSettings && initialStatus) return;
    let alive = true;

    getUpdateStatus()
      .then((loadedStatus) => {
        if (!alive) return;
        setStatus(loadedStatus);
        setNotice(getInitialUpdateStatusNotice(loadedStatus, t));
        // MSIX installs are updated by the Microsoft Store; there are no
        // in-app update settings to load for them.
        if (loadedStatus.installKind === "windowsMsix") return;
        return getUpdateSettings().then((loadedSettings) => {
          if (!alive) return;
          latestChannelRef.current = loadedSettings.channel ?? loadedStatus.channel;
          setSettings(loadedSettings);
        });
      })
      .catch((error) => {
        if (!alive) return;
        setNotice({ tone: "error", text: getUpdateErrorMessage(error, t) });
      });

    return () => {
      alive = false;
    };
  }, [initialSettings, initialStatus, t]);

  useEffect(() => {
    let active = true;

    const bindEvents = async () => {
      const unlistenFns: UnlistenFn[] = [];
      const disposeAll = () => {
        for (const unlisten of unlistenFns.splice(0)) {
          unlisten();
        }
      };

      try {
        unlistenFns.push(
          await listen<UpdateState>("update://checking", (event) => {
            if (!active) return;
            setStatus((current) => mergeStatusPayload(current, event.payload));
          }),
        );

        unlistenFns.push(
          await listen<UpdateState>("update://checked", (event) => {
            if (!active) return;
            latestChannelRef.current = event.payload.channel;
            setStatus((current) => mergeStatusPayload(current, event.payload));
            const nextNotice = getUpdateCheckCompletionNotice(event.payload, translateRef.current);
            if (nextNotice) {
              setNotice(nextNotice);
            }
          }),
        );

        unlistenFns.push(
          await listen<UpdateDownloadProgress>("update://download-progress", (event) => {
            if (!active) return;
            setDownloadProgress(event.payload);
            setStatus((current) =>
              deriveDownloadProgressState(current, event.payload, latestChannelRef.current),
            );
          }),
        );

        unlistenFns.push(
          await listen<UpdateState>("update://download-finished", (event) => {
            if (!active) return;
            latestChannelRef.current = event.payload.channel;
            setDownloadProgress(null);
            setStatus((current) => mergeStatusPayload(current, event.payload));
          }),
        );

        unlistenFns.push(
          await listen<UpdateState>("update://install-finished", (event) => {
            if (!active) return;
            latestChannelRef.current = event.payload.channel;
            setStatus((current) => mergeStatusPayload(current, event.payload));
          }),
        );

        unlistenFns.push(
          await listen<UpdateErrorPayload>("update://error", (event) => {
            if (!active) return;
            const t = translateRef.current;
            const errorText = getUpdateErrorMessage(event.payload, t);
            setNotice({ tone: "error", text: errorText });
            if (event.payload.code.startsWith("updateInstall")) {
              void message(errorText, {
                title: t("settings.update.installFailedTitle", {
                  defaultValue: "安装更新失败",
                }),
                kind: "error",
              });
            }
            // Re-hydrate the status so transient failures (e.g. a cancelled
            // check) surface the latest state instead of a stale notice;
            // mirrors the MainWindow.tsx error-listener refetch behavior.
            void getUpdateStatus()
              .then((loaded) => {
                if (!active) return;
                setStatus(loaded);
              })
              .catch((err) =>
                console.warn("failed to refresh update status after error event", err),
              );
          }),
        );

        unlistenFns.push(
          await listen<UpdateErrorPayload>("update://auto-check-error", (event) => {
            if (!active) return;
            setNotice({
              tone: "error",
              text: getUpdateErrorMessage(event.payload, translateRef.current),
            });
          }),
        );

        return disposeAll;
      } catch (error) {
        disposeAll();
        console.error("failed to bind update settings event listeners", error);
        return () => undefined;
      }
    };

    const promise = bindEvents();

    return () => {
      active = false;
      void promise
        .then((dispose) => dispose())
        .catch((error) => {
          console.error("failed to dispose update settings event listeners", error);
        });
    };
  }, []);

  const currentVersion = status?.currentVersion ?? "--";
  const storeManaged = status?.installKind === "windowsMsix";
  const showCheckControls = mode !== "settingsOnly";
  const showSettingsControls = mode !== "checkOnly";
  const intervalValue: IntervalOption = String(settings?.checkIntervalHours ?? 24);
  const isDownloading = status?.status === "downloading";
  const isInstalling = status?.status === "installing";
  const controlsDisabled = busyAction !== null || isDownloading;
  const canCancel = isDownloading && busyAction !== "cancel";
  const currentSource = downloadProgress?.source ?? status?.source ?? null;
  const totalBytes = downloadProgress?.totalBytes ?? status?.assetSize ?? null;
  const downloadedBytes =
    downloadProgress?.downloadedBytes ??
    (status?.status === "downloaded" ? (status.assetSize ?? null) : null);
  const percent =
    downloadProgress?.percent ??
    (status?.status === "downloaded" ? 100 : status?.status === "downloading" ? 0 : null);
  const canDownload =
    status?.latestVersion != null &&
    status?.assetName != null &&
    status?.assetSize != null &&
    status?.status !== "downloaded" &&
    status?.status !== "installScheduled" &&
    !isDownloading;
  const canInstall =
    status?.latestVersion != null &&
    status?.assetPath != null &&
    status?.assetSize != null &&
    (status?.status === "downloaded" ||
      status?.status === "installScheduled" ||
      status?.status === "failed") &&
    status?.lastError?.action !== "retryDownload" &&
    !isInstalling;

  /**
   * 是否已经探到比当前版本更新的版本。
   * 后端在检查完成后会把 latestVersion 一并带回来，这里再做一次版本比较，
   * 避免「后端把 latestVersion 当作当前版本回填」时误显示「立即更新」。
   */
  const hasUpdate = useMemo(() => {
    if (!status?.latestVersion) return false;
    if (status.status === "downloading" || status.status === "installing") return false;
    return isNewerVersion(status.latestVersion, status.currentVersion);
  }, [status]);

  const persistSettings = async (nextSettings: UpdateSettings) => {
    latestChannelRef.current = nextSettings.channel;
    setSettings(nextSettings);
    setBusyAction("settings");
    setNotice(null);
    try {
      const saved = await saveUpdateSettings(nextSettings);
      setSettings(saved);
      setNotice({
        tone: "success",
        text: t("settings.update.saved", { defaultValue: "更新设置已保存" }),
      });
    } catch (error) {
      setNotice({ tone: "error", text: getUpdateErrorMessage(error, t) });
    } finally {
      setBusyAction(null);
    }
  };

  const updateSettings = <Key extends keyof UpdateSettings>(
    key: Key,
    value: UpdateSettings[Key],
  ) => {
    if (!settings) return;
    void persistSettings({ ...settings, [key]: value });
  };

  const handleIntervalChange = (value: IntervalOption) => {
    if (!settings) return;
    void persistSettings({
      ...settings,
      autoCheck: true,
      checkIntervalHours: Number(value),
    });
  };


  const handleCheck = async () => {
    setBusyAction("checking");
    setNotice(null);
    try {
      const result = await checkForUpdates(true);
      setNotice({
        tone: "success",
        text:
          result.status === "available"
            ? t("settings.update.available", {
                version: result.latestVersion,
                defaultValue: "发现新版本 {{version}}",
              })
            : t("settings.update.notAvailable", {
                defaultValue: "当前已是最新版本",
              }),
      });
    } catch (error) {
      setNotice({ tone: "error", text: getUpdateErrorMessage(error, t) });
    } finally {
      try {
        setStatus(await getUpdateStatus());
      } catch (refreshError) {
        console.warn("Failed to refresh update status after check", refreshError);
      }
      setBusyAction(null);
    }
  };

  const handleDownload = async () => {
    setBusyAction("download");
    setNotice(null);
    try {
      const result = await downloadUpdate("github");
      setNotice({
        tone: "success",
        text: t("settings.update.downloaded", {
          version: result.version ?? status?.latestVersion ?? "--",
          defaultValue: "版本 {{version}} 已下载完成",
        }),
      });
    } catch (error) {
      const message = getUpdateErrorMessage(error, t);
      const cancelled = getUpdateErrorCode(error) === "updateDownloadCancelled";
      setNotice({
        tone: cancelled ? "idle" : "error",
        text: cancelled ? t("settings.update.cancelled", { defaultValue: "下载已取消" }) : message,
      });
    } finally {
      setDownloadProgress(null);
      try {
        setStatus(await getUpdateStatus());
      } catch (refreshError) {
        console.warn("Failed to refresh update status after download", refreshError);
      }
      setBusyAction(null);
    }
  };

  const handleCancel = async () => {
    setBusyAction("cancel");
    setNotice(null);
    try {
      await cancelUpdate();
      setNotice({
        tone: "idle",
        text: t("settings.update.cancelRequested", {
          defaultValue: "已请求取消下载",
        }),
      });
    } catch (error) {
      setNotice({ tone: "error", text: getUpdateErrorMessage(error, t) });
    } finally {
      setBusyAction(null);
    }
  };

  /** 弹出安装确认并执行安装；返回是否真的执行了安装。 */
  const runInstall = async (): Promise<boolean> => {
    const confirmed = window.confirm(
      t("settings.update.confirmInstall", {
        defaultValue:
          "应用会先保存所有未保存内容，然后关闭、安装更新，并在完成后重新打开。是否继续？",
      }),
    );
    if (!confirmed) return false;

    setBusyAction("install");
    setNotice(null);
    try {
      const result = await installUpdate();
      setNotice({
        tone: "success",
        text: getInstallSuccessMessage(result, t),
      });
      return true;
    } catch (error) {
      setNotice({ tone: "error", text: getUpdateErrorMessage(error, t) });
      return false;
    }
  };

  const handleInstall = async () => {
    await runInstall();
    try {
      setStatus(await getUpdateStatus());
    } catch (refreshError) {
      console.warn("Failed to refresh update status after install", refreshError);
    }
    setBusyAction(null);
  };

  /**
   * 「立即更新」：下载 + 安装一步到位。
   * 已经下载好的话直接进安装流程，避免重复下载。
   */
  const handleUpdateNow = async () => {
    const alreadyDownloaded =
      status?.status === "downloaded" || status?.status === "installScheduled";
    if (alreadyDownloaded) {
      await handleInstall();
      return;
    }

    setBusyAction("download");
    setNotice(null);
    try {
      await downloadUpdate("github");
    } catch (error) {
      const message = getUpdateErrorMessage(error, t);
      const cancelled = getUpdateErrorCode(error) === "updateDownloadCancelled";
      setNotice({
        tone: cancelled ? "idle" : "error",
        text: cancelled
          ? t("settings.update.cancelled", { defaultValue: "下载已取消" })
          : message,
      });
      setDownloadProgress(null);
      try {
        setStatus(await getUpdateStatus());
      } catch (refreshError) {
        console.warn("Failed to refresh update status after download", refreshError);
      }
      setBusyAction(null);
      return;
    }

    setDownloadProgress(null);
    // 下载完成，继续走安装确认
    await handleInstall();
  };

  if (storeManaged) {
    // MSIX installs are updated by the Microsoft Store; hide the update
    // settings entirely and link the About panel to the Store product page.
    if (mode === "settingsOnly") return null;
    return (
      <section className="space-y-3 pt-2 border-t border-paper-deep/25">
        <p className="text-[11px] text-ink-ghost">
          {t("settings.update.msixNoInAppUpdate", {
            defaultValue:
              "MSIX 侧载版本暂不支持应用内更新，请通过 GitHub 或 Microsoft Store 获取最新版本",
          })}
        </p>
        <button
          type="button"
          onClick={() => void openUrl(MICROSOFT_STORE_PDP_URL)}
          className="w-full h-8 px-3 rounded-lg border border-paper-deep/45 text-[11px] text-ink-faint hover:text-bamboo hover:bg-bamboo-mist/50 transition-colors cursor-pointer"
        >
          {t("settings.update.openInStore", {
            defaultValue: "在 Microsoft Store 中查看更新",
          })}
        </button>
      </section>
    );
  }

  // Before the status has been hydrated the install kind is unknown, so
  // rendering any update controls risks showing them for a moment and then
  // replacing them with the Store link once the MSIX status arrives.
  if (status === null) {
    const hydrationNotice = getUpdateStatusHydrationNotice(notice, t);
    return (
      <section className="space-y-3 pt-2 border-t border-paper-deep/25">
        <p
          className={`text-[11px] ${
            hydrationNotice.tone === "error" ? "text-red-400" : "text-ink-ghost"
          }`}
        >
          {hydrationNotice.text}
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-3 pt-2 border-t border-paper-deep/25">
      {showCheckControls ? (
        <>
          <div className="flex items-center justify-between gap-2">
            <div>
              <h3 className="text-[11px] font-body text-ink-faint">
                {t("settings.update.title", { defaultValue: "更新" })}
              </h3>
              <p className="mt-1 text-[10px] font-mono text-ink-ghost">
                {busyAction === "checking" || status?.status === "checking"
                  ? t("settings.update.checking", {
                      defaultValue: "正在检查...",
                    })
                  : notice
                    ? notice.text
                    : t("settings.update.currentVersion", {
                        version: currentVersion,
                        defaultValue: "当前版本：{{version}}",
                      })}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {hasUpdate ? (
                <button
                  type="button"
                  disabled={controlsDisabled}
                  onClick={() => void handleUpdateNow()}
                  title={t("settings.update.updateNowHint", {
                    version: status?.latestVersion ?? "--",
                    defaultValue: "下载并安装 {{version}}，完成后自动重新打开",
                  })}
                  className="h-8 px-3 rounded-lg bg-bamboo text-[11px] text-paper hover:bg-bamboo-light disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
                >
                  {busyAction === "download"
                    ? t("settings.update.downloading", { defaultValue: "下载中..." })
                    : busyAction === "install"
                      ? t("settings.update.installing", { defaultValue: "安装中..." })
                      : t("settings.update.updateNow", { defaultValue: "立即更新" })}
                </button>
              ) : null}
              <button
                type="button"
                disabled={controlsDisabled}
                onClick={() => void handleCheck()}
                className="h-8 px-3 rounded-lg border border-paper-deep/45 text-[11px] text-ink-faint hover:text-bamboo hover:bg-bamboo-mist/50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
              >
                {busyAction === "checking"
                  ? t("settings.update.busy", { defaultValue: "处理中" })
                  : t("settings.update.check", { defaultValue: "检查更新" })}
              </button>
            </div>
          </div>

          {renderDownloadCard({
            t,
            status,
            source: currentSource,
            totalBytes,
            downloadedBytes,
            percent,
            bytesPerSecond: downloadProgress?.bytesPerSecond ?? 0,
            canDownload,
            canCancel,
            canInstall,
            installBusy: busyAction === "install",
            isInstalling,
            onDownload: () => void handleDownload(),
            onCancel: () => void handleCancel(),
            onInstall: () => void handleInstall(),
          })}
        </>
      ) : null}

      {showSettingsControls ? (
        settings ? (
          <>
            {!showCheckControls || mode === "manual" ? (
              <div>
                <h3 className="text-[11px] font-body text-ink-faint">
                  {t("settings.update.settingsTitle", {
                    defaultValue: "更新设置",
                  })}
                </h3>
              </div>
            ) : null}

            <div className="space-y-2">
              <UpdateToggleRow
                label={t("settings.update.autoCheck", {
                  defaultValue: "自动检查更新",
                })}
                checked={settings.autoCheck}
                disabled={controlsDisabled}
                onChange={(checked) => updateSettings("autoCheck", checked)}
              />
              <UpdateToggleRow
                label={t("settings.update.autoDownload", {
                  defaultValue: "有新版本时自动下载",
                })}
                checked={settings.autoDownload}
                disabled={controlsDisabled}
                onChange={(checked) => updateSettings("autoDownload", checked)}
              />
            </div>

            <div className="space-y-2">
              <label className="block text-[11px] font-body text-ink-faint">
                {t("settings.update.interval.label", {
                  defaultValue: "检查频率",
                })}
              </label>
              <SlidingButtonGroup
                options={intervalOptions}
                value={intervalValue}
                onChange={handleIntervalChange}
              />
            </div>

            <div className="space-y-2">
              <label className="block text-[11px] font-body text-ink-faint">
                {t("settings.update.source.label", { defaultValue: "下载源" })}
              </label>
              <SlidingButtonGroup
                options={sourceOptions}
                value="githubFirst"
                onChange={() => updateSettings("downloadSourcePreference", "githubFirst")}
                className="grid grid-cols-1"
              />
            </div>

          </>
        ) : (
          <>
            {!showCheckControls || mode === "manual" ? (
              <div>
                <h3 className="text-[11px] font-body text-ink-faint">
                  {t("settings.update.settingsTitle", {
                    defaultValue: "更新设置",
                  })}
                </h3>
              </div>
            ) : null}
            <p className="text-[11px] text-ink-ghost">
              {t("settings.update.loading", {
                defaultValue: "正在读取更新设置...",
              })}
            </p>
          </>
        )
      ) : null}
    </section>
  );
}

interface DownloadCardProps {
  t: ReturnType<typeof useTranslation>["t"];
  status: UpdateState | null;
  source: DownloadSourceUsed | null;
  totalBytes: number | null;
  downloadedBytes: number | null;
  percent: number | null;
  bytesPerSecond: number;
  canDownload: boolean;
  canCancel: boolean;
  canInstall: boolean;
  installBusy: boolean;
  isInstalling: boolean;
  onDownload: () => void;
  onCancel: () => void;
  onInstall: () => void;
}

function renderDownloadCard({
  t,
  status,
  source,
  totalBytes,
  downloadedBytes,
  percent,
  bytesPerSecond,
  canDownload,
  canCancel,
  canInstall,
  installBusy,
  isInstalling,
  onDownload,
  onCancel,
  onInstall,
}: DownloadCardProps) {
  if (
    !status?.latestVersion &&
    status?.status !== "downloading" &&
    status?.status !== "downloaded"
  ) {
    return null;
  }

  const sourceLabel = getSourceLabel(source, t);
  const progressWidth = `${Math.max(0, Math.min(percent ?? 0, 100))}%`;

  return (
    <div className="space-y-2 rounded-lg border border-paper-deep/25 bg-paper-warm/40 px-3 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-[11px] font-body text-ink-faint">
            {t("settings.update.latestVersion", {
              version: status?.latestVersion ?? "--",
              defaultValue: "待更新版本：{{version}}",
            })}
          </p>
          {status?.assetName ? (
            <p className="text-[10px] font-mono text-ink-ghost break-all">{status.assetName}</p>
          ) : null}
        </div>
        {sourceLabel ? (
          <span className="shrink-0 rounded-full border border-paper-deep/30 px-2 py-0.5 text-[10px] font-mono text-ink-ghost">
            {sourceLabel}
          </span>
        ) : null}
      </div>

      {status?.status === "downloading" || status?.status === "downloaded" ? (
        <div className="space-y-1.5">
          <div className="h-2 overflow-hidden rounded-full bg-paper-deep/15">
            <div
              className="h-full rounded-full bg-bamboo transition-[width] duration-200"
              style={{ width: progressWidth }}
            />
          </div>
          <div className="flex items-center justify-between gap-2 text-[10px] font-mono text-ink-ghost">
            <span>
              {formatBytes(downloadedBytes)}
              {totalBytes ? ` / ${formatBytes(totalBytes)}` : ""}
            </span>
            <span>{percent == null ? "--" : `${percent.toFixed(1)}%`}</span>
          </div>
          {status?.status === "downloading" ? (
            <p className="text-[10px] font-mono text-ink-ghost">
              {t("settings.update.speed", {
                speed: formatBytes(bytesPerSecond) + "/s",
                defaultValue: "速度：{{speed}}",
              })}
            </p>
          ) : null}
          {status?.status === "downloaded" && status.assetPath ? (
            <p className="text-[10px] font-mono text-ink-ghost break-all">{status.assetPath}</p>
          ) : null}
        </div>
      ) : null}

      {status?.status === "installing" || status?.status === "installScheduled" ? (
        <div className="space-y-1.5 rounded-xl bg-cloud/55 px-2.5 py-2">
          <p className="text-[10px] font-mono text-ink-ghost">
            {status.status === "installing"
              ? t("settings.update.installPreparing", {
                  defaultValue: "正在准备退出应用并安装更新...",
                })
              : t("settings.update.installScheduled", {
                  defaultValue: "检测到旧版待安装状态，请重新点击“安装并重启”完成替换",
                })}
          </p>
          {status.installLogPath ? (
            <p className="text-[10px] font-mono text-ink-ghost break-all">
              {status.installLogPath}
            </p>
          ) : null}
        </div>
      ) : null}

      {status?.status === "failed" && status.installLogPath ? (
        <div className="space-y-1.5 rounded-xl bg-paper-warm/40 px-2.5 py-2">
          <p className="text-[10px] font-mono text-ink-ghost">
            {t("settings.update.installFailed", {
              defaultValue: "最近一次安装失败，可查看日志后重试或重新下载",
            })}
          </p>
          <p className="text-[10px] font-mono text-ink-ghost break-all">{status.installLogPath}</p>
        </div>
      ) : null}

      <div className="flex gap-2">
        {canDownload ? (
          <button
            type="button"
            onClick={onDownload}
            className="h-8 px-3 rounded-lg bg-bamboo text-[11px] text-paper hover:bg-bamboo-light transition-colors cursor-pointer"
          >
            {t("settings.update.download", { defaultValue: "下载更新" })}
          </button>
        ) : null}
        {canCancel ? (
          <button
            type="button"
            onClick={onCancel}
            className="h-8 px-3 rounded-lg border border-paper-deep/45 text-[11px] text-ink-faint hover:text-red-400 hover:bg-danger-bg transition-colors cursor-pointer"
          >
            {t("settings.update.cancel", { defaultValue: "取消下载" })}
          </button>
        ) : null}
        {canInstall ? (
          <button
            type="button"
            disabled={installBusy || isInstalling}
            onClick={onInstall}
            className="h-8 px-3 rounded-lg border border-paper-deep/45 text-[11px] text-ink-faint hover:text-bamboo hover:bg-bamboo-mist/50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
          >
            {status?.status === "failed"
              ? t("settings.update.installRetry", {
                  defaultValue: "重新尝试安装",
                })
              : t("settings.update.install", { defaultValue: "安装并重启" })}
          </button>
        ) : null}
      </div>
    </div>
  );
}

interface UpdateToggleRowProps {
  label: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}

function UpdateToggleRow({ label, checked, disabled = false, onChange }: UpdateToggleRowProps) {
  return (
    <label
      className={`flex items-center justify-between h-9 rounded-lg px-2.5 bg-paper-warm/45 border border-paper-deep/25 ${
        disabled ? "opacity-60 cursor-not-allowed" : "cursor-pointer"
      }`}
    >
      <span className="text-[12px] text-ink-soft">{label}</span>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        className="sr-only"
      />
      <div
        className={`relative w-8 h-[18px] rounded-full transition-colors duration-250 ease-[cubic-bezier(0.22,1,0.36,1)] ${
          checked ? "bg-bamboo" : "bg-paper-deep/50"
        }`}
      >
        <div
          className={`absolute top-[2px] left-[2px] w-[14px] h-[14px] rounded-full bg-white shadow-[0_1px_2px_rgba(0,0,0,0.15)] transition-transform duration-250 ease-[cubic-bezier(0.22,1,0.36,1)] ${
            checked ? "translate-x-[14px]" : "translate-x-0"
          }`}
        />
      </div>
    </label>
  );
}

function getSourceLabel(
  source: DownloadSourceUsed | null | undefined,
  t: ReturnType<typeof useTranslation>["t"],
) {
  if (source === "github") {
    return t("settings.update.source.github", { defaultValue: "GitHub" });
  }
  return null;
}

export function deriveDownloadProgressState(
  current: UpdateState | null,
  progress: UpdateDownloadProgress,
  fallbackChannel: UpdateChannel,
): UpdateState {
  if (current) {
    return {
      ...current,
      status: "downloading",
      latestVersion: progress.version,
      assetName: progress.assetName,
      assetSize: progress.totalBytes ?? current.assetSize ?? null,
      source: progress.source,
      assetPath: null,
      downloadedAt: null,
      lastError: null,
    };
  }

  return {
    status: "downloading",
    currentVersion: "--",
    latestVersion: progress.version,
    channel: fallbackChannel,
    assetName: progress.assetName,
    assetPath: null,
    assetSha256: null,
    assetSize: progress.totalBytes ?? null,
    source: progress.source,
    checkedAt: null,
    downloadedAt: null,
    lastError: null,
  };
}

function formatBytes(value: number | null | undefined) {
  if (value == null) return "--";
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function getInstallSuccessMessage(
  result: UpdateInstallResult,
  t: ReturnType<typeof useTranslation>["t"],
): string {
  const tr = t as (key: string, options?: Record<string, unknown>) => string;
  if (result.mode === "test") {
    return tr("settings.update.installValidatedTest", {
      defaultValue: "安装 helper 已完成 test 模式校验",
    });
  }

  return tr("settings.update.installValidated", {
    defaultValue: "即将退出应用并安装更新，完成后会自动重新打开",
  });
}
