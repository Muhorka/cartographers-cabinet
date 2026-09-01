"use client";
import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { KernelPoint } from "../geometry/geometry-types";
import type { EditorProject } from "../model/project-model";
import { storyRouteRevision } from "../story/routes/planner";
import type { StoryRouteRecord } from "../story/routes/types";
import type { StoryViewContext } from "../story/types";

type Owner = "route-editor" | "scene-review";
type PointRequest = { endpoint: "from" | "to"; accept(value: { placeId: string; point: KernelPoint }): void };
type Preview = { owner: Owner; route: StoryRouteRecord };
type Interaction = { scope: string; contextKey: string; routeId?: string; selectionVersion: number; token: object; preview: Preview | null; point?: PointRequest };

/** Transient map interactions belong to a particular panel and committed context. */
export function useStoryRouteInteraction({ project, context, mode, owner, activeRouteId, activePlaceId, selectionVersion = 0 }: {
  project?: EditorProject; context: StoryViewContext; mode: "drawing" | "story";
  owner?: Owner; activeRouteId?: string; activePlaceId?: string; selectionVersion?: number;
}) {
  // Session snapshots are immutable; map zoom/pan must not rehash the whole project.
  const revision = useMemo(() => mode === "story" && project ? storyRouteRevision(project) : undefined, [project, mode]);
  const contextKey = JSON.stringify([project?.id, revision, mode, context.scenarioId, context.stepId]);
  const scope = JSON.stringify([contextKey, owner, activeRouteId, selectionVersion]);
  const saved = project?.story.routes.find(({ id }) => id === activeRouteId);
  const [interaction, setInteraction] = useState<Interaction>(() => ({ scope, contextKey, routeId: activeRouteId, selectionVersion, token: {}, preview: saved ? { owner: "route-editor", route: saved } : null }));
  if (interaction.scope !== scope) {
    // Only an explicit route selection may restore a saved record. Invalidation stays null,
    // even when the user later returns to the previous scene, step or panel.
    const selected = interaction.contextKey === contextKey && (interaction.routeId !== activeRouteId || interaction.selectionVersion !== selectionVersion);
    setInteraction({ scope, contextKey, routeId: activeRouteId, selectionVersion, token: {}, preview: selected && saved ? { owner: "route-editor", route: saved } : null });
  }
  const token = interaction.token;
  const committed = useRef<{ token: object; point?: PointRequest } | undefined>(undefined);
  useLayoutEffect(() => {
    committed.current = { token, point: interaction.point };
    return () => { committed.current = undefined; };
  }, [token, interaction.point]);

  const preview = useCallback((source: Owner, route?: StoryRouteRecord) => {
    if (source !== owner || committed.current?.token !== token) return;
    setInteraction((current) => current.token === token ? { ...current, preview: route ? { owner: source, route } : null } : current);
  }, [owner, token]);
  const previewEditor = useCallback((route?: StoryRouteRecord) => preview("route-editor", route), [preview]);
  const previewReview = useCallback((route?: StoryRouteRecord) => preview("scene-review", route), [preview]);
  const requestPoint = useCallback((endpoint: PointRequest["endpoint"], accept: PointRequest["accept"]) => {
    if (owner !== "route-editor" || committed.current?.token !== token) return;
    setInteraction((current) => current.token === token ? { ...current, point: { endpoint, accept } } : current);
  }, [owner, token]);
  const cancelPoint = useCallback(() => {
    if (committed.current?.token !== token) return;
    committed.current.point = undefined;
    setInteraction((current) => current.token === token ? { ...current, point: undefined } : current);
  }, [token]);
  const point = interaction.scope === scope && owner === "route-editor" ? interaction.point : undefined;
  const pointPicker = point && activePlaceId ? {
    onPick(value: KernelPoint) {
      if (committed.current?.token !== token || committed.current.point !== point) return;
      cancelPoint(); point.accept({ placeId: activePlaceId, point: value });
    },
    cancel: cancelPoint,
  } : undefined;
  return { route: interaction.scope === scope ? interaction.preview?.route : undefined, previewEditor, previewReview, requestPoint, pointPicker, pointRequest: point, cancelPoint };
}
