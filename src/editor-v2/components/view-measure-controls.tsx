import type { ProjectMeasureSettings } from "../model/project-model";
import type { MapSheetCopy } from "./map-sheet-types";
import styles from "./map-sheet.module.css";

type MeasurementCopy = NonNullable<MapSheetCopy["measurements"]>;
export const fallbackMeasurementCopy: MeasurementCopy = { title: "View & measurements", grid: "Grid", opacity: "Opacity", spacing: "Spacing", snap: "Snap to grid", units: "Units", metric: "metres", imperial: "feet", roomAreas: "Object areas" };

export function ViewMeasureControls({ settings, copy, onChange }: { settings: ProjectMeasureSettings; copy: MeasurementCopy; onChange?(settings: ProjectMeasureSettings): void }) {
  const change = (patch: Partial<ProjectMeasureSettings>) => onChange?.({ ...settings, ...patch });
  return <details className={styles.measureControls}><summary>{copy.title}</summary><div>
    <label><input type="checkbox" checked={settings.gridVisible} onChange={(event) => change({ gridVisible: event.currentTarget.checked })}/><span>{copy.grid}</span></label>
    <label><input type="checkbox" checked={settings.showAxes} onChange={(event) => change({ showAxes: event.currentTarget.checked })}/><span>{copy.axes ?? "Show axes"}</span></label>
    <label><span>{copy.opacity}</span><input type="range" min="0" max="1" step="any" value={settings.gridOpacity} onChange={(event) => change({ gridOpacity: Number(event.currentTarget.value) })}/></label>
    <label><span>{copy.spacing}</span><input type="number" min="0.1" max="1000" step="0.1" value={settings.gridSpacingMeters} onChange={(event) => { const value = Number(event.currentTarget.value); if (Number.isFinite(value) && value > 0) change({ gridSpacingMeters: value }); }}/></label>
    <output>{copy.cell ?? "1 cell"}: {settings.gridSpacingMeters} {settings.units === "metric" ? copy.metric : copy.imperial}</output>
    <label><input type="checkbox" checked={settings.snapToGrid} onChange={(event) => change({ snapToGrid: event.currentTarget.checked })}/><span>{copy.snap}</span></label>
    <label><span>{copy.units}</span><select value={settings.units} onChange={(event) => change({ units: event.currentTarget.value as ProjectMeasureSettings["units"] })}><option value="metric">{copy.metric}</option><option value="imperial">{copy.imperial}</option></select></label>
    <label><input type="checkbox" checked={settings.showRoomAreas} onChange={(event) => change({ showRoomAreas: event.currentTarget.checked })}/><span>{copy.roomAreas}</span></label>
  </div></details>;
}
