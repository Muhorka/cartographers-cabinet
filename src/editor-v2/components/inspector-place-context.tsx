import type { EditorProject } from "../model/project-model";
import type { WorkbenchCopy } from "../i18n/workbench-copy";
import styles from "./inspector-place-context.module.css";

type Props = {
  project: EditorProject;
  activePlaceId: string;
  inspectedPlaceId?: string;
  hidden?: boolean;
  copy: WorkbenchCopy["inspectorContext"];
  onInspectActivePlace?(): void;
};

export function InspectorPlaceContext({ project, activePlaceId, inspectedPlaceId, hidden, copy, onInspectActivePlace }: Props) {
  if (hidden || !inspectedPlaceId || inspectedPlaceId === activePlaceId) return null;
  const inspected = project.places.find(({ id }) => id === inspectedPlaceId);
  const displayed = project.places.find(({ id }) => id === activePlaceId);
  if (inspected?.kind !== "building" || displayed?.kind !== "level" || displayed.parentId !== inspected.id) return null;
  return <section className={styles.context} aria-label={copy.ariaLabel}>
    <span className={styles.eye} aria-hidden="true"><svg viewBox="0 0 24 16"><path d="M1.5 8s4-6 10.5-6 10.5 6 10.5 6-4 6-10.5 6S1.5 8 1.5 8Z"/><circle cx="12" cy="8" r="2.7"/></svg></span>
    <p role="status">{copy.buildingLevel(inspected.name, displayed.name)}</p>
    {onInspectActivePlace && <button type="button" onClick={onInspectActivePlace}>{copy.editLevel}</button>}
  </section>;
}
