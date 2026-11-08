export type AppView = "main" | "notepad" | "tile" | "quicktodo" | "agendaWidget";

export type AgendaWidgetKind = "all" | "schedule" | "todos";

export interface AppRoute {
  view: AppView;
  noteId?: string;
  kind?: AgendaWidgetKind;
}

export function getInitialRoute(url: URL = new URL(window.location.href)): AppRoute {
  return routeFromSearch(url.search);
}

export function routeFromSearch(search: string): AppRoute {
  const params = new URLSearchParams(search);
  const view = params.get("view");
  const noteId = params.get("noteId") ?? undefined;

  if (view === "notepad") return noteId ? { view, noteId } : { view };
  if (view === "tile") return noteId ? { view, noteId } : { view };
  if (view === "quicktodo") return { view: "quicktodo" };
  if (view === "agendaWidget") {
    return {
      view,
      kind: params.get("kind") === "todos" ? "todos" : params.get("kind") === "schedule" ? "schedule" : "all",
    };
  }
  return { view: "main" };
}

export function buildNotepadUrl(noteId?: string): string {
  return buildUrl("notepad", noteId);
}

export function buildTileUrl(noteId: string): string {
  return buildUrl("tile", noteId);
}

export function buildAgendaWidgetUrl(kind: AgendaWidgetKind): string {
  return `index.html?view=agendaWidget&kind=${kind}`;
}

function buildUrl(view: AppView, noteId?: string): string {
  const params = new URLSearchParams({ view });
  if (noteId) params.set("noteId", noteId);
  return `index.html?${params.toString()}`;
}
