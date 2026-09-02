import type { DrawingElement } from "../../model/project-model";

function searchableKind(element: DrawingElement) {
  return `${element.subjectId} ${element.tags.join(" ")}`.toLocaleLowerCase();
}

/** These are the only authored element classifications consulted by outdoor routing. */
export function outdoorElementSemantics(element: DrawingElement) {
  const searchable = searchableKind(element);
  const water = element.layerId === "terrain" && ["water", "river", "lake", "stream"].some((value) => searchable.includes(value));
  const barrier = water || ["wall", "fence", "barrier"].some((value) => searchable.includes(value));
  const road = element.layerId === "roads" && (element.geometry.kind === "path" || element.geometry.kind === "bezier");
  const bridge = element.layerId === "equipment" && element.geometry.kind === "region" && searchable.includes("bridge");
  return { water, barrier, road, bridge };
}

export function isWaterTerrainElement(element: DrawingElement) {
  return outdoorElementSemantics(element).water;
}

/** Minimum authored width. Undefined means routing supplies its own fallback. */
export function routeElementWidthCap(element: DrawingElement): number | undefined {
  const candidates = [element.widthMeters, ...(element.widthProfile?.map(({ left, right }) => left + right) ?? [])]
    .filter((value): value is number => value !== undefined);
  return candidates.length ? Math.min(...candidates) : undefined;
}

export function routeElementRibbonWidth(element: DrawingElement, fallback: number) {
  const profile = element.widthProfile?.map(({ left, right }) => left + right);
  return Math.min(element.widthMeters ?? fallback, ...(profile?.length ? profile : [Infinity]));
}
