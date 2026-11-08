import { describe, expect, test } from "vitest";
import type { AgendaEvent } from "./types";
import { combineDateTime } from "./dateUtils";
import { eventDaySpan, eventOccursOn, layoutDayEvents } from "./eventUtils";

const base = {
  notes: "",
  color: null,
  createdAt: "2026-11-01T00:00:00.000Z",
  updatedAt: "2026-11-01T00:00:00.000Z",
};

function event(overrides: Partial<AgendaEvent> & Pick<AgendaEvent, "id" | "title">): AgendaEvent {
  return {
    allDay: false,
    startAt: combineDateTime("2026-11-06", "09:00"),
    endAt: combineDateTime("2026-11-06", "10:00"),
    startDate: null,
    endDate: null,
    ...base,
    ...overrides,
  };
}

describe("agenda event utils", () => {
  test("matches a single all-day event only on its own day", () => {
    const allDay = event({
      id: "a",
      title: "出差",
      allDay: true,
      startAt: combineDateTime("2026-11-07", "00:00"),
      endAt: combineDateTime("2026-11-08", "00:00"),
      startDate: "2026-11-07",
      endDate: "2026-11-07",
    });

    expect(eventOccursOn(allDay, "2026-11-07")).toBe(true);
    expect(eventOccursOn(allDay, "2026-11-08")).toBe(false);
  });

  test("matches every day covered by a multi-day all-day event", () => {
    const allDay = event({
      id: "b",
      title: "休假",
      allDay: true,
      startAt: combineDateTime("2026-11-07", "00:00"),
      endAt: combineDateTime("2026-11-10", "00:00"),
      startDate: "2026-11-07",
      endDate: "2026-11-09",
    });

    expect(eventOccursOn(allDay, "2026-11-06")).toBe(false);
    expect(eventOccursOn(allDay, "2026-11-07")).toBe(true);
    expect(eventOccursOn(allDay, "2026-11-08")).toBe(true);
    expect(eventOccursOn(allDay, "2026-11-09")).toBe(true);
    expect(eventOccursOn(allDay, "2026-11-10")).toBe(false);
    expect(eventDaySpan(allDay)).toEqual(["2026-11-07", "2026-11-08", "2026-11-09"]);
  });

  test("matches a timed event on both sides of midnight", () => {
    const overnight = event({
      id: "c",
      title: "上线值守",
      startAt: combineDateTime("2026-11-06", "23:00"),
      endAt: combineDateTime("2026-11-07", "01:00"),
    });

    expect(eventOccursOn(overnight, "2026-11-06")).toBe(true);
    expect(eventOccursOn(overnight, "2026-11-07")).toBe(true);
    expect(eventOccursOn(overnight, "2026-11-08")).toBe(false);
  });

  test("places overlapping events in separate lanes", () => {
    const events = [
      event({
        id: "d",
        title: "A",
        startAt: combineDateTime("2026-11-06", "09:00"),
        endAt: combineDateTime("2026-11-06", "10:00"),
      }),
      event({
        id: "e",
        title: "B",
        startAt: combineDateTime("2026-11-06", "09:30"),
        endAt: combineDateTime("2026-11-06", "10:30"),
      }),
      event({
        id: "f",
        title: "C",
        startAt: combineDateTime("2026-11-06", "11:00"),
        endAt: combineDateTime("2026-11-06", "12:00"),
      }),
    ];

    const layout = layoutDayEvents(events, "2026-11-06");
    expect(layout).toHaveLength(3);
    expect(layout[0]).toMatchObject({ lane: 0, lanes: 2 });
    expect(layout[1]).toMatchObject({ lane: 1, lanes: 2 });
    expect(layout[2]).toMatchObject({ lane: 0, lanes: 2 });
    expect(layout[0].top).toBeCloseTo((9 / 24) * 100, 1);
    expect(layout[0].height).toBeCloseTo((1 / 24) * 100, 1);
  });
});
