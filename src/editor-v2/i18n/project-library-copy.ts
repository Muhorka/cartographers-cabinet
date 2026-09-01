import type { EditorLocale } from "./workbench-copy";
export type ProjectLibraryCopy = {
  thumbnail: string; details: string; places: (count: number) => string; levels: (count: number) => string; rooms: (count: number) => string;
  drawnItems: (count: number) => string; construction: (count: number) => string; updated: string; viewExport: string; exportSvg: string; exportPng: string; exportPdf: string;
  recoveryWarning: (count: number) => string; recoveryOnlyTitle: string; recoveryOnlyBody: (count: number) => string; exportRecovery: string; recoveryKey: string; recoverySafety: string;
};
export const projectLibraryCopy: Record<EditorLocale, ProjectLibraryCopy> = {
  pl: {
    thumbnail: "Miniatura projektu", details: "Szczegóły projektu", places: (count) => `Poziomy mapy: ${count}`, levels: (count) => `Kondygnacje: ${count}`, rooms: (count) => `Pomieszczenia: ${count}`,
    drawnItems: (count) => `Rysunki: ${count}`, construction: (count) => `Elementy konstrukcji: ${count}`, updated: "Ostatnio zapisano", viewExport: "Eksportuj bieżący widok", exportSvg: "SVG wektorowy", exportPng: "PNG", exportPdf: "PDF wektorowy",
    recoveryWarning: (count) => `Niektóre zapisane projekty wymagają odzyskania (${count}). Pozostałe projekty zostały wczytane. Wadliwe dane nie zostały usunięte.`, recoveryOnlyTitle: "Nie udało się wczytać żadnego poprawnego projektu", recoveryOnlyBody: (count) => `Wykryto ${count} ${count === 1 ? "wadliwy zapisany projekt" : "wadliwe zapisane projekty"}. Najpierw wyeksportuj kopię awaryjną.`, exportRecovery: "Eksportuj kopię awaryjną", recoveryKey: "Klucz Dexie", recoverySafety: "Nie wykonano automatycznej naprawy ani usuwania.",
  },
  en: {
    thumbnail: "Project thumbnail", details: "Project details", places: (count) => `Map levels: ${count}`, levels: (count) => `Floors: ${count}`, rooms: (count) => `Rooms: ${count}`,
    drawnItems: (count) => `Drawings: ${count}`, construction: (count) => `Construction items: ${count}`, updated: "Last saved", viewExport: "Export current view", exportSvg: "Vector SVG", exportPng: "PNG", exportPdf: "Vector PDF",
    recoveryWarning: (count) => `Some saved projects need recovery (${count}). The remaining projects were loaded. Damaged data was not deleted.`, recoveryOnlyTitle: "No valid project could be loaded", recoveryOnlyBody: (count) => `${count} damaged saved ${count === 1 ? "project was" : "projects were"} found. Export an emergency copy first.`, exportRecovery: "Export emergency copy", recoveryKey: "Dexie key", recoverySafety: "No repair or deletion was performed automatically.",
  },
};
