import type { EditorProject } from "../model/project-model";
import type { EditorSessionState } from "../state/editor-session";
import type { EditorLocale } from "../i18n/workbench-copy";
import { exportProjectView, type ProjectViewExportFormat } from "../export/project-export-browser";
import { PdfFontError } from "../export/pdf-fonts";
import type { ProjectRenderOptions } from "../export/project-renderer";
import { exportProjectFile } from "../persistence/project-file-browser";
import { MAX_PROJECT_FILE_BYTES } from "../persistence/project-file";
import { importSavedProjectAsNew } from "../persistence/project-library";

function projectLibraryExportError(error: unknown, locale: EditorLocale) {
  if (error instanceof PdfFontError) return locale === "pl" ? "Nie udało się wczytać czcionki do PDF. Spróbuj ponownie. Projekt nie został zmieniony." : "Could not load the PDF font. Please try again. Your project was not changed.";
  return locale === "pl" ? "Nie udało się wyeksportować widoku. Projekt pozostaje zapisany." : "View export failed. Your project is still saved.";
}

export function projectLibraryFileActions({ snapshot, projects, locale, viewport, onError, onImport }: {
  snapshot?: EditorSessionState; projects: EditorProject[]; locale: EditorLocale;
  viewport?: ProjectRenderOptions["viewport"];
  onError(error?: string): void; onImport(project: EditorProject): void;
}) {
  const find = (id: string) => snapshot?.project.id === id ? snapshot.project : projects.find((project) => project.id === id);
  return {
    exportProject(id: string) { const project = find(id); if (project) exportProjectFile(project); },
    async exportView(id: string, format: ProjectViewExportFormat) {
      const project = find(id); if (!project) return;
      onError(undefined);
      try {
        await exportProjectView(format, { project, activePlaceId: project.id === snapshot?.project.id ? snapshot.activePlaceId : project.places.find((place) => !place.parentId)?.id, viewport: project.id === snapshot?.project.id ? viewport : undefined, locale });
      } catch (error) { onError(projectLibraryExportError(error, locale)); }
    },
    async importProject(file: File) {
      onError(undefined);
      try {
        if (file.size > MAX_PROJECT_FILE_BYTES) throw new Error(locale === "pl" ? "Plik projektu jest zbyt duży." : "The project file is too large.");
        onImport(await importSavedProjectAsNew(await file.text()));
      } catch { onError(locale === "pl" ? "Nie można wczytać tego pliku. Wybierz prawidłowy eksport projektu V2 do 25 MB. Obecne projekty nie zostały zmienione." : "Cannot import this file. Choose a valid V2 project export up to 25 MB. Existing projects were not changed."); }
    },
  };
}
