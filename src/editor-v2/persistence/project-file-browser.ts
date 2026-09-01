import type { EditorProject } from "../model/project-model";
import { PROJECT_FILE_MIME_TYPE, projectExportFileName, serializeProjectFile } from "./project-file";

export function exportProjectFile(project: EditorProject) {
  const url = URL.createObjectURL(new Blob([serializeProjectFile(project)], { type: PROJECT_FILE_MIME_TYPE }));
  const anchor = document.createElement("a");
  anchor.href = url; anchor.download = projectExportFileName(project.name); anchor.click();
  URL.revokeObjectURL(url);
}
