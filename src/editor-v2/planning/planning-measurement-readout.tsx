import { formatAngle, formatAreaMeasurement, formatMeasurement, type GeometryDimensions, type PlanningUnit } from "./planning-measurements";
import styles from "./planning-measurement-readout.module.css";

export type PlanningMeasurementCopy = { width: string; height: string; area: string; angle: string; live: string };
export const defaultPlanningMeasurementCopy: PlanningMeasurementCopy = { width: "Width", height: "Height", area: "Area", angle: "Angle", live: "Live" };

type Props = { dimensions: GeometryDimensions; unit: PlanningUnit; copy?: PlanningMeasurementCopy; live?: boolean };

/** Read-only measurement overlay for an inspector or a pointer preview. */
export function PlanningMeasurementReadout({ dimensions, unit, copy = defaultPlanningMeasurementCopy, live = false }: Props) {
  return <output className={styles.readout} aria-live={live ? "polite" : undefined} data-live={live || undefined}>
    {live && <em>{copy.live}</em>}
    <span><b>{copy.width}</b>{formatMeasurement(dimensions.width, unit)}</span>
    <span><b>{copy.height}</b>{formatMeasurement(dimensions.height, unit)}</span>
    {dimensions.area !== undefined && <span><b>{copy.area}</b>{formatAreaMeasurement(dimensions.area, unit)}</span>}
    {dimensions.angle !== undefined && <span><b>{copy.angle}</b>{formatAngle(dimensions.angle)}</span>}
  </output>;
}
