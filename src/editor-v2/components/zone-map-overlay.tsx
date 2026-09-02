import { memo, useDeferredValue } from "react";
import type { EditorProject } from "../model/project-model";
import { allStoryObjectRefs, canonicalProjectStoryRef, zoneMatchesProject } from "../story/project-adapter";
import { storyRefKey } from "../story/types";
import { storyMapPath } from "./story-map-paths";

/** Narrative ink only: no fill, hit targets, geometry changes or hidden room walls. */
export function ZoneMapOverlay(props: ZoneMapOverlayProps) {
  const layoutZoom = useDeferredValue(props.zoom);
  return <DeferredZoneMapOverlay {...props} zoom={layoutZoom}/>;
}

type ZoneMapOverlayProps = {
  project: EditorProject; activePlaceId: string; zoom: number; selectedZoneId?: string;
};

const DeferredZoneMapOverlay = memo(function DeferredZoneMapOverlay({ project, activePlaceId, zoom, selectedZoneId }: ZoneMapOverlayProps) {
  if (!project.story.zones.length) return null;
  const shapes = allStoryObjectRefs(project).filter((ref) => ref.kind !== "wall").flatMap((ref) => {
    const geometry = storyMapPath(project, activePlaceId, ref, zoom);
    return geometry ? [{ ref, geometry, key: storyRefKey(canonicalProjectStoryRef(project, ref)) }] : [];
  });
  return <g pointerEvents="none" aria-hidden="true" data-zone-overlay="true">{project.story.zones.map((zone) => {
    const members = new Set(zone.members.map(({ ref }) => storyRefKey(canonicalProjectStoryRef(project, ref))));
    const selected = zone.id === selectedZoneId;
    return <g key={zone.id} data-zone-id={zone.id} data-zone-selected={selected || undefined}>{shapes.map(({ ref, geometry, key }) => {
      if (!members.has(key) && !(zone.shape && zoneMatchesProject(project, project.story, zone.id, ref).matches)) return null;
      return <path key={key} d={geometry.path} transform={geometry.transform} fill="none" stroke={zone.color ?? "#9a6a9d"}
        strokeOpacity={selected ? .95 : .5} strokeWidth={selected ? 3 : 1.8} vectorEffect="non-scaling-stroke" strokeDasharray={selected ? undefined : "6 3"}/>;
    })}</g>;
  })}</g>;
});
