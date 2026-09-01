import type { ToolboxCopy } from "../i18n/toolbox-copy";
import { ToolGlyph } from "./tool-glyph";
import styles from "./workbench-toolbox.module.css";

/** The same controls remain reachable in both the full and folded toolbox. */
export function OutlineOperationButtons({ copy, boundaryName, boundaryEditing, canCutout, canAddOutline = canCutout, cutoutActive, addOutlineActive, onBoundaryEditing, onCutoutActive, onAddOutlineActive }: {
  copy: ToolboxCopy;
  boundaryName?: string;
  boundaryEditing: boolean;
  canCutout: boolean;
  canAddOutline?: boolean;
  cutoutActive: boolean;
  addOutlineActive: boolean;
  onBoundaryEditing(active: boolean): void;
  onCutoutActive?(active: boolean): void;
  onAddOutlineActive?(active: boolean): void;
}) {
  const name = boundaryName?.trim();
  const boundaryLabel = boundaryEditing ? name ? copy.stopEditingBoundaryFor(name) : copy.stopEditingBoundary : name ? copy.editBoundaryFor(name) : copy.editBoundary;
  return <>
    <button type="button" className={boundaryEditing ? styles.activeUtility : undefined} aria-pressed={boundaryEditing} title={boundaryLabel} aria-label={boundaryLabel} onClick={() => onBoundaryEditing(!boundaryEditing)}><ToolGlyph id="boundary"/><span>{boundaryEditing ? copy.stopEditingBoundary : copy.editBoundary}</span></button>
    <button type="button" disabled={!canCutout} className={cutoutActive ? styles.activeUtility : undefined} aria-pressed={cutoutActive} title={copy.cutout} aria-label={copy.cutout} onClick={() => onCutoutActive?.(!cutoutActive)}><ToolGlyph id="cutout"/><span>{copy.cutout}</span></button>
    <button type="button" disabled={!canAddOutline} className={addOutlineActive ? styles.activeUtility : undefined} aria-pressed={addOutlineActive} title={copy.addOutline} aria-label={copy.addOutline} onClick={() => onAddOutlineActive?.(!addOutlineActive)}><ToolGlyph id="add-outline"/><span>{copy.addOutline}</span></button>
  </>;
}
