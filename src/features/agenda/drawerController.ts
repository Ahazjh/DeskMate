import { useCallback, useRef, useState } from "react";
import type { AgendaEvent, Course, DailyTask, Todo } from "./types";

export type DrawerKind = "todo" | "event" | "course" | "daily";

export type DrawerTarget =
  | { kind: "todo"; todo: Todo | null }
  | { kind: "event"; event: AgendaEvent | null; day: string; minutes?: number }
  | { kind: "course"; course: Course | null; weekday: number; period: number }
  | { kind: "daily"; task: DailyTask | null };

/**
 * 抽屉互斥控制器：同一时刻只允许一个抽屉打开。
 *
 * - 打开新抽屉前先关闭旧抽屉；
 * - 旧抽屉有未保存输入时，由 onConfirmSave 询问用户「保存 / 丢弃」；
 * - 同类型抽屉（例如课程表里点另一门课）同样走这条路径，
 *   因此点谁就覆盖谁，不需要手动先关掉。
 */
export interface DrawerController {
  /** 当前打开的抽屉（null 表示都没开） */
  active: DrawerTarget | null;
  /** 打开某个抽屉，自动互斥处理旧抽屉 */
  open: (target: DrawerTarget) => void;
  /** 关闭当前抽屉 */
  close: () => void;
  /** 抽屉内部调用：登记「当前有未保存的输入」 */
  setDirty: (kind: DrawerKind, dirty: boolean) => void;
  /** 抽屉内部调用：登记保存处理器，供互斥切换时调用 */
  registerSave: (kind: DrawerKind, save: (() => Promise<boolean>) | null) => void;
  /** 调用指定类型抽屉的保存处理器；返回是否保存成功 */
  runSave: (kind: DrawerKind) => Promise<boolean>;
}

export interface UseDrawerControllerOptions {
  /**
   * 旧抽屉有未保存内容时的处理。
   * 返回 true 表示已保存，可以继续打开新抽屉；false 表示用户选择丢弃。
   */
  onConfirmSave: (kind: DrawerKind) => Promise<boolean>;
}

const ALL_KINDS: DrawerKind[] = ["todo", "event", "course", "daily"];

export function useDrawerController(options: UseDrawerControllerOptions): DrawerController {
  const [active, setActive] = useState<DrawerTarget | null>(null);
  const activeRef = useRef<DrawerTarget | null>(null);
  const dirtyRef = useRef<Record<DrawerKind, boolean>>({
    todo: false,
    event: false,
    course: false,
    daily: false,
  });
  const saveRef = useRef<Partial<Record<DrawerKind, () => Promise<boolean>>>>({});
  // 递增序号：保证只有最后一次 open 生效，避免快速连点导致抽屉错乱
  const seqRef = useRef(0);

  activeRef.current = active;

  const setDirty = useCallback((kind: DrawerKind, dirty: boolean) => {
    dirtyRef.current[kind] = dirty;
  }, []);

  const registerSave = useCallback(
    (kind: DrawerKind, save: (() => Promise<boolean>) | null) => {
      if (save) {
        saveRef.current[kind] = save;
      } else {
        delete saveRef.current[kind];
      }
    },
    [],
  );

  const runSave = useCallback(async (kind: DrawerKind) => {
    const save = saveRef.current[kind];
    if (!save) return true;
    return await save();
  }, []);

  const close = useCallback(() => {
    seqRef.current += 1;
    for (const kind of ALL_KINDS) {
      dirtyRef.current[kind] = false;
    }
    setActive(null);
  }, []);

  const confirmSaveRef = useRef(options.onConfirmSave);
  confirmSaveRef.current = options.onConfirmSave;

  const open = useCallback((target: DrawerTarget) => {
    const seq = ++seqRef.current;
    const current = activeRef.current;

    const proceed = async () => {
      if (current) {
        const kind = current.kind;
        if (dirtyRef.current[kind]) {
          const saved = await confirmSaveRef.current(kind);
          if (seq !== seqRef.current) return;
          if (!saved) {
            // 用户选择丢弃：清掉脏标记，继续打开新抽屉
            dirtyRef.current[kind] = false;
          }
        }
      }
      if (seq !== seqRef.current) return;
      setActive(target);
    };

    void proceed();
  }, []);

  return { active, open, close, setDirty, registerSave, runSave };
}
