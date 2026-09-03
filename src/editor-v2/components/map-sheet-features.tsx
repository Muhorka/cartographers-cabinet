import type { KeyboardEvent } from "react";
import type { ConstructionDocument } from "../construction/construction-document";
import type { WallOpening } from "../construction/wall-features";
import type { VerticalTransition } from "../construction/wall-features";
import type { KernelPoint } from "../geometry/geometry-types";
import { regionPath } from "./map-sheet-geometry";
import styles from "./map-sheet-features.module.css";
import { regionBounds } from "../geometry/region-transform";
import { regionCorner, type ResizeCorner } from "../geometry/region-resize";
import type { AffineMatrix } from "../geometry/affine-transform";
import { matrixAttribute } from "./map-sheet-geometry";
import { stairGlyphPrimitives } from "../geometry/stair-glyph";
import type { StoryObjectRef } from "../story/types";
import { selectionKey } from "../drawing/selection-reference";
import { svgId } from "../geometry/svg-id";

type FeatureSelection = { kind: "opening" | "transition"; id: string; scopeId: string };
const emptyAgentFocus = new Set<string>();
type FeatureCopy = {
  openingLabel?(kind: WallOpening["kind"], id: string, index: number): string;
  transitionLabel?(id: string, kind: "stairs" | "elevator" | undefined, index: number): string;
};

