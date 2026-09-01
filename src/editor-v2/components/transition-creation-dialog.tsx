import { useMemo, useState } from "react";
import type { EditorProject } from "../model/project-model";
import type { WorkbenchCopy } from "../i18n/workbench-copy";
import type { TransitionPlacementConfig } from "./use-editor-drawing";
import styles from "./transition-creation-dialog.module.css";
import { workLayerAvailability } from "../model/work-context";

export function TransitionCreationDialog({ project, activePlaceId, kind, copy, onConfirm, onCancel }: {
  project: EditorProject;
  activePlaceId: string;
  kind: "stairs" | "elevator";
  copy: WorkbenchCopy;
  onConfirm(config: TransitionPlacementConfig): void;
  onCancel(): void;
}) {
  const source = useMemo(() => {
    const availability = workLayerAvailability(project, activePlaceId, "openings");
    const active = project.places.find(({ id }) => id === (availability.available ? availability.targetPlaceId : activePlaceId));
    return active?.kind === "room" ? project.places.find(({ id }) => id === active.parentId) : active?.kind === "level" ? active : undefined;
  }, [activePlaceId, project]);
  const levels = useMemo(() => source?.parentId ? project.places.filter(({ parentId, kind: placeKind }) => parentId === source.parentId && placeKind === "level").toSorted((a, b) => (a.order ?? 0) - (b.order ?? 0)) : [], [project.places, source]);
  const [selected, setSelected] = useState<string[]>([]); const [sameLevel, setSameLevel] = useState(false);
  const [style, setStyle] = useState<NonNullable<TransitionPlacementConfig["style"]>>("straight"); const [direction, setDirection] = useState(0);
  const targets = levels.filter(({ id }) => id !== source?.id); const valid = Boolean(source && (sameLevel || selected.length));
  return <section className={styles.dialog} role="dialog" aria-modal="false" aria-label={copy.transitionCreation.title}>
    <h2>{kind === "elevator" ? copy.elevator : copy.stairs}</h2><p>{copy.transitionCreation.chooseLevels}</p>
    <fieldset disabled={sameLevel}><legend>{copy.connectsLevels}</legend>{targets.map((level) => <label key={level.id}><input type="checkbox" checked={selected.includes(level.id)} onChange={(event) => { const checked = event.currentTarget.checked; setSelected((current) => checked ? [...new Set([...current, level.id])] : current.filter((id) => id !== level.id)); }}/><span>{level.name}</span></label>)}</fieldset>
    <label className={styles.same}><input type="checkbox" checked={sameLevel} onChange={(event) => setSameLevel(event.currentTarget.checked)}/><span>{copy.sameLevelRise}</span></label>
    {kind === "stairs" && <div className={styles.options}><label><span>{copy.stairStyle}</span><select value={style} onChange={(event) => setStyle(event.currentTarget.value as typeof style)}>{Object.entries(copy.stairStyles).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label><span>{copy.direction}</span><select value={direction} onChange={(event) => setDirection(Number(event.currentTarget.value))}><option value="0">↑</option><option value="90">→</option><option value="180">↓</option><option value="270">←</option></select></label></div>}
    {!targets.length && !sameLevel && <p className={styles.hint}>{copy.transitionCreation.noOtherLevels}</p>}
    <div className={styles.actions}><button type="button" onClick={onCancel}>{copy.drawingStatus.cancel}</button><button type="button" className={styles.primary} disabled={!valid} onClick={() => onConfirm({ sourceLevelId: source?.id, targetLevelId: selected[0], connectedLevelIds: [source?.id, ...selected].filter((id): id is string => Boolean(id)), style, direction, sameLevelRise: sameLevel })}>{copy.transitionCreation.create}</button></div>
  </section>;
}
