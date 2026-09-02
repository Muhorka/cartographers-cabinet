import { constructionNetwork } from "../construction/construction-network";

import { memo, useMemo } from "react";
import type { EditorProject } from "../model/project-model";
import { constructionPlaceForView, matrixAttribute, relativePlaceMatrix, roomEditingScope, visiblePlaceGroups } from "./map-sheet-geometry";
import { MapSheetConstruction } from "./map-sheet-construction";
import { MapSheetElements } from "./map-sheet-elements";
import { PlaceShape } from "./map-sheet-shapes";
import { createSceneLabelPlan } from "./map-sheet-scene";
import type { MapSheetCopy } from "./map-sheet-types";
import styles from "./map-sheet.module.css";

const noMovingIds = new Set<string>();

export const MapSheetTracing = memo(function MapSheetTracing({ project, activePlaceId, prefix, copy, viewportZoom, labelLayoutZoom, opacity }: { project: EditorProject; activePlaceId: string; prefix: string; copy: MapSheetCopy; viewportZoom: number; labelLayoutZoom: number; opacity: number }) {
  const groups = useMemo(() => visiblePlaceGroups(project, activePlaceId), [activePlaceId, project]);
  const owner = useMemo(() => constructionPlaceForView(project, activePlaceId), [activePlaceId, project]);
  const document = useMemo(() => project.constructions.find(({ id }) => id === owner?.constructionId), [owner?.constructionId, project.constructions]);
  const network = useMemo(() => document ? constructionNetwork(document.walls, document.enclosure) : undefined, [document]);
  const labelPlan = useMemo(() => createSceneLabelPlan(project, activePlaceId, groups, document, network, owner, labelLayoutZoom, false, project.measureSettings.units, true, noMovingIds), [activePlaceId, document, groups, labelLayoutZoom, network, owner, project]);
  if (!groups.active) return null;
  const roomView = groups.active.kind === "room";
  const roomScope = roomView ? roomEditingScope(groups.active, document, network) : {};
  const shape = (place: (typeof project.places)[number], mode: "active" | "child" | "context" | "descendant") => <PlaceShape key={place.id} place={place} mode={mode} prefix={prefix} viewportZoom={viewportZoom} labelScope={activePlaceId} labelPlan={labelPlan} transform={place.id === activePlaceId ? undefined : matrixAttribute(relativePlaceMatrix(project, activePlaceId, place.id))}/>;
  return <g className={styles.tracing} style={{ opacity }} data-tracing-overlay="true" aria-hidden="true">
    <MapSheetElements project={project} activePlaceId={activePlaceId} terrain prefix={prefix} selected={noMovingIds} movingIds={noMovingIds} selectionEditing={false} sketchVisible sketchOpacity={1} viewportZoom={viewportZoom} labelPlan={labelPlan}/>
    {groups.context.filter(({ kind }) => kind !== "level").map((place) => shape(place, "context"))}
    {groups.active.boundary && shape(groups.active, "active")}
    {groups.children.filter(({ kind }) => kind !== "room" && !(groups.active?.kind === "building" && kind === "level")).map((place) => shape(place, "child"))}
    {groups.descendants.map((place) => shape(place, "descendant"))}
    {network && document && <MapSheetConstruction project={project} document={document} network={network} owner={owner} prefix={prefix} copy={copy} selectedIds={noMovingIds} viewportZoom={viewportZoom} roomView={roomView} roomScope={roomScope} activeGesture={false} selectionEditing={false} movingIds={noMovingIds} labelPlan={labelPlan}/>}
    <MapSheetElements project={project} activePlaceId={activePlaceId} terrain={false} prefix={prefix} selected={noMovingIds} movingIds={noMovingIds} selectionEditing={false} sketchVisible sketchOpacity={1} viewportZoom={viewportZoom} labelPlan={labelPlan}/>
  </g>;
});
