import type { BuildingMergeMode } from "../drawing/building-overlap-operations";
import type { WorkbenchCopy } from "../i18n/workbench-copy";
import { DrawingNotice } from "./drawing-notice";

export function OverlapNotice({ copy, mustResolve, onMerge, onResume }: { copy: WorkbenchCopy["overlapDecision"]; mustResolve: boolean; onMerge(mode: BuildingMergeMode): void; onResume(): void }) {
  return <DrawingNotice notice={{
    message: mustResolve ? copy.mustResolve : copy.arranging, tone: "warning",
    actions: [
      { id: "merge-outer", label: copy.outerOnly, primary: true, onClick: () => onMerge("outer-only") },
      { id: "merge-partitions", label: copy.keepPartitions, onClick: () => onMerge("keep-partitions") },
      { id: "keep-arranging", label: copy.continueArranging, onClick: onResume },
    ],
  }}/>;
}
