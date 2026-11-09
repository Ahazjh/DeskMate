import { useState } from "react";
import { useTranslation } from "react-i18next";
import { showToast } from "../../../components/Toast";
import { getErrorMessage } from "../../notes/api";
import { EVENT_COLORS } from "../eventUtils";
import { importCourseFile, pickCourseFile } from "../api";
import { PartnerIcon } from "./PartnerIcon";
import type { Course, CourseInput, PartnerProfile, PartnerRelation } from "../types";

interface PartnerDialogProps {
  profile: PartnerProfile;
  courses: Course[];
  visible: boolean;
  onToggleVisible: () => void;
  onClearCourses: () => Promise<void>;
  onClose: () => void;
  onSaveProfile: (profile: PartnerProfile) => Promise<unknown>;
  onImport: (rows: CourseInput[]) => Promise<unknown>;
  onDeleteCourse: (id: string) => Promise<void>;
}

const RELATIONS: PartnerRelation[] = ["partner", "sibling", "classmate", "friend", "other"];

export function PartnerDialog({
  profile,
  courses,
  visible,
  onToggleVisible,
  onClearCourses,
  onClose,
  onSaveProfile,
  onImport,
  onDeleteCourse,
}: PartnerDialogProps) {
  const { t } = useTranslation();
  const [name, setName] = useState(profile.name);
  const [relation, setRelation] = useState<PartnerRelation>(profile.relation);
  const [color, setColor] = useState(profile.color ?? EVENT_COLORS[4]);
  const [saving, setSaving] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [fileName, setFileName] = useState("");
  const [pendingRows, setPendingRows] = useState<CourseInput[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const relationLabel = (value: PartnerRelation) =>
    t(`agenda.partner.relations.${value}`, {
      defaultValue: {
        partner: "伴侣",
        sibling: "兄弟姐妹",
        classmate: "同学",
        friend: "朋友",
        other: "其他",
      }[value],
    });

  const saveProfile = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await onSaveProfile({ name: name.trim(), relation, color });
      showToast(t("agenda.toast.saved", { defaultValue: "已保存" }), "success");
    } catch (cause) {
      showToast(getErrorMessage(cause));
    } finally {
      setSaving(false);
    }
  };

  const pickFile = async () => {
    if (parsing) return;
    try {
      const path = await pickCourseFile();
      if (!path) return;
      setParsing(true);
      setError(null);
      setPendingRows(null);
      setFileName(path.split(/[\\/]/).pop() ?? path);
      const result = await importCourseFile(path);
      if (result.courses.length === 0) {
        setError(
          t("agenda.import.fileEmpty", {
            defaultValue: "文件里没有识别到课程，请确认是教务系统导出的课表文件。",
          }),
        );
        return;
      }
      setPendingRows(result.courses);
    } catch (cause) {
      setError(getErrorMessage(cause));
    } finally {
      setParsing(false);
    }
  };

  const confirmImport = async () => {
    if (!pendingRows || importing) return;
    setImporting(true);
    try {
      await onImport(pendingRows);
      showToast(
        t("agenda.partner.imported", {
          count: pendingRows.length,
          defaultValue: "已导入 {{count}} 门对方课程",
        }),
        "info",
      );
      setPendingRows(null);
      setFileName("");
    } catch (cause) {
      showToast(getErrorMessage(cause));
    } finally {
      setImporting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center p-6 bg-ink/20 backdrop-blur-[1px]"
      onMouseDown={onClose}
    >
      <div
        className="w-[520px] max-w-full max-h-[86vh] flex flex-col bg-cloud rounded-xl border border-paper-deep/50 shadow-2xl overflow-hidden"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="h-11 px-4 flex items-center justify-between border-b border-paper-deep/30 shrink-0">
          <span className="text-[12px] font-body font-medium text-ink-soft">
            {t("agenda.partner.title", { defaultValue: "双人课表" })}
          </span>
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

        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
          <p className="text-[9.5px] font-body text-ink-ghost leading-relaxed">
            {t("agenda.partner.hint", {
              defaultValue:
                "添加第二个人的课表后，课程表会上下并排显示两人的课程，并高亮都没有课的共同空档；对方课程只读，不参与提醒。",
            })}
          </p>

          <div className="space-y-2">
            <label className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-body text-ink-faint">
                {t("agenda.partner.name", { defaultValue: "对方昵称" })}
              </span>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                maxLength={20}
                placeholder={t("agenda.partner.namePlaceholder", { defaultValue: "如：小夏" })}
                className="h-7 w-[220px] px-2 rounded-lg border border-paper-deep bg-paper-warm/80 text-[10.5px] font-body text-ink-soft outline-none focus:border-bamboo/40"
              />
            </label>

            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-body text-ink-faint">
                {t("agenda.partner.relation", { defaultValue: "关系" })}
              </span>
              <div className="flex items-center gap-1">
                {RELATIONS.map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setRelation(value)}
                    className={`h-6 pl-1.5 pr-2 rounded-md text-[9.5px] font-body transition-colors cursor-pointer ${
                      relation === value
                        ? "bg-bamboo text-cloud"
                        : "text-ink-faint hover:text-ink-soft hover:bg-paper-warm"
                    }`}
                  >
                    <span className="flex items-center gap-1">
                      <PartnerIcon relation={value} size={9} />
                      {relationLabel(value)}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-body text-ink-faint">
                {t("agenda.partner.color", { defaultValue: "颜色" })}
              </span>
              <div className="flex items-center gap-1">
                {EVENT_COLORS.slice(0, 8).map((value) => (
                  <button
                    key={value}
                    type="button"
                    aria-label={value}
                    onClick={() => setColor(value)}
                    className={`w-4 h-4 rounded-full border transition-transform cursor-pointer ${
                      color === value ? "border-ink-soft scale-110" : "border-transparent"
                    }`}
                    style={{ backgroundColor: value }}
                  />
                ))}
              </div>
            </div>

            <button
              type="button"
              disabled={saving}
              onClick={() => void saveProfile()}
              className="w-full h-7 rounded-lg border border-bamboo/40 text-bamboo text-[10.5px] font-body hover:bg-bamboo-mist/40 disabled:opacity-50 cursor-pointer"
            >
              {saving
                ? t("common.saving", { defaultValue: "保存中…" })
                : t("agenda.partner.saveProfile", { defaultValue: "保存资料" })}
            </button>
          </div>

          <div className="border-t border-paper-deep/20 pt-3 space-y-2">
            <div className="flex items-center justify-between gap-1">
              <span className="text-[10px] font-body text-ink-soft">
                {t("agenda.partner.courses", { defaultValue: "对方课程" })}
                <span className="ml-1.5 font-mono text-ink-ghost">{courses.length}</span>
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={onToggleVisible}
                  className={`h-6 px-2 rounded-md border text-[9.5px] font-body transition-colors cursor-pointer ${
                    visible
                      ? "border-bamboo/40 bg-bamboo-mist/40 text-bamboo"
                      : "border-paper-deep/50 text-ink-ghost hover:text-ink-soft"
                  }`}
                >
                  {visible
                    ? t("agenda.partner.visible", { defaultValue: "在课表中显示" })
                    : t("agenda.partner.hidden", { defaultValue: "已隐藏" })}
                </button>
                <button
                  type="button"
                  disabled={parsing}
                  onClick={() => void pickFile()}
                  className="h-6 px-2 rounded-md border border-paper-deep/50 text-[9.5px] font-body text-ink-faint hover:text-bamboo hover:border-bamboo/40 cursor-pointer disabled:opacity-50"
                >
                  {parsing
                    ? t("agenda.import.parsingFile", { defaultValue: "正在读取课表…" })
                    : t("agenda.partner.importFile", { defaultValue: "导入对方课表" })}
                </button>
                {courses.length > 0 ? (
                  <button
                    type="button"
                    onClick={() => void onClearCourses()}
                    className="h-6 px-2 rounded-md border border-paper-deep/50 text-[9.5px] font-body text-ink-ghost hover:text-red-400 hover:border-red-300/60 hover:bg-danger-bg cursor-pointer"
                  >
                    {t("agenda.partner.clear", { defaultValue: "清空" })}
                  </button>
                ) : null}
              </div>
            </div>

            {fileName ? (
              <div className="rounded-lg border border-paper-deep/40 bg-paper/40 px-2.5 py-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-[9.5px] font-body text-ink-soft truncate flex-1">{fileName}</span>
                  {pendingRows ? (
                    <button
                      type="button"
                      disabled={importing}
                      onClick={() => void confirmImport()}
                      className="shrink-0 h-6 px-2 rounded-md bg-bamboo text-cloud text-[9.5px] font-body hover:bg-bamboo-light disabled:opacity-50 cursor-pointer"
                    >
                      {t("agenda.partner.importReady", {
                        count: pendingRows.length,
                        defaultValue: "导入 {{count}} 门",
                      })}
                    </button>
                  ) : null}
                </div>
              </div>
            ) : null}

            {error ? (
              <div className="rounded-lg bg-danger-bg/60 border border-red-200/40 px-2.5 py-1.5 text-[9.5px] font-body text-red-400">
                {error}
              </div>
            ) : null}

            {courses.length === 0 ? (
              <div className="py-4 text-center text-[10px] font-body text-ink-ghost">
                {t("agenda.partner.empty", {
                  defaultValue: "还没有对方课表，可导入文件或稍后手动添加。",
                })}
              </div>
            ) : (
              <div className="max-h-[220px] overflow-y-auto space-y-1">
                {courses.map((course) => (
                  <div
                    key={course.id}
                    className="flex items-center gap-2 px-2 py-1 rounded-lg border border-paper-deep/30 bg-paper/30"
                  >
                    <span className="w-[50px] shrink-0 text-[9px] font-mono text-ink-ghost">
                      {t(`agenda.weekday.${course.weekday}`, {
                        defaultValue: `周${"一二三四五六日"[course.weekday - 1]}`,
                      })}
                    </span>
                    <PartnerIcon relation={profile.relation} size={9} color={profile.color ?? "#D4537E"} />
                    <span className="text-[9.5px] font-body text-ink-soft truncate flex-1">
                      {course.name}
                    </span>
                    <span className="shrink-0 text-[9px] font-mono text-ink-ghost">
                      {course.startPeriod}
                      {course.endPeriod > course.startPeriod ? `-${course.endPeriod}` : ""}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        void onDeleteCourse(course.id).catch((cause) =>
                          showToast(getErrorMessage(cause)),
                        )
                      }
                      className="shrink-0 text-[9px] font-body text-ink-ghost hover:text-red-400 cursor-pointer"
                    >
                      {t("common.delete", { defaultValue: "删除" })}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
