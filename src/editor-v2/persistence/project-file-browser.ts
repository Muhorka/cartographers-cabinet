import type { EditorProject } from "../model/project-model";
import { PROJECT_FILE_MIME_TYPE, projectExportFileName, serializeProjectFile } from "./project-file";
import type { ProjectLibraryRecoveryRecord } from "./project-library";

export function exportProjectFile(project: EditorProject) {
  const url = URL.createObjectURL(new Blob([serializeProjectFile(project)], { type: PROJECT_FILE_MIME_TYPE }));
  const anchor = document.createElement("a");
  anchor.href = url; anchor.download = projectExportFileName(project.name); anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

const PROJECT_RECOVERY_MIME_TYPE = "application/vnd.cartographers-cabinet.project-recovery+json";

function recoveryFileName(primaryKey: IDBValidKey) {
  const key = typeof primaryKey === "string" ? primaryKey : "record";
  const safe = key.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9_-]+/gi, "-").replace(/^-|-$/g, "");
  return `${safe || "record"}.cartographer-recovery.json`;
}

export function serializeProjectRecovery(record: ProjectLibraryRecoveryRecord, exportedAt = new Date().toISOString()) {
  return JSON.stringify({ format: "cartographers-cabinet.project-recovery", fileVersion: 1, exportedAt, primaryKey: record.primaryKey, rawRecord: record.rawRecord, reason: record.reason }, null, 2);
}

export function exportProjectRecoveryFile(record: ProjectLibraryRecoveryRecord) {
  const url = URL.createObjectURL(new Blob([serializeProjectRecovery(record)], { type: PROJECT_RECOVERY_MIME_TYPE }));
  const anchor = document.createElement("a");
  anchor.href = url; anchor.download = recoveryFileName(record.primaryKey); anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}
