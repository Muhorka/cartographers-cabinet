import { pathAnchors, type EditablePath } from "../geometry/path-anchor-edit";
import styles from "./map-sheet.module.css";

/** Keep every authored anchor reachable; sampling by index hid newly inserted nodes. */
export function PathAnchorHandles({ geometry, elementId, zoom }: { geometry: EditablePath; elementId: string; zoom: number }) {
  return pathAnchors(geometry).map((point, index) => <circle key={index} className={styles.resizeHandle} cx={point.x} cy={point.y} r={2.5 / zoom} data-region-polygon={0} data-region-vertex={index} data-element-id={elementId}/>);
}
