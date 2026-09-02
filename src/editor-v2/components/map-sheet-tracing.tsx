import { constructionNetwork } from "../construction/construction-network";

import { memo } from "react";
import type { EditorProject } from "../model/project-model";
import { constructionPlaceForView, matrixAttribute, relativePlaceMatrix, roomEditingScope, visiblePlaceGroups } from "./map-sheet-geometry";
import { MapSheetConstruction } from "./map-sheet-construction";
import { MapSheetElements } from "./map-sheet-elements";
import { PlaceShape } from "./map-sheet-shapes";
import type { MapSheetCopy } from "./map-sheet-types";
import styles from "./map-sheet.module.css";

export const MapSheetTracing = memo(function MapSheetTracing({ project, activePlaceId, prefix, copy, viewportZoom, opacity }: { project: EditorProject; activePlaceId: string; prefix: string; copy: MapSheetCopy; viewportZoom: number; opacity: number }) {
  const groups = visiblePlaceGroups(project, activePlaceId); if (!groups.active) return null;
  const owner = constructionPlaceForView(project, activePlaceId);
  const document = project.constructions.find(({ id }) => id === owner?.constructionId);
  const network = document ? constructionNetwork(document.walls, document.enclosure) : undefined;
  const roomView = groups.active.kind === "room";
  const roomScope = roomView ? roomEditingScope(groups.active, document, network) : {};
  const shape = (place: (typeof project.places)[number], mode: "active" | "child" | "context" | "descendant") => <PlaceShape key={place.id} place={place} mode={mode} prefix={prefix} viewportZoom={viewportZoom} transform={place.id === activePlaceId ? undefined : matrixAttribute(relativePlaceMatrix(project, activePlaceId, place.id))}/>;
  return <g className={styles.tracing} style={{ opacity }} data-tracing-overlay="true" aria-hidden="true">
    <MapSheetElements project={project} activePlaceId={activePlaceId} terrain prefix={prefix} selected={new Set()} movingIds={new Set()} selectionEditing={false} sketchVisible sketchOpacity={1} viewportZoom={viewportZoom}/>
    {groups.context.filter(({ kind }) => kind !== "level").map((place) => shape(place, "context"))}
    {groups.active.boundary && shape(groups.active, "active")}
    {groups.children.filter(({ kind }) => kind !== "room" && !(groups.active?.kind === "building" && kind === "level")).map((place) => shape(place, "child"))}
    {groups.descendants.map((place) => shape(place, "descendant"))}
    {network && document && <MapSheetConstruction project={project} document={document} network={network} owner={owner} prefix={prefix} copy={copy} selectedIds={new Set()} viewportZoom={viewportZoom} roomView={roomView} roomScope={roomScope} activeGesture={false} selectionEditing={false} movingIds={new Set()}/>}
    <MapSheetElements project={project} activePlaceId={activePlaceId} terrain={false} prefix={prefix} selected={new Set()} movingIds={new Set()} selectionEditing={false} sketchVisible sketchOpacity={1} viewportZoom={viewportZoom}/>
  </g>;
});
