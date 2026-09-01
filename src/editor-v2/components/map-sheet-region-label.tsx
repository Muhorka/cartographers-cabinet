import type { RegionLabelLayout } from "../geometry/region-label-layout";
import styles from "./map-sheet.module.css";

/** One renderer for every named region on the sheet. */
export function MapSheetRegionLabel({ layout, clipId, pathId }: { layout: RegionLabelLayout; clipId: string; pathId: string }) {
  if (layout.kind === "boundary") return <text className={`${styles.label} ${styles.boundaryLabel}`} style={{ fontSize: layout.fontSize, strokeWidth: layout.fontSize * .12 }} textLength={layout.textLength} lengthAdjust="spacing"><textPath href={`#${pathId}`} startOffset="50%">{layout.text}</textPath></text>;
  // The clip stays in map coordinates; only the lettering rotates inside it.
  const rotation = layout.rotation ? `rotate(${layout.rotation} ${layout.x} ${layout.y})` : undefined;
  return <g clipPath={`url(#${clipId})`}><text className={styles.label} style={{ fontSize: layout.fontSize, strokeWidth: layout.fontSize * .12 }} x={layout.x} y={layout.y + (layout.nameOffsetY ?? 0)} textLength={layout.textLength} lengthAdjust="spacing" transform={rotation}>{layout.text}</text>{layout.secondaryLine && <text className={styles.label} x={layout.x} y={layout.y + layout.secondaryLine.offsetY} style={{ fontSize: layout.secondaryLine.fontSize, strokeWidth: layout.secondaryLine.fontSize * .12 }} textLength={layout.secondaryLine.textLength} lengthAdjust="spacing" transform={rotation}>{layout.secondaryLine.text}</text>}</g>;
}
