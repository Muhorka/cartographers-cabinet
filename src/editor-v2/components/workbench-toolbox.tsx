import { roadWidthFor } from "../roads/road-style";
import { ribbonWidthFor } from "../geometry/ribbon-style";
import { isRibbonSubject } from "../geometry/ribbon-geometry";
import { ToolGlyph } from "./tool-glyph";
import { OutlineOperationButtons } from "./outline-operation-buttons";
import styles from "./workbench-toolbox.module.css";
import { availableInstruments, constructionCategories, constructionCategory, getWorkLayer, visibleLayerId, visibleWorkLayers, type InstrumentId, type WorkLayerId } from "../toolbox/toolbox-model";
import { chooseInstrument, chooseSubject, activateLayer, outlineInstruments, outlineInstrumentFor, type ToolboxState } from "../toolbox/toolbox-state";
import type { ToolboxCopy } from "../i18n/toolbox-copy";
import { useEffect, type ReactNode } from "react";

export function WorkbenchToolbox({ state, copy, availableLayerIds, availableSubjectIds, boundaryName, boundaryEditing, cutoutActive = false, addOutlineActive = false, canCutout = false, canAddOutline = canCutout, outlineInstrumentId, onOutlineInstrumentChange, collapsed, canUndo, canRedo, canClearLayer = true, clearLayerLabel, sketchVisible, sketchOpacity, eraserSize = 10, gapClosingEnabled = false, gapClosingTolerance = 14, pencilSmoothing = .25, selectionActions, onChange, onBoundaryEditing, onCutoutActive, onAddOutlineActive, onUndo, onRedo, onClearLayer, onCollapsed, onSketchVisible, onSketchOpacity, onEraserSize, onGapClosingEnabled, onGapClosingTolerance, onPencilSmoothing }: {
  state: ToolboxState;
  copy: ToolboxCopy;
  availableLayerIds: ReadonlySet<WorkLayerId>;
  /** Context-filtered equipment subjects; omitted by isolated toolbox consumers. */
  availableSubjectIds?: ReadonlySet<string>;
  /** Name of the currently open map, used only to clarify the boundary tooltip. */
  boundaryName?: string;
  boundaryEditing: boolean;
  cutoutActive?: boolean;
  addOutlineActive?: boolean;
  canCutout?: boolean; canAddOutline?: boolean;
  outlineInstrumentId?: InstrumentId;
  onOutlineInstrumentChange?(instrumentId: InstrumentId): void;
  collapsed: boolean;
  canUndo: boolean;
  canRedo: boolean;
  canClearLayer?: boolean;
  clearLayerLabel?: string;
  sketchVisible: boolean;
  sketchOpacity: number;
  eraserSize?: number;
  gapClosingEnabled?: boolean;
  gapClosingTolerance?: number;
  pencilSmoothing?: number;
  selectionActions?: ReactNode;
  onChange(state: ToolboxState): void;
  onBoundaryEditing(active: boolean): void;
  onCutoutActive?(active: boolean): void;
  onAddOutlineActive?(active: boolean): void;
  onUndo(): void;
  onRedo(): void;
  onClearLayer(): void;
  onCollapsed(collapsed: boolean): void;
  onSketchVisible(visible: boolean): void;
  onSketchOpacity(opacity: number): void;
  onEraserSize?(size: number): void;
  onGapClosingEnabled?(enabled: boolean): void;
  onGapClosingTolerance?(tolerance: number): void;
  onPencilSmoothing?(amount: number): void;
}) {
  const layer = getWorkLayer(state.activeLayerId); const memory = state.byLayer[state.activeLayerId]; const topLayerId = visibleLayerId(layer.id);
  const hasLevelPlan = availableLayerIds.has("openings");
  const contextCategories = hasLevelPlan ? constructionCategories : constructionCategories.filter(({ id }) => id === "platforms");
  const storedCategory = topLayerId === "construction" ? constructionCategory(layer.id, memory.subjectId) : undefined;
  const category = topLayerId === "construction" ? (storedCategory && contextCategories.some(({ id }) => id === storedCategory.id) ? storedCategory : contextCategories[0]) : undefined;
  const subjectCandidates = layer.subjects.filter((subject) => (!category || subject.groupId === category.id) && (layer.id !== "equipment" || !availableSubjectIds || availableSubjectIds.has(subject.id)));
  const effectiveSubjectId = subjectCandidates.some(({ id }) => id === memory.subjectId) ? memory.subjectId : subjectCandidates[0]?.id ?? memory.subjectId;
  const regularInstruments = availableInstruments(layer.id, effectiveSubjectId);
  const outlineOperation = cutoutActive || addOutlineActive;
  const instruments = outlineOperation ? outlineInstruments : regularInstruments;
  const instrumentId = outlineOperation ? outlineInstrumentId ?? outlineInstrumentFor(state) : memory.instrumentId;
  const changeInstrument = (next: InstrumentId) => outlineOperation ? onOutlineInstrumentChange?.(next) : onChange(chooseInstrument(state, next));
  const canCleanLines = ["pencil", "pen", "line", "wall-run", "arc"].includes(instrumentId) && ["terrain", "boundaries", "buildings", "construction"].includes(layer.id);
  useEffect(() => {
    if (layer.id !== "equipment" || !availableSubjectIds || effectiveSubjectId === memory.subjectId) return;
    onChange(chooseSubject(state, effectiveSubjectId));
  }, [availableSubjectIds, effectiveSubjectId, layer.id, memory.subjectId, onChange, state]);
  const outlineButtons = <OutlineOperationButtons {...{ copy, boundaryName, boundaryEditing, canCutout, canAddOutline, cutoutActive, addOutlineActive, onBoundaryEditing, onCutoutActive, onAddOutlineActive }}/>;
  const smoothingControl = <label className={styles.pencilSmoothing} title={copy.pencilSmoothing}><span>{copy.pencilSmoothing}</span><input aria-label={copy.pencilSmoothing} type="range" min="0" max="1" step="0.05" value={pencilSmoothing} onChange={(event) => onPencilSmoothing?.(Number(event.currentTarget.value))}/><output>{Math.round(pencilSmoothing * 100)}%</output></label>;
  const cleanupValue = gapClosingEnabled ? Math.max(1, gapClosingTolerance - 3) : 0;
  const cleanupTolerance = <label title={copy.closeGapsStrength}><span>{copy.closeGapsStrength}</span><input aria-label={copy.closeGapsStrength} type="range" min="0" max="27" step="1" value={cleanupValue} onChange={(event) => { const value = Number(event.currentTarget.value); onGapClosingEnabled?.(value > 0); if (value > 0) onGapClosingTolerance?.(value + 3); }}/><output>{gapClosingEnabled ? `${Math.round(gapClosingTolerance)} px` : "0 px"}</output></label>;
  return <section className={`${styles.case}${collapsed ? ` ${styles.collapsed}` : ""}`} aria-label={copy.ariaLabel}>
    <div className={styles.layerRail} role="tablist" aria-label={copy.chooseLayer}>
      {visibleWorkLayers.map((item) => { const available = item.id === "construction" ? availableLayerIds.has("construction") || availableLayerIds.has("openings") : availableLayerIds.has(item.id); return <button key={item.id} type="button" role="tab" aria-selected={item.id === topLayerId} disabled={!available} className={item.id === topLayerId ? styles.activeLayer : undefined} onClick={() => { let next = activateLayer(state, item.id === "construction" && topLayerId === "construction" ? state.activeLayerId : item.id); if (item.id === "construction" && !hasLevelPlan) next = chooseSubject(next, "platform.platform"); if (item.id === "equipment" && availableSubjectIds) { const fallback = getWorkLayer("equipment").subjects.find(({ id }) => availableSubjectIds.has(id)); if (fallback && !availableSubjectIds.has(next.byLayer.equipment.subjectId)) next = chooseSubject(next, fallback.id); } onChange(next); }}><ToolGlyph id={item.id}/><span>{copy.layers[item.id]}</span></button>; })}
      <button type="button" className={styles.fold} title={collapsed ? copy.expand : copy.collapse} aria-label={collapsed ? copy.expand : copy.collapse} onClick={() => onCollapsed(!collapsed)}><ToolGlyph id="fold"/></button>
    </div>
    {collapsed && <div className={`${styles.instrumentRail} ${styles.compactTools}`} role="toolbar" aria-label={copy.chooseInstrument}>
      {instruments.map((instrument) => <InstrumentButton key={instrument} id={instrument} active={instrument === instrumentId} label={copy.instruments[instrument]} hint={instrument === "note" ? copy.noteGestureHint : undefined} onClick={() => changeInstrument(instrument)}/>)}
      <i/>{outlineButtons}<i/>
      <button type="button" disabled={!canUndo} title={copy.undo} aria-label={copy.undo} onClick={onUndo}><ToolGlyph id="undo"/></button>
      <button type="button" disabled={!canRedo} title={copy.redo} aria-label={copy.redo} onClick={onRedo}><ToolGlyph id="redo"/></button>
    </div>}
    {collapsed && selectionActions && <div className={styles.selectionSlot}>{selectionActions}</div>}
    {!collapsed && <>
      {topLayerId === "construction" && <div className={styles.categoryRail} role="radiogroup" aria-label={copy.chooseSubject}>{contextCategories.map((item) => <button key={item.id} type="button" role="radio" aria-checked={item.id === category?.id} className={item.id === category?.id ? styles.activeCategory : undefined} onClick={() => { let next = activateLayer(state, item.layerId); const current = next.byLayer[item.layerId].subjectId; if (!getWorkLayer(item.layerId).subjects.some((subject) => subject.id === current && subject.groupId === item.id)) next = chooseSubject(next, item.defaultSubjectId); onChange(next); }}>{copy.constructionGroups[item.id]}</button>)}</div>}
      <div className={styles.subjectRail} role="radiogroup" aria-label={copy.chooseSubject}>
        <small>{copy.chooseSubject}</small>{subjectCandidates.map((subject) => <button key={subject.id} type="button" role="radio" aria-checked={subject.id === effectiveSubjectId} className={subject.id === effectiveSubjectId ? styles.activeSubject : undefined} onClick={() => onChange(chooseSubject(state, subject.id))}>{copy.subjects[subject.id]}</button>)}
      </div>
      {layer.id === "sketch" && <div className={styles.sketchView}><label><input type="checkbox" checked={sketchVisible} onChange={(event) => onSketchVisible(event.currentTarget.checked)}/><span>{copy.sketchVisibility}</span></label><label><span>{copy.sketchOpacity}</span><input type="range" min="0.05" max="1" step="0.05" value={sketchOpacity} disabled={!sketchVisible} onChange={(event) => onSketchOpacity(Number(event.currentTarget.value))}/></label></div>}
      <div className={`${styles.instrumentBand}${instrumentId === "pencil" && canCleanLines ? ` ${styles.instrumentBandWithControls}` : ""}`}>
        <div className={styles.instrumentRail} role="toolbar" aria-label={copy.chooseInstrument}>
          <small>{copy.chooseInstrument}</small>{instruments.map((instrument) => <InstrumentButton key={instrument} id={instrument} active={instrument === instrumentId} label={copy.instruments[instrument]} hint={instrument === "note" ? copy.noteGestureHint : undefined} onClick={() => changeInstrument(instrument)}/>) }{instrumentId === "erase" && <label className={styles.eraserSize}><span>{copy.eraserSize}</span><input aria-label={copy.eraserSize} type="range" min="4" max="36" step="1" value={eraserSize} onChange={(event) => onEraserSize?.(Number(event.currentTarget.value))}/><output>{Math.round(eraserSize)}</output></label>}
          {isRibbonSubject(layer.id, memory.subjectId) && <label className={styles.pencilSmoothing}><span>{layer.id === "roads" ? copy.roadWidth : copy.ribbonWidth}</span><input aria-label={layer.id === "roads" ? copy.roadWidth : copy.ribbonWidth} type="number" min=".1" max="1000" step=".1" style={{ width: "5em" }} value={memory.widthMeters ?? (layer.id === "roads" ? roadWidthFor(memory.subjectId) : ribbonWidthFor(memory.subjectId))} onChange={(event) => { const value = Number(event.currentTarget.value); if (value >= .1 && value <= 1000) onChange({ ...state, byLayer: { ...state.byLayer, [layer.id]: { ...memory, widthMeters: value } } }); }}/></label>}
          {instrumentId === "pencil" && canCleanLines
            ? <div className={`${styles.lineCleanup} ${styles.pencilLineCleanup}`}><div className={styles.lineControlStack}>{smoothingControl}{cleanupTolerance}</div></div>
            : <>{instrumentId === "pencil" && smoothingControl}{canCleanLines && <div className={styles.lineCleanup}>{cleanupTolerance}</div>}</>}
        </div>
        <div className={styles.utilities} role="toolbar" aria-label={copy.ariaLabel}>
          {outlineButtons}
          <i/>
          <button type="button" disabled={!canUndo} title={copy.undo} aria-label={copy.undo} onClick={onUndo}><ToolGlyph id="undo"/></button>
          <button type="button" disabled={!canRedo} title={copy.redo} aria-label={copy.redo} onClick={onRedo}><ToolGlyph id="redo"/></button>
          <button type="button" className={styles.clear} disabled={!canClearLayer} title={clearLayerLabel ?? copy.clearLayer} aria-label={clearLayerLabel ?? copy.clearLayer} onClick={onClearLayer}><ToolGlyph id="clear"/><span>{copy.clearLayer}</span></button>
        </div>
      </div>
      {selectionActions && <div className={styles.selectionSlot}>{selectionActions}</div>}
    </>}
  </section>;
}

function InstrumentButton({ id, active, label, hint, onClick }: { id: InstrumentId; active: boolean; label: string; hint?: string; onClick(): void }) {
  return <button type="button" className={active ? styles.activeInstrument : undefined} title={hint ? `${label}. ${hint}` : label} aria-label={label} aria-pressed={active} onClick={onClick}><ToolGlyph id={id}/><span>{label}</span></button>;
}
