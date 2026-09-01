import type { EditorLocale } from "./workbench-copy";

export type CheckpointCopy = {
  safetyFailed: string; proposalStale: string;
  saveFailed: string; removeFailed: string;
  agentSafety: string; proposal: string; manual: string;
  title: string;
  explanation: string;
  namePlaceholder: string;
  save: string;
  empty: string;
  showTracing: string;
  hideTracing: string;
  tracingOpacity: string;
  restore: string;
  remove: string;
  confirmRestore: string;
  confirmRemove: string;
  confirm: string;
  cancel: string;
  automaticName(date: Date): string;
  safetyName(date: Date): string;
};

export const checkpointCopy: Record<EditorLocale, CheckpointCopy> = {
  pl: {
    safetyFailed: "Nie udało się zachować kopii bezpieczeństwa. Przywracanie przerwano; bieżący projekt pozostaje bez zmian.",
    proposalStale: "Projekt zmienił się od przygotowania propozycji. Poproś agenta o jej aktualizację; bieżący stan pozostaje bez zmian.",
    saveFailed: "Nie udało się zachować tej wersji. Bieżący projekt pozostaje bez zmian.", removeFailed: "Nie udało się usunąć tej wersji. Zachowana wersja nadal jest dostępna.",
    agentSafety: "Kalka bezpieczeństwa", proposal: "Propozycja agenta", manual: "Zachowane wersje",
    title: "Kalki i wersje rzeczywistości",
    explanation: "Zachowaj stan projektu. Możesz później przywrócić go albo nałożyć na bieżący arkusz jako nieedytowalną kalkę.",
    namePlaceholder: "Nazwa wersji (opcjonalnie)", save: "Zachowaj wersję", empty: "Nie zachowano jeszcze żadnej wersji.",
    showTracing: "Nałóż kalkę", hideTracing: "Zdejmij kalkę", tracingOpacity: "Widoczność kalki", restore: "Przywróć", remove: "Usuń",
    confirmRestore: "Przywrócić tę wersję? Obecny stan zostanie najpierw bezpiecznie zachowany.", confirmRemove: "Trwale usunąć tę zachowaną wersję?", confirm: "Potwierdź", cancel: "Anuluj",
    automaticName: (date) => `Wersja z ${date.toLocaleString("pl-PL", { dateStyle: "short", timeStyle: "short" })}`,
    safetyName: (date) => `Stan przed przywróceniem — ${date.toLocaleString("pl-PL", { dateStyle: "short", timeStyle: "short" })}`,
  },
  en: {
    safetyFailed: "The safety copy could not be saved. Restore was stopped; the current project is unchanged.",
    proposalStale: "The project changed after this proposal. Ask for an updated proposal; no current changes were overwritten.",
    saveFailed: "This version could not be preserved. The current project is unchanged.", removeFailed: "This version could not be deleted. The preserved version is still available.",
    agentSafety: "Safety tracing", proposal: "Agent proposal", manual: "Saved versions",
    title: "Tracings and alternate realities",
    explanation: "Preserve the project as it is. Restore it later or lay it over the current sheet as a read-only tracing.",
    namePlaceholder: "Version name (optional)", save: "Preserve version", empty: "No version has been preserved yet.",
    showTracing: "Lay over sheet", hideTracing: "Remove tracing", tracingOpacity: "Tracing visibility", restore: "Restore", remove: "Delete",
    confirmRestore: "Restore this version? The current state will be preserved first.", confirmRemove: "Permanently delete this preserved version?", confirm: "Confirm", cancel: "Cancel",
    automaticName: (date) => `Version from ${date.toLocaleString("en-GB", { dateStyle: "short", timeStyle: "short" })}`,
    safetyName: (date) => `State before restore — ${date.toLocaleString("en-GB", { dateStyle: "short", timeStyle: "short" })}`,
  },
};