export function MapSheetFeatures({ document, prefix, selectedIds, agentFocusedIds = emptyAgentFocus, copy, storyLabel, viewportZoom, selectionEnabled = false, selectionOnly = false, selectableOpeningWallIds, selectableTransitionIds, movingIds = new Set(), movingWallIds = new Set(), moveDelta, openingWidthPreview, onSelect, transitionOverrides }: {
  document: ConstructionDocument;
  prefix: string;
  selectedIds: Set<string>;
  agentFocusedIds?: Set<string>;
  copy: FeatureCopy;
  storyLabel?(ref: StoryObjectRef, fallback: string): string;
  viewportZoom: number;
  selectionEnabled?: boolean;
  selectionOnly?: boolean;
  selectableOpeningWallIds?: ReadonlySet<string>;
  selectableTransitionIds?: ReadonlySet<string>;
  movingIds?: ReadonlySet<string>;
  movingWallIds?: ReadonlySet<string>;
  moveDelta?: KernelPoint;
  openingWidthPreview?: { id: string; width: number };
  onSelect?(selection: FeatureSelection, additive?: boolean): void;
  transitionOverrides?: readonly { transition: VerticalTransition; scopeId: string; index: number; transform?: AffineMatrix }[];
}) {
  const walls = new Map(document.walls.map((wall) => [wall.id, wall]));
  const transitionEntries: readonly { transition: VerticalTransition; scopeId: string; index: number; transform?: AffineMatrix }[] = transitionOverrides ?? document.transitions.map((transition, index) => ({ transition, scopeId: document.id, index }));
  return <g className={styles.features}>
    {document.openings.map((storedOpening, openingIndex) => {
      const opening = openingWidthPreview?.id === storedOpening.id ? { ...storedOpening, width: openingWidthPreview.width } : storedOpening; if (opening.visible === false) return null;
      const wall = walls.get(opening.wallId); if (!wall || wall.visible === false) return null;
      const dx = wall.end.x - wall.start.x; const dy = wall.end.y - wall.start.y; const length = Math.hypot(dx, dy); if (!length) return null;
      const x = wall.start.x + dx * opening.position; const y = wall.start.y + dy * opening.position; const angle = Math.atan2(dy, dx) * 180 / Math.PI;
      const fallback = copy.openingLabel?.(opening.kind, opening.id, openingIndex + 1) ?? opening.id; const label = storyLabel?.({ kind: "opening", id: opening.id, scopeId: document.id }, fallback) ?? fallback; const inScope = !selectableOpeningWallIds || selectableOpeningWallIds.has(opening.wallId); const selectable = selectionEnabled && inScope && (selectionOnly || !opening.locked);
      const openingKey = selectionKey({ kind: "opening", id: opening.id, scopeId: document.id }); const selected = selectedIds.has(openingKey); const agentFocused = agentFocusedIds.has(openingKey);
      const moving = moveDelta && (movingIds.has(opening.id) || movingWallIds.has(opening.wallId));
      return <g key={`${document.id}:${opening.id}`} transform={moving ? `translate(${moveDelta.x} ${moveDelta.y})` : undefined}><g className={`${styles.opening}${agentFocused ? ` ${styles.agentFocused}` : ""}${selected ? ` ${styles.selected}` : ""}${selectable ? "" : ` ${styles.context}`}`} transform={`translate(${x} ${y}) rotate(${angle})`} data-selectable={selectable ? "true" : undefined} data-selection-layer={selectable ? "construction" : undefined} data-selection-kind={selectable ? "opening" : undefined} data-selection-id={selectable ? opening.id : undefined} data-selection-scope={selectable ? document.id : undefined} data-feature-id={opening.id} data-opening-kind={opening.kind} role={selectable ? "button" : undefined} tabIndex={selectable ? 0 : undefined} aria-label={selectable ? label : undefined} onClick={selectable ? (event) => { event.stopPropagation(); select(onSelect, { kind: "opening", id: opening.id, scopeId: document.id }, event.ctrlKey || event.metaKey || event.shiftKey); } : undefined} onKeyDown={selectable ? (event) => activate(event, () => onSelect?.({ kind: "opening", id: opening.id, scopeId: document.id })) : undefined}>
        <OpeningMark opening={opening} wallThickness={wall.thickness}/><line className={styles.hit} x1={-opening.width / 2} y1="0" x2={opening.width / 2} y2="0"/>{selectable && selected && <><circle className={styles.resizeHandle} cx={-opening.width / 2} cy="0" r={5 / viewportZoom} data-opening-resize={opening.id} data-opening-scope={document.id}/><circle className={styles.resizeHandle} cx={opening.width / 2} cy="0" r={5 / viewportZoom} data-opening-resize={opening.id} data-opening-scope={document.id}/></>}<title>{label}</title>
      </g></g>;
    })}
    {transitionEntries.map(({ transition, scopeId, index, transform }) => {
      if (transition.visible === false) return null;
      const patternId = `${svgId(prefix)}-${svgId(scopeId)}-${transition.kind}-${svgId(transition.id)}`; const clipId = `${patternId}-clip`; const fallback = copy.transitionLabel?.(transition.id, transition.kind, index + 1) ?? transition.id; const label = storyLabel?.({ kind: "transition", id: transition.id, scopeId }, fallback) ?? fallback; const inScope = !selectableTransitionIds || selectableTransitionIds.has(transition.id); const selectable = selectionEnabled && inScope && !transform && (selectionOnly || !transition.locked); const transitionKey = selectionKey({ kind: "transition", id: transition.id, scopeId }); const selected = selectedIds.has(transitionKey); const agentFocused = agentFocusedIds.has(transitionKey); const bounds = regionBounds(transition.footprint);
      const transforms = [transform && matrixAttribute(transform), moveDelta && movingIds.has(transition.id) ? `translate(${moveDelta.x} ${moveDelta.y})` : undefined].filter(Boolean).join(" ") || undefined;
      return <g key={JSON.stringify([scopeId, transition.id, transform ? "context" : "local"])} transform={transforms} className={`${styles.transition}${agentFocused ? ` ${styles.agentFocused}` : ""}${selected ? ` ${styles.selected}` : ""}${selectable ? "" : ` ${styles.context}`}`} data-selectable={selectable ? "true" : undefined} data-selection-layer={selectable ? "construction" : undefined} data-selection-kind={selectable ? "transition" : undefined} data-selection-id={selectable ? transition.id : undefined} data-selection-scope={selectable ? scopeId : undefined} data-feature-id={transition.id} role={selectable ? "button" : undefined} tabIndex={selectable ? 0 : undefined} aria-label={selectable ? label : undefined} onClick={selectable ? (event) => { event.stopPropagation(); select(onSelect, { kind: "transition", id: transition.id, scopeId }, event.ctrlKey || event.metaKey || event.shiftKey); } : undefined} onKeyDown={selectable ? (event) => activate(event, () => onSelect?.({ kind: "transition", id: transition.id, scopeId })) : undefined}>
        <defs><pattern id={patternId} width="6" height="6" patternUnits="userSpaceOnUse"><path className={styles.tread} d="M0 0 6 6M6 0 0 6"/></pattern><clipPath id={clipId}><path d={regionPath(transition.footprint)}/></clipPath></defs>
        <path className={`${styles.stairs} ${transition.kind === "elevator" ? styles.elevator : ""}`} d={regionPath(transition.footprint)} fill={transition.kind === "elevator" ? `url(#${patternId})` : undefined}/>{transition.kind === "stairs" && <g clipPath={`url(#${clipId})`} transform={transition.direction ? `rotate(${transition.direction} ${(bounds.minX + bounds.maxX) / 2} ${(bounds.minY + bounds.maxY) / 2})` : undefined}><StairDiagram style={transition.style ?? "straight"} bounds={bounds}/></g>}{selectable && selected && (["north-west", "north-east", "south-east", "south-west"] as ResizeCorner[]).map((corner) => { const point = regionCorner(transition.footprint, corner); return <circle key={corner} className={styles.resizeHandle} cx={point.x} cy={point.y} r={5 / viewportZoom} data-resize-corner={corner} data-transition-id={transition.id} data-transition-scope={scopeId}/>; })}<title>{label}</title>
      </g>;
    })}
  </g>;
}

