import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { showToast } from "../../../components/Toast";
import { getErrorMessage } from "../../notes/api";
import type { CourseParseResult } from "../courseImport";
import { FREE_TEXT_TEMPLATE, parseFreeTextCourses } from "../freeTextCourses";
import { importCourseFile, pickCourseFile } from "../api";
import type { CourseFileImport, CourseInput } from "../types";

interface CourseImportDialogProps {
  onClose: () => void;
  onImport: (rows: CourseInput[]) => Promise<void>;
}

type ImportTab = "file" | "text";

export function CourseImportDialog({ onClose, onImport }: CourseImportDialogProps) {
  const { t } = useTranslation();
  const [tab, setTab] = useState<ImportTab>("file");
  const [freeText, setFreeText] = useState("");
  const [parsing, setParsing] = useState(false);
  const [fileName, setFileName] = useState("");
  const [fileResult, setFileResult] = useState<CourseFileImport | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);

  const parsed = useMemo<CourseParseResult | null>(() => {
    if (tab === "file") {
      return fileResult ? { rows: fileResult.courses, errors: [] } : null;
    }
    return freeText.trim() ? parseFreeTextCourses(freeText) : null;
  }, [tab, freeText, fileResult]);

  const handlePickFile = async () => {
    if (parsing) return;
    try {
      const path = await pickCourseFile();
      if (!path) return;
      setParsing(true);
      setFileError(null);
      setFileResult(null);
      setFileName(path.split(/[\\/]/).pop() ?? path);
      const result = await importCourseFile(path);
      setFileResult(result);
      if (result.courses.length === 0) {
        setFileError(
          t("agenda.import.fileEmpty", {
            defaultValue: "文件里没有识别到课程，请确认是教务系统导出的课表文件。",
          }),
        );
      }
    } catch (cause) {
      setFileResult(null);
      setFileName("");
      setFileError(getErrorMessage(cause));
    } finally {
      setParsing(false);
    }
  };

  const handleImport = async () => {
    if (!parsed || parsed.rows.length === 0 || importing) return;
    setImporting(true);
    try {
      await onImport(parsed.rows);
      onClose();
    } catch (cause) {
      showToast(getErrorMessage(cause));
    } finally {
      setImporting(false);
    }
  };

  const tabs = [
    { value: "file" as ImportTab, label: t("agenda.import.fileTab", { defaultValue: "课表文件" }) },
    { value: "text" as ImportTab, label: t("agenda.import.textTab", { defaultValue: "文字粘贴" }) },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-ink/20 backdrop-blur-[1px]"
      onMouseDown={onClose}
    >
      <div
        className="w-[640px] max-w-full max-h-[82vh] flex flex-col bg-cloud rounded-xl border border-paper-deep/50 shadow-2xl overflow-hidden"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="h-11 px-4 flex items-center justify-between border-b border-paper-deep/30 shrink-0">
          <div className="flex items-center gap-1">
            {tabs.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setTab(option.value)}
                className={`px-3 h-7 rounded-md text-[11px] font-body transition-colors cursor-pointer ${
                  tab === option.value
                    ? "bg-bamboo text-cloud"
                    : "text-ink-ghost hover:text-ink-soft hover:bg-paper-warm"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("common.close", { defaultValue: "关闭" })}
            className="w-6 h-6 flex items-center justify-center rounded text-ink-ghost hover:text-ink-soft hover:bg-paper-warm cursor-pointer"
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 min-h-0 space-y-3">
          {tab === "file" ? (
            <>
              <p className="text-[10.5px] font-body text-ink-faint leading-relaxed">
                {t("agenda.import.fileHint", {
                  defaultValue:
                    "直接选择教务系统导出的 .xls / .xlsx 课表文件，自动识别「星期 × 节次」表格并提取课程名、周次、地点、教师，不需要复制粘贴。",
                })}
              </p>

              <button
                type="button"
                onClick={() => void handlePickFile()}
                disabled={parsing}
                className="w-full h-24 rounded-xl border border-dashed border-paper-deep/60 bg-paper-warm/20 flex flex-col items-center justify-center gap-1 text-ink-ghost hover:text-bamboo hover:border-bamboo/40 hover:bg-bamboo-mist/20 transition-colors cursor-pointer disabled:opacity-50"
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <path d="M8 13h8M8 17h5" />
                </svg>
                <span className="text-[11px] font-body">
                  {parsing
                    ? t("agenda.import.parsingFile", { defaultValue: "正在读取课表…" })
                    : t("agenda.import.pickFile", { defaultValue: "选择课表文件" })}
                </span>
                <span className="text-[9px] font-body text-ink-ghost/60">
                  {t("agenda.import.fileFormats", { defaultValue: "支持 .xls / .xlsx / .csv，最大 10 MB" })}
                </span>
              </button>

              {fileName ? (
                <div className="flex items-center gap-2 rounded-lg border border-paper-deep/40 bg-paper/40 px-3 py-2">
                  <span className="text-[10px] font-body text-ink-soft truncate flex-1">{fileName}</span>
                  {fileResult ? (
                    <span className="text-[9px] font-body text-bamboo shrink-0">
                      {t("agenda.import.fileReady", {
                        count: fileResult.courses.length,
                        defaultValue: "识别到 {{count}} 门课程",
                      })}
                    </span>
                  ) : null}
                </div>
              ) : null}

              {fileResult && fileResult.warnings.length > 0 ? (
                <div className="rounded-lg bg-amber-100/50 border border-amber-200/50 px-3 py-2">
                  <div className="text-[10px] font-body text-amber-700">
                    {t("agenda.import.fileWarnings", {
                      count: fileResult.warnings.length,
                      defaultValue: "{{count}} 个单元格无法解析，可导入后手工补录",
                    })}
                  </div>
                  <div className="mt-1 text-[9px] font-body text-amber-700/80 line-clamp-2">
                    {fileResult.warnings.slice(0, 3).join(" · ")}
                  </div>
                </div>
              ) : null}

              {fileError ? (
                <div className="rounded-lg bg-danger-bg/60 border border-red-200/40 px-3 py-2 text-[10px] font-body text-red-400">
                  {fileError}
                </div>
              ) : null}
            </>
          ) : (
            <>
              <p className="text-[10.5px] font-body text-ink-faint leading-relaxed">
                {t("agenda.import.textHint", {
                  defaultValue:
                    "粘贴任意格式的课表文字，每行一门课，字段顺序不限。支持「周一 / 星期三 / Mon」「1-2节 / 第5节」「1-16周 / 单周」「@教室」「张老师」。",
                })}
              </p>
              <textarea
                value={freeText}
                onChange={(event) => setFreeText(event.target.value)}
                rows={7}
                spellCheck={false}
                placeholder={FREE_TEXT_TEMPLATE}
                className="w-full px-3 py-2 rounded-lg border border-paper-deep bg-paper-warm/80 text-[11px] font-mono text-ink-soft placeholder:text-ink-ghost/40 focus:border-bamboo/40 outline-none resize-none leading-relaxed"
              />
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setFreeText(FREE_TEXT_TEMPLATE)}
                  className="h-6 px-2 rounded text-[10px] font-body text-ink-faint hover:text-bamboo hover:bg-bamboo-mist/50 transition-colors cursor-pointer"
                >
                  {t("agenda.import.insertSample", { defaultValue: "插入示例" })}
                </button>
                <button
                  type="button"
                  onClick={() => setFreeText("")}
                  className="h-6 px-2 rounded text-[10px] font-body text-ink-faint hover:text-red-400 hover:bg-danger-bg transition-colors cursor-pointer"
                >
                  {t("common.clear", { defaultValue: "清空" })}
                </button>
              </div>
            </>
          )}

          {parsed && parsed.errors.length > 0 ? (
            <div className="rounded-lg bg-danger-bg/60 border border-red-200/40 px-3 py-2 space-y-0.5">
              {parsed.errors.slice(0, 5).map((error) => (
                <div key={`${error.line}-${error.message}`} className="text-[10px] font-body text-red-400">
                  第 {error.line} 行：{error.message}
                </div>
              ))}
              {parsed.errors.length > 5 ? (
                <div className="text-[10px] font-body text-red-400">
                  还有 {parsed.errors.length - 5} 条错误…
                </div>
              ) : null}
            </div>
          ) : null}

          {parsed && parsed.rows.length > 0 ? (
            <div className="rounded-lg border border-paper-deep/40 overflow-hidden">
              <div className="px-3 py-1.5 bg-paper-warm/50 text-[10px] font-body text-ink-faint">
                {t("agenda.import.preview", {
                  count: parsed.rows.length,
                  defaultValue: "将导入 {{count}} 门课程",
                })}
                {fileResult && tab === "file" ? (
                  <span className="ml-1.5 text-ink-ghost">
                    {t("agenda.import.fileSheet", {
                      sheet: fileResult.sheet,
                      defaultValue: "（工作表：{{sheet}}）",
                    })}
                  </span>
                ) : null}
              </div>
              <div className="max-h-[200px] overflow-y-auto">
                <table className="w-full text-[10px] font-body">
                  <thead className="text-ink-ghost">
                    <tr className="border-b border-paper-deep/30">
                      <th className="text-left px-2 py-1 font-normal">课程</th>
                      <th className="text-left px-2 py-1 font-normal">星期</th>
                      <th className="text-left px-2 py-1 font-normal">节次</th>
                      <th className="text-left px-2 py-1 font-normal">地点</th>
                      <th className="text-left px-2 py-1 font-normal">周次</th>
                    </tr>
                  </thead>
                  <tbody className="text-ink-soft">
                    {parsed.rows.slice(0, 20).map((row, index) => (
                      <tr key={`${row.name}-${index}`} className="border-b border-paper-deep/15 last:border-0">
                        <td className="px-2 py-1 truncate max-w-[170px]">{row.name}</td>
                        <td className="px-2 py-1">
                          {t(`agenda.weekday.${row.weekday}`, {
                            defaultValue: `周${"一二三四五六日"[row.weekday - 1]}`,
                          })}
                        </td>
                        <td className="px-2 py-1 font-mono">
                          {row.startPeriod}
                          {row.endPeriod > row.startPeriod ? `-${row.endPeriod}` : ""}
                        </td>
                        <td className="px-2 py-1 truncate max-w-[100px]">{row.location || "—"}</td>
                        <td className="px-2 py-1 truncate max-w-[100px] text-ink-ghost">{row.weeks || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
        </div>

        <div className="px-4 py-2.5 border-t border-paper-deep/30 flex items-center justify-between shrink-0">
          <span className="text-[10px] font-body text-ink-ghost">
            {parsed && parsed.errors.length > 0
              ? t("agenda.import.errorCount", {
                  count: parsed.errors.length,
                  defaultValue: "{{count}} 条无法解析",
                })
              : ""}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 h-7 rounded-lg text-[11px] font-body text-ink-faint hover:bg-paper-warm transition-colors cursor-pointer"
            >
              {t("common.cancel", { defaultValue: "取消" })}
            </button>
            {parsed && parsed.rows.length > 0 ? (
              <button
                type="button"
                disabled={importing}
                onClick={() => void handleImport()}
                className="px-4 h-7 rounded-lg bg-bamboo text-cloud text-[11px] font-body hover:bg-bamboo-light disabled:opacity-40 transition-colors cursor-pointer"
              >
                {importing
                  ? t("common.saving", { defaultValue: "保存中…" })
                  : t("agenda.import.confirm", {
                      count: parsed.rows.length,
                      defaultValue: "导入 {{count}} 门",
                    })}
              </button>
            ) : (
              <button
                type="button"
                onClick={onClose}
                className="px-4 h-7 rounded-lg bg-bamboo text-cloud text-[11px] font-body hover:bg-bamboo-light transition-colors cursor-pointer"
              >
                {t("common.done", { defaultValue: "完成" })}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
