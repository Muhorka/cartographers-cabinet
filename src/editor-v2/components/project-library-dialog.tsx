/* eslint-disable @next/next/no-img-element -- library previews are self-contained SVG data URIs. */
import type { EditorProject } from "../model/project-model";
import type { StartingScale } from "../model/starter-project";
import type { WorkbenchCopy } from "../i18n/workbench-copy";
import { projectLibraryCopy, type ProjectLibraryCopy } from "../i18n/project-library-copy";
import { projectLibraryDetails, projectLibraryThumbnail } from "../persistence/project-library-presentation";
import type { ProjectViewExportFormat } from "../export/project-export-browser";
import { useMemo, useState } from "react";
import styles from "./project-library-dialog.module.css";

function ProjectThumbnail({ project, alt }: { project: EditorProject; alt: string }) {
  const source = useMemo(() => projectLibraryThumbnail(project), [project]);
  return <img className={styles.thumbnail} src={source} alt={alt} loading="lazy" />;
}

export function ProjectLibraryDialog({ projects, activeProjectId, copy, libraryCopy, draftName, startingScale, pendingDeleteId, error, onDraftName, onStartingScale, onCreate, onOpen, onDuplicate, onRename, onExport, onExportView, onImport, onAskDelete, onDelete, onCancelDelete, onClose }: {
  projects: EditorProject[];
  activeProjectId?: string;
  copy: WorkbenchCopy;
  libraryCopy?: ProjectLibraryCopy;
  draftName: string;
  startingScale: StartingScale;
  pendingDeleteId?: string;
  error?: string;
  onDraftName(value: string): void;
  onStartingScale(value: StartingScale): void;
  onCreate(): void;
  onOpen(projectId: string): void;
  onDuplicate(projectId: string): void;
  onRename?(projectId: string, name: string): void;
  onExport?(projectId: string): void;
  onExportView?(projectId: string, format: ProjectViewExportFormat): void;
  onImport?(file: File): void;
  onAskDelete(projectId: string): void;
  onDelete(projectId: string): void;
  onCancelDelete(): void;
  onClose(): void;
}) {
  const detailCopy = libraryCopy ?? (copy.language === "English" ? projectLibraryCopy.en : projectLibraryCopy.pl);
  const [editingId, setEditingId] = useState<string>(); const [editingName, setEditingName] = useState("");
  return <div className={styles.backdrop} role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className={styles.dialog} role="dialog" aria-modal="true" aria-label={copy.projects}>
      <header><h2>{copy.projects}</h2><button type="button" onClick={onClose} aria-label={copy.close}>×</button></header>
      <div className={styles.libraryTools}>{onImport && <label><input type="file" accept=".json,.cartographer.json,application/json" onChange={(event) => { const file = event.currentTarget.files?.[0]; if (file) onImport(file); event.currentTarget.value = ""; }}/><span>{copy.importProject}</span></label>}{error && <p role="alert">{error}</p>}</div><form className={styles.create} onSubmit={(event) => { event.preventDefault(); onCreate(); }}>
        <label><span>{copy.projectName}</span><input value={draftName} onChange={(event) => onDraftName(event.target.value)} /></label>
        <label><span>{copy.startingScale}</span><select value={startingScale} onChange={(event) => onStartingScale(event.target.value as StartingScale)}>{Object.entries(copy.startingScales).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <button type="submit" disabled={!draftName.trim()}>{copy.create}</button>
      </form>
      <div className={styles.list}>{projects.map((project) => { const details = projectLibraryDetails(project); return <article key={project.id} className={project.id === activeProjectId ? styles.active : undefined}>
        <ProjectThumbnail project={project} alt={detailCopy.thumbnail} />
        <div className={styles.projectInfo}>{editingId === project.id ? <form className={styles.rename} onSubmit={(event) => { event.preventDefault(); const name = editingName.trim(); if (name) onRename?.(project.id, name); setEditingId(undefined); }}><input autoFocus value={editingName} onChange={(event) => setEditingName(event.currentTarget.value)}/><button type="submit">{copy.saveName}</button><button type="button" onClick={() => setEditingId(undefined)}>{copy.close}</button></form> : <strong>{project.name}</strong>}<small>{detailCopy.places(details.placeCount)} · {detailCopy.levels(details.levelCount)} · {detailCopy.rooms(details.roomCount)}</small><small>{detailCopy.drawnItems(details.elementCount)} · {detailCopy.construction(details.wallCount)} · {detailCopy.updated}: {new Date(project.updatedAt).toLocaleString()}</small></div>
        {pendingDeleteId === project.id ? <div className={styles.confirm}><button type="button" onClick={() => onDelete(project.id)}>{copy.deleteProject}</button><button type="button" onClick={onCancelDelete}>{copy.close}</button></div> : <div className={styles.actions}>
          <button type="button" onClick={() => onOpen(project.id)}>{copy.openProject}</button>
          <button type="button" onClick={() => onDuplicate(project.id)} title={copy.duplicateProject}>⧉</button>
          {onRename && <button type="button" onClick={() => { setEditingId(project.id); setEditingName(project.name); }} title={copy.renameProject}>✎</button>}
          {onExport && <button type="button" onClick={() => onExport(project.id)} title={copy.exportProject}>⇩</button>}
          {onExportView && <details className={styles.exportMenu}><summary title={detailCopy.viewExport}>⇩⌄</summary><div><button type="button" onClick={() => onExportView(project.id, "svg")}>{detailCopy.exportSvg}</button><button type="button" onClick={() => onExportView(project.id, "png")}>{detailCopy.exportPng}</button><button type="button" onClick={() => onExportView(project.id, "pdf")}>{detailCopy.exportPdf}</button></div></details>}
          <button type="button" onClick={() => onAskDelete(project.id)} title={copy.deleteProject}>⌫</button>
        </div>}
      </article>; })}</div>
    </section>
  </div>;
}
