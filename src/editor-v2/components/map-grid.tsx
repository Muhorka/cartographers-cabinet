import type { ProjectMeasureSettings } from "../model/project-model";
import type { SheetViewport } from "./map-sheet-geometry";
import styles from "./map-sheet.module.css";

export function MapGrid({ prefix, settings, viewport, sheetSize }: { prefix: string; settings: ProjectMeasureSettings; viewport: SheetViewport; sheetSize: { width: number; height: number } }) {
  if (!settings.gridVisible && !settings.showAxes) return null;
  const base = settings.gridSpacingMeters; const apparent = Math.max(.001, base * viewport.zoom);
  const majorMultiplier = [5, 10, 20, 50, 100, 200, 500, 1000].find((value) => apparent * value >= 54) ?? 1000;
  const minor = apparent >= 48 ? base / 10 : undefined; const major = base * majorMultiplier;
  const area = { x: viewport.center.x - sheetSize.width / Math.max(viewport.zoom, .001), y: viewport.center.y - sheetSize.height / Math.max(viewport.zoom, .001), width: sheetSize.width * 2 / Math.max(viewport.zoom, .001), height: sheetSize.height * 2 / Math.max(viewport.zoom, .001) };
  const pattern = (id: string, spacing: number, className: string) => <pattern id={id} width={spacing} height={spacing} patternUnits="userSpaceOnUse"><path d={`M ${spacing} 0 L 0 0 0 ${spacing}`} className={className}/></pattern>;
  return <g className={styles.grid} style={{ opacity: settings.gridOpacity }} aria-hidden="true"><defs>{minor && pattern(`${prefix}-grid-minor`, minor, styles.gridMinor)}{pattern(`${prefix}-grid-base`, base, styles.gridLine)}{pattern(`${prefix}-grid-major`, major, styles.gridMajor)}</defs>{settings.gridVisible && <>{minor && <rect {...area} fill={`url(#${prefix}-grid-minor)`}/>}<rect {...area} fill={`url(#${prefix}-grid-base)`}/><rect {...area} fill={`url(#${prefix}-grid-major)`}/></>}{settings.showAxes && <><line className={styles.gridAxis} x1={area.x} y1="0" x2={area.x + area.width} y2="0"/><line className={styles.gridAxis} x1="0" y1={area.y} x2="0" y2={area.y + area.height}/></>}</g>;
}
