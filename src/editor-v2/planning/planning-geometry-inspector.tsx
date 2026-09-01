"use client";

import styles from "./planning-geometry-inspector.module.css";

export type PlanningGeometryInspectorCopy = { title: string; node: string; add: string; cancel: string; hint: string; remove: string; smooth: string; sharp: string; split: string; unsupported: string };
export const defaultPlanningGeometryInspectorCopy: PlanningGeometryInspectorCopy = { title: "Geometry nodes", node: "Node", add: "Add node", cancel: "Cancel insertion", hint: "Click the line to place a node. Press Escape to cancel.", remove: "Remove node", smooth: "Smooth", sharp: "Sharp", split: "Split at this node", unsupported: "This geometry has no editable nodes." };

type Props = { kind: "region" | "path" | "bezier"; nodeCount: number; selectedNode: number; smooth?: boolean; insertionActive?: boolean; onSelectNode(index: number): void; onInsert(): void; onCancelInsert?(): void; onRemove(): void; onToggleSmooth?(): void; onSplit?(): void; copy?: PlanningGeometryInspectorCopy; disabled?: boolean };

/** Explicit, geometry-aware node controls. The split action is shown only with a safe parent callback. */
export function PlanningGeometryInspector({ kind, nodeCount, selectedNode, smooth, insertionActive = false, onSelectNode, onInsert, onCancelInsert, onRemove, onToggleSmooth, onSplit, copy = defaultPlanningGeometryInspectorCopy, disabled }: Props) {
  if (kind !== "region" && kind !== "path" && kind !== "bezier") return <p className={styles.empty}>{copy.unsupported}</p>;
  const canRemove = nodeCount > (kind === "region" ? 3 : 2);
  return <section className={styles.panel} aria-label={copy.title}><strong>{copy.title}</strong><label><span>{copy.node}</span><select disabled={disabled || nodeCount === 0} value={selectedNode} onChange={(event) => onSelectNode(Number(event.currentTarget.value))}>{Array.from({ length: nodeCount }, (_, index) => <option value={index} key={index}>{index + 1}</option>)}</select></label><div className={styles.actions}><button aria-pressed={insertionActive} disabled={disabled} type="button" onClick={insertionActive ? onCancelInsert : onInsert}>{insertionActive ? copy.cancel : copy.add}</button><button disabled={disabled || !canRemove} type="button" onClick={onRemove}>{copy.remove}</button>{kind === "bezier" && onToggleSmooth && <button disabled={disabled} type="button" onClick={onToggleSmooth}>{smooth ? copy.sharp : copy.smooth}</button>}{onSplit && <button disabled={disabled} type="button" onClick={onSplit}>{copy.split}</button>}</div>{insertionActive && <small className={styles.hint} role="status">{copy.hint}</small>}</section>;
}