function OpeningMark({ opening, wallThickness }: { opening: WallOpening; wallThickness: number }) {
  const half = opening.width / 2; const depth = Math.max(.14, wallThickness * .8); const clear = <line className={styles.clear} x1={-half} y1="0" x2={half} y2="0"/>;
  const jambs = <><line className={styles.jamb} x1={-half} y1={-depth} x2={-half} y2={depth}/><line className={styles.jamb} x1={half} y1={-depth} x2={half} y2={depth}/></>;
  if (opening.kind === "window") return <>{clear}{jambs}<line className={styles.windowPane} x1={-half} y1={-depth * .55} x2={half} y2={-depth * .55}/><line className={styles.windowPane} x1={-half} y1={depth * .55} x2={half} y2={depth * .55}/></>;
  if (opening.kind === "passage") return <>{clear}{jambs}<path className={styles.passageMark} d={`M ${-half} ${-depth * .6} L ${half} ${-depth * .6} M ${-half} ${depth * .6} L ${half} ${depth * .6}`}/></>;
  if (opening.kind === "gate") return <>{clear}{jambs}<line className={styles.leaf} x1={-half} y1="0" x2={-half} y2={-half}/><line className={styles.leaf} x1={half} y1="0" x2={half} y2={-half}/><path className={styles.swing} d={`M 0 0 A ${half} ${half} 0 0 0 ${-half} ${-half} M 0 0 A ${half} ${half} 0 0 1 ${half} ${-half}`}/></>;
  return <>{clear}{jambs}<line className={styles.leaf} x1={-half} y1="0" x2={-half} y2={-opening.width}/><path className={styles.swing} d={`M ${half} 0 A ${opening.width} ${opening.width} 0 0 0 ${-half} ${-opening.width}`}/></>;
}

function activate(event: KeyboardEvent<SVGGElement>, action: () => void) {
  if (event.key !== "Enter" && event.key !== " ") return;
  event.preventDefault(); event.stopPropagation(); action();
}

function select(callback: ((selection: FeatureSelection, additive?: boolean) => void) | undefined, selection: FeatureSelection, additive: boolean) { if (additive) callback?.(selection, true); else callback?.(selection); }

function StairDiagram({ style, bounds }: { style: NonNullable<VerticalTransition["style"]>; bounds: ReturnType<typeof regionBounds> }) {
  return <>{stairGlyphPrimitives(style, bounds).map((primitive, index) => {
    const className = primitive.className === "tread" ? styles.tread : primitive.className === "direction" ? styles.direction : primitive.className === "flightEdge" ? styles.flightEdge : primitive.className === "stairCore" ? styles.stairCore : styles.stairPost;
    if (primitive.kind === "line") return <line key={index} className={className} x1={primitive.x1} y1={primitive.y1} x2={primitive.x2} y2={primitive.y2}/>;
    if (primitive.kind === "circle") return <circle key={index} className={className} cx={primitive.cx} cy={primitive.cy} r={primitive.r}/>;
    return <path key={index} className={className} d={primitive.d}/>;
  })}</>;
}
