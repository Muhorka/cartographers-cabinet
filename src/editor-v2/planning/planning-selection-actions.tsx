"use client";

import styles from "./planning-selection-actions.module.css";

export type PlanningSelectionCopy = { title?: string; alignStart: string; alignCenter: string; alignEnd: string; distribute: string; horizontal: string; vertical: string };
export const defaultPlanningSelectionCopy: PlanningSelectionCopy = { alignStart: "Align start", alignCenter: "Align centre", alignEnd: "Align end", distribute: "Distribute evenly", horizontal: "Horizontal", vertical: "Vertical" };

type Props = {
  count: number;
  canAlign?: boolean;
  canDistribute?: boolean;
  onAlign(axis: "horizontal" | "vertical", edge: "start" | "center" | "end"): void;
  onDistribute(axis: "horizontal" | "vertical"): void;
  copy?: PlanningSelectionCopy;
  disabled?: boolean;
};

/** Controlled actions for the selection strip; it intentionally knows no project shape. */
export function PlanningSelectionActions({ count, canAlign = count > 1, canDistribute = count > 2, onAlign, onDistribute, copy = defaultPlanningSelectionCopy, disabled }: Props) {
  if (count < 2) return null;
  return <div className={styles.actions} aria-label={copy.title ?? "Planning selection actions"}>
    <span className={styles.count}>{count}</span>
    {(["horizontal", "vertical"] as const).map((axis) => <fieldset key={axis} disabled={disabled || !canAlign}><legend>{axis === "horizontal" ? copy.horizontal : copy.vertical}</legend>{(["start", "center", "end"] as const).map((edge) => { const label = edge === "start" ? copy.alignStart : edge === "center" ? copy.alignCenter : copy.alignEnd; return <button key={edge} type="button" title={label} aria-label={`${label} · ${axis === "horizontal" ? copy.horizontal : copy.vertical}`} onClick={() => onAlign(axis, edge)}><AlignmentIcon axis={axis} edge={edge}/></button>; })}{canDistribute && <button type="button" title={copy.distribute} aria-label={`${copy.distribute} · ${axis === "horizontal" ? copy.horizontal : copy.vertical}`} onClick={() => onDistribute(axis)}><AlignmentIcon axis={axis} edge="distribute"/></button>}</fieldset>)}
  </div>;
}

function AlignmentIcon({ axis, edge }: { axis: "horizontal" | "vertical"; edge: "start" | "center" | "end" | "distribute" }) {
  const anchor = edge === "start" ? 4 : edge === "end" ? 20 : 12;
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3" aria-hidden="true"><g transform={axis === "vertical" ? "rotate(90 12 12)" : undefined}>{edge === "distribute" ? <><path d="M4 3v18M20 3v18M7 12h10M9 10l-2 2 2 2M15 10l2 2-2 2"/><path d="M11 5h2v3h-2zM11 16h2v3h-2z"/></> : <><path d={`M${anchor} 2v20`}/>{[7, 12, 9].map((width, i) => <rect key={i} x={edge === "start" ? anchor : edge === "end" ? anchor - width : anchor - width / 2} y={4 + i * 6} width={width} height="3" fill="currentColor" fillOpacity=".25"/>)}</>}</g></svg>;
}
