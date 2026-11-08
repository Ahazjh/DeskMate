import { useCallback, useEffect, useRef, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { getErrorMessage } from "../notes/api";
import {
  agendaSnapshot,
  clearCourses,
  clearPartnerCourses,
  createCourse,
  createCourseOverride,
  createDailyTask,
  createEvent,
  deletePartnerCourse,
  createTodo,
  deleteCourse,
  deleteCourseOverride,
  deleteDailyTask,
  deleteEvent,
  deleteTodo,
  importCourses,
  importPartnerCourses,
  reorderTodos,
  savePartnerProfile,
  saveTimetableSettings,
  toggleDailyTask,
  toggleTodo,
  updateCourse,
  updateDailyTask,
  updateEvent,
  updateTodo,
} from "./api";
import type {
  AgendaEvent,
  AgendaSnapshot,
  Course,
  CourseInput,
  CourseOverrideInput,
  DailyTask,
  PartnerProfile,
  DailyTaskInput,
  EventInput,
  TimetableSettings,
  Todo,
  TodoInput,
} from "./types";
import { defaultTimetableSettings } from "./timetable";

const EMPTY_SNAPSHOT: AgendaSnapshot = {
  todos: [],
  events: [],
  courses: [],
  dailyTasks: [],
  dailyChecks: {},
  courseOverrides: [],
  partnerProfile: { name: "", relation: "partner", color: null },
  partnerCourses: [],
  timetableSettings: defaultTimetableSettings(),
};

export function useAgenda() {
  const [snapshot, setSnapshot] = useState<AgendaSnapshot>(EMPTY_SNAPSHOT);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const epoch = useRef(0);

  const reload = useCallback(async () => {
    const current = ++epoch.current;
    try {
      const next = await agendaSnapshot();
      if (current !== epoch.current) return;
      setSnapshot(next);
      setError(null);
    } catch (cause) {
      if (current !== epoch.current) return;
      setError(getErrorMessage(cause));
    } finally {
      if (current === epoch.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    const unlisten = listen("agenda-changed", () => {
      void reload();
    });
    return () => {
      void unlisten.then((fn) => fn());
    };
  }, [reload]);

  useEffect(() => {
    const unlisten = listen("config-changed", () => {
      void reload();
    });
    return () => {
      void unlisten.then((fn) => fn());
    };
  }, [reload]);

  const applyTodo = useCallback((todo: Todo) => {
    setSnapshot((previous) => {
      const exists = previous.todos.some((item) => item.id === todo.id);
      return {
        ...previous,
        todos: exists
          ? previous.todos.map((item) => (item.id === todo.id ? todo : item))
          : [...previous.todos, todo],
      };
    });
  }, []);

  const applyEvent = useCallback((event: AgendaEvent) => {
    setSnapshot((previous) => {
      const exists = previous.events.some((item) => item.id === event.id);
      return {
        ...previous,
        events: exists
          ? previous.events.map((item) => (item.id === event.id ? event : item))
          : [...previous.events, event],
      };
    });
  }, []);

  const applyCourse = useCallback((course: Course) => {
    setSnapshot((previous) => {
      const exists = previous.courses.some((item) => item.id === course.id);
      return {
        ...previous,
        courses: exists
          ? previous.courses.map((item) => (item.id === course.id ? course : item))
          : [...previous.courses, course],
      };
    });
  }, []);

  const applyDailyTask = useCallback((task: DailyTask) => {
    setSnapshot((previous) => {
      const exists = previous.dailyTasks.some((item) => item.id === task.id);
      return {
        ...previous,
        dailyTasks: exists
          ? previous.dailyTasks.map((item) => (item.id === task.id ? task : item))
          : [...previous.dailyTasks, task],
      };
    });
  }, []);

  const addTodo = useCallback(
    async (input: TodoInput) => {
      const todo = await createTodo(input);
      applyTodo(todo);
      return todo;
    },
    [applyTodo],
  );

  const editTodo = useCallback(
    async (id: string, input: TodoInput) => {
      const todo = await updateTodo(id, input);
      applyTodo(todo);
      return todo;
    },
    [applyTodo],
  );

  const toggle = useCallback(async (todo: Todo) => {
    const nextDone = !todo.done;
    setSnapshot((previous) => ({
      ...previous,
      todos: previous.todos.map((item) =>
        item.id === todo.id
          ? {
              ...item,
              done: nextDone,
              completedAt: nextDone ? new Date().toISOString() : null,
            }
          : item,
      ),
    }));

    try {
      const saved = await toggleTodo(todo.id, nextDone);
      setSnapshot((previous) => ({
        ...previous,
        todos: previous.todos.map((item) => (item.id === saved.id ? saved : item)),
      }));
    } catch (cause) {
      setSnapshot((previous) => ({
        ...previous,
        todos: previous.todos.map((item) => (item.id === todo.id ? todo : item)),
      }));
      throw cause;
    }
  }, []);

  const removeTodo = useCallback(
    async (id: string) => {
      setSnapshot((previous) => ({
        ...previous,
        todos: previous.todos.filter((item) => item.id !== id),
      }));
      try {
        await deleteTodo(id);
      } catch (cause) {
        await reload();
        throw cause;
      }
    },
    [reload],
  );

  const reorder = useCallback(async (ids: string[]) => {
    setSnapshot((previous) => {
      const order = new Map(ids.map((id, index) => [id, index]));
      return {
        ...previous,
        todos: previous.todos.map((todo) =>
          order.has(todo.id)
            ? { ...todo, sortOrder: ((order.get(todo.id) ?? 0) + 1) * 1024 }
            : todo,
        ),
      };
    });
    await reorderTodos(ids);
  }, []);

  const addEvent = useCallback(
    async (input: EventInput) => {
      const event = await createEvent(input);
      applyEvent(event);
      return event;
    },
    [applyEvent],
  );

  const editEvent = useCallback(
    async (id: string, input: EventInput) => {
      const event = await updateEvent(id, input);
      applyEvent(event);
      return event;
    },
    [applyEvent],
  );

  const removeEvent = useCallback(
    async (id: string) => {
      setSnapshot((previous) => ({
        ...previous,
        events: previous.events.filter((item) => item.id !== id),
      }));
      try {
        await deleteEvent(id);
      } catch (cause) {
        await reload();
        throw cause;
      }
    },
    [reload],
  );

  const addCourse = useCallback(
    async (input: CourseInput) => {
      const course = await createCourse(input);
      applyCourse(course);
      return course;
    },
    [applyCourse],
  );

  const editCourse = useCallback(
    async (id: string, input: CourseInput) => {
      const course = await updateCourse(id, input);
      applyCourse(course);
      return course;
    },
    [applyCourse],
  );

  const removeCourse = useCallback(
    async (id: string) => {
      setSnapshot((previous) => ({
        ...previous,
        courses: previous.courses.filter((item) => item.id !== id),
      }));
      try {
        await deleteCourse(id);
      } catch (cause) {
        await reload();
        throw cause;
      }
    },
    [reload],
  );

  const importCourseRows = useCallback(async (rows: CourseInput[]) => {
    const created = await importCourses(rows);
    setSnapshot((previous) => ({
      ...previous,
      courses: [
        ...previous.courses,
        ...created.filter((course) => !previous.courses.some((item) => item.id === course.id)),
      ],
    }));
    return created;
  }, []);

  const addCourseOverride = useCallback(
    async (input: CourseOverrideInput) => {
      const entry = await createCourseOverride(input);
      setSnapshot((previous) => ({
        ...previous,
        courseOverrides: [
          ...previous.courseOverrides.filter((item) => item.id !== entry.id),
          entry,
        ],
      }));
      return entry;
    },
    [],
  );

  const removeCourseOverride = useCallback(
    async (id: string) => {
      setSnapshot((previous) => ({
        ...previous,
        courseOverrides: previous.courseOverrides.filter((item) => item.id !== id),
      }));
      try {
        await deleteCourseOverride(id);
      } catch (cause) {
        await reload();
        throw cause;
      }
    },
    [reload],
  );

  const clearAllCourses = useCallback(async () => {
    const removed = await clearCourses();
    setSnapshot((previous) => ({ ...previous, courses: [], courseOverrides: [] }));
    return removed;
  }, []);

  const clearPartnerCourseRows = useCallback(async () => {
    const removed = await clearPartnerCourses();
    setSnapshot((previous) => ({ ...previous, partnerCourses: [] }));
    return removed;
  }, []);

  const savePartner = useCallback(async (profile: PartnerProfile) => {
    const saved = await savePartnerProfile(profile);
    setSnapshot((previous) => ({ ...previous, partnerProfile: saved }));
    return saved;
  }, []);

  const importPartnerCourseRows = useCallback(async (rows: CourseInput[]) => {
    const created = await importPartnerCourses(rows);
    setSnapshot((previous) => ({
      ...previous,
      partnerCourses: [
        ...previous.partnerCourses,
        ...created.filter(
          (course) => !previous.partnerCourses.some((item) => item.id === course.id),
        ),
      ],
    }));
    return created;
  }, []);

  const removePartnerCourse = useCallback(
    async (id: string) => {
      setSnapshot((previous) => ({
        ...previous,
        partnerCourses: previous.partnerCourses.filter((course) => course.id !== id),
      }));
      try {
        await deletePartnerCourse(id);
      } catch (cause) {
        await reload();
        throw cause;
      }
    },
    [reload],
  );

  const addDailyTask = useCallback(
    async (input: DailyTaskInput) => {
      const task = await createDailyTask(input);
      applyDailyTask(task);
      return task;
    },
    [applyDailyTask],
  );

  const editDailyTask = useCallback(
    async (id: string, input: DailyTaskInput) => {
      const task = await updateDailyTask(id, input);
      applyDailyTask(task);
      return task;
    },
    [applyDailyTask],
  );

  const removeDailyTask = useCallback(
    async (id: string) => {
      setSnapshot((previous) => {
        const dailyChecks = Object.fromEntries(
          Object.entries(previous.dailyChecks)
            .map(([date, ids]) => [date, ids.filter((item) => item !== id)] as const)
            .filter(([, ids]) => ids.length > 0),
        );
        return {
          ...previous,
          dailyTasks: previous.dailyTasks.filter((item) => item.id !== id),
          dailyChecks,
        };
      });
      try {
        await deleteDailyTask(id);
      } catch (cause) {
        await reload();
        throw cause;
      }
    },
    [reload],
  );

  const toggleDaily = useCallback(
    async (task: DailyTask, date: string, done: boolean) => {
      setSnapshot((previous) => {
        const current = previous.dailyChecks[date] ?? [];
        const next = done
          ? [...new Set([...current, task.id])]
          : current.filter((id) => id !== task.id);
        const dailyChecks = { ...previous.dailyChecks };
        if (next.length > 0) dailyChecks[date] = next;
        else delete dailyChecks[date];
        return { ...previous, dailyChecks };
      });

      try {
        const ids = await toggleDailyTask(task.id, date, done);
        setSnapshot((previous) => {
          const dailyChecks = { ...previous.dailyChecks };
          if (ids.length > 0) dailyChecks[date] = ids;
          else delete dailyChecks[date];
          return { ...previous, dailyChecks };
        });
      } catch (cause) {
        await reload();
        throw cause;
      }
    },
    [reload],
  );

  const saveTimetable = useCallback(async (settings: TimetableSettings) => {
    const saved = await saveTimetableSettings(settings);
    setSnapshot((previous) => ({ ...previous, timetableSettings: saved }));
    return saved;
  }, []);

  return {
    snapshot,
    loading,
    error,
    reload,
    addTodo,
    editTodo,
    toggle,
    removeTodo,
    reorder,
    addEvent,
    editEvent,
    removeEvent,
    addCourse,
    editCourse,
    removeCourse,
    importCourseRows,
    addCourseOverride,
    removeCourseOverride,
    savePartner,
    clearAllCourses,
    clearPartnerCourseRows,
    importPartnerCourseRows,
    removePartnerCourse,
    addDailyTask,
    editDailyTask,
    removeDailyTask,
    toggleDaily,
    saveTimetable,
  };
}
