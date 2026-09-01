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

type FeatureSelection = { kind: "opening" | "transition"; id: string };
type FeatureCopy = {
  openingLabel?(kind: WallOpening["kind"], id: string): string;
  transitionLabel?(id: string, kind?: "stairs" | "elevator"): string;
};

export function MapSheetFeatures({ document, prefix, selectedIds, copy, viewportZoom, selectionEnabled = false, selectionOnly = false, selectableOpeningWallIds, selectableTransitionIds, movingIds = new Set(), movingWallIds = new Set(), moveDelta, openingWidthPreview, onSelect, transitionOverrides }: {
  document: ConstructionDocument;
  prefix: string;
  selectedIds: Set<string>;
  copy: FeatureCopy;
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
  transitionOverrides?: readonly { transition: VerticalTransition; transform?: AffineMatrix }[];
}) {
  const walls = new Map(document.walls.map((wall) => [wall.id, wall]));
  const transitionEntries: readonly { transition: VerticalTransition; transform?: AffineMatrix }[] = transitionOverrides ?? document.transitions.map((transition) => ({ transition }));
  return <g className={styles.features}>
    {document.openings.map((storedOpening) => {
      const opening = openingWidthPreview?.id === storedOpening.id ? { ...storedOpening, width: openingWidthPreview.width } : storedOpening; if (opening.visible === false) return null;
      const wall = walls.get(opening.wallId); if (!wall || wall.visible === false) return null;
      const dx = wall.end.x - wall.start.x; const dy = wall.end.y - wall.start.y; const length = Math.hypot(dx, dy); if (!length) return null;
      const x = wall.start.x + dx * opening.position; const y = wall.start.y + dy * opening.position; const angle = Math.atan2(dy, dx) * 180 / Math.PI;
      const label = copy.openingLabel?.(opening.kind, opening.id) ?? opening.id; const inScope = !selectableOpeningWallIds || selectableOpeningWallIds.has(opening.wallId); const selectable = selectionEnabled && inScope && (selectionOnly || !opening.locked);
      const moving = moveDelta && (movingIds.has(opening.id) || movingWallIds.has(opening.wallId));
      return <g key={opening.id} transform={moving ? `translate(${moveDelta.x} ${moveDelta.y})` : undefined}><g className={`${styles.opening}${selectedIds.has(opening.id) ? ` ${styles.selected}` : ""}${selectable ? "" : ` ${styles.context}`}`} transform={`translate(${x} ${y}) rotate(${angle})`} data-selectable={selectable ? "true" : undefined} data-selection-layer={selectable ? "construction" : undefined} data-selection-kind={selectable ? "opening" : undefined} data-selection-id={selectable ? opening.id : undefined} data-feature-id={opening.id} data-opening-kind={opening.kind} role={selectable ? "button" : undefined} tabIndex={selectable ? 0 : undefined} aria-label={selectable ? label : undefined} onClick={selectable ? (event) => { event.stopPropagation(); select(onSelect, { kind: "opening", id: opening.id }, event.ctrlKey || event.metaKey || event.shiftKey); } : undefined} onKeyDown={selectable ? (event) => activate(event, () => onSelect?.({ kind: "opening", id: opening.id })) : undefined}>
        <OpeningMark opening={opening} wallThickness={wall.thickness}/><line className={styles.hit} x1={-opening.width / 2} y1="0" x2={opening.width / 2} y2="0"/>{selectable && selectedIds.has(opening.id) && <><circle className={styles.resizeHandle} cx={-opening.width / 2} cy="0" r={5 / viewportZoom} data-opening-resize={opening.id}/><circle className={styles.resizeHandle} cx={opening.width / 2} cy="0" r={5 / viewportZoom} data-opening-resize={opening.id}/></>}<title>{label}</title>
      </g></g>;
    })}
    {transitionEntries.map(({ transition, transform }) => {
      if (transition.visible === false) return null;
      const patternId = `${prefix}-${transition.kind}-${safeId(transition.id)}`; const clipId = `${patternId}-clip`; const label = copy.transitionLabel?.(transition.id, transition.kind) ?? transition.id; const inScope = !selectableTransitionIds || selectableTransitionIds.has(transition.id); const selectable = selectionEnabled && inScope && !transform && (selectionOnly || !transition.locked); const bounds = regionBounds(transition.footprint);
      const transforms = [transform && matrixAttribute(transform), moveDelta && movingIds.has(transition.id) ? `translate(${moveDelta.x} ${moveDelta.y})` : undefined].filter(Boolean).join(" ") || undefined;
      return <g key={`${transition.id}:${transform ? "context" : "local"}`} transform={transforms} className={`${styles.transition}${selectedIds.has(transition.id) ? ` ${styles.selected}` : ""}${selectable ? "" : ` ${styles.context}`}`} data-selectable={selectable ? "true" : undefined} data-selection-layer={selectable ? "construction" : undefined} data-selection-kind={selectable ? "transition" : undefined} data-selection-id={selectable ? transition.id : undefined} data-feature-id={transition.id} role={selectable ? "button" : undefined} tabIndex={selectable ? 0 : undefined} aria-label={selectable ? label : undefined} onClick={selectable ? (event) => { event.stopPropagation(); select(onSelect, { kind: "transition", id: transition.id }, event.ctrlKey || event.metaKey || event.shiftKey); } : undefined} onKeyDown={selectable ? (event) => activate(event, () => onSelect?.({ kind: "transition", id: transition.id })) : undefined}>
        <defs><pattern id={patternId} width="6" height="6" patternUnits="userSpaceOnUse"><path className={styles.tread} d="M0 0 6 6M6 0 0 6"/></pattern><clipPath id={clipId}><path d={regionPath(transition.footprint)}/></clipPath></defs>
        <path className={`${styles.stairs} ${transition.kind === "elevator" ? styles.elevator : ""}`} d={regionPath(transition.footprint)} fill={transition.kind === "elevator" ? `url(#${patternId})` : undefined}/>{transition.kind === "stairs" && <g clipPath={`url(#${clipId})`} transform={transition.direction ? `rotate(${transition.direction} ${(bounds.minX + bounds.maxX) / 2} ${(bounds.minY + bounds.maxY) / 2})` : undefined}><StairDiagram style={transition.style ?? "straight"} bounds={bounds}/></g>}{selectable && selectedIds.has(transition.id) && (["north-west", "north-east", "south-east", "south-west"] as ResizeCorner[]).map((corner) => { const point = regionCorner(transition.footprint, corner); return <circle key={corner} className={styles.resizeHandle} cx={point.x} cy={point.y} r={5 / viewportZoom} data-resize-corner={corner} data-transition-id={transition.id}/>; })}<title>{label}</title>
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

function safeId(id: string) { return id.replaceAll(/[^a-zA-Z0-9_-]/g, "-"); }
function select(callback: ((selection: FeatureSelection, additive?: boolean) => void) | undefined, selection: FeatureSelection, additive: boolean) { if (additive) callback?.(selection, true); else callback?.(selection); }

function StairDiagram({ style, bounds }: { style: NonNullable<VerticalTransition["style"]>; bounds: ReturnType<typeof regionBounds> }) {
  return <>{stairGlyphPrimitives(style, bounds).map((primitive, index) => {
    const className = primitive.className === "tread" ? styles.tread : primitive.className === "direction" ? styles.direction : primitive.className === "flightEdge" ? styles.flightEdge : primitive.className === "stairCore" ? styles.stairCore : styles.stairPost;
    if (primitive.kind === "line") return <line key={index} className={className} x1={primitive.x1} y1={primitive.y1} x2={primitive.x2} y2={primitive.y2}/>;
    if (primitive.kind === "circle") return <circle key={index} className={className} cx={primitive.cx} cy={primitive.cy} r={primitive.r}/>;
    return <path key={index} className={className} d={primitive.d}/>;
  })}</>;
}
