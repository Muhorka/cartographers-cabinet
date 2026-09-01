export type WorkLayerId = "terrain" | "roads" | "boundaries" | "buildings" | "construction" | "openings" | "equipment" | "sketch";

export type InstrumentId = "select" | "marquee" | "place" | "pencil" | "pen" | "line" | "wall-run" | "rectangle" | "circle" | "ellipse" | "arc" | "polygon" | "point" | "note" | "erase";
type EraserBehaviour = "cut-region" | "cut-wall" | "erase-sketch" | "delete-object" | "unavailable";
type GeometryMeaning = "region" | "path-or-region" | "place-boundary" | "building-footprint" | "wall-network" | "wall-opening" | "vertical-transition" | "construction-surface" | "object" | "point" | "sketch" | "note";

export type SubjectGroupId = "walls" | "openings" | "vertical-connections" | "platforms";

export type ConstructionCategory = {
  id: SubjectGroupId;
  layerId: Extract<WorkLayerId, "construction" | "openings">;
  defaultSubjectId: string;
};

export type WorkSubject = {
  id: string;
  labelKey: string;
  meaning: GeometryMeaning;
  groupId?: SubjectGroupId;
  instruments?: readonly InstrumentId[];
  defaultInstrumentId?: InstrumentId;
};

export type WorkLayerDefinition = {
  id: WorkLayerId;
  labelKey: string;
  defaultSubjectId: string;
  defaultInstrumentId: InstrumentId;
  instruments: readonly InstrumentId[];
  eraser: EraserBehaviour;
  subjects: readonly WorkSubject[];
};

const regionTools = ["select", "marquee", "pencil", "pen", "line", "rectangle", "circle", "ellipse", "arc", "polygon", "erase"] as const;
const structuralTools = ["select", "marquee", "pencil", "line", "wall-run", "rectangle", "circle", "ellipse", "arc", "polygon", "erase"] as const;
const openingTools = ["select", "marquee", "place", "erase"] as const;
const surfaceTools = ["select", "marquee", "pencil", "pen", "line", "rectangle", "circle", "ellipse", "arc", "polygon", "erase"] as const;

export const workLayers: readonly WorkLayerDefinition[] = [
  {
    id: "roads", labelKey: "layers.roads", defaultSubjectId: "road.paved", defaultInstrumentId: "pencil",
    instruments: ["select", "marquee", "pencil", "pen", "line", "arc", "erase"], eraser: "cut-region",
    subjects: [
      { id: "road.paved", labelKey: "subjects.pavedRoad", meaning: "path-or-region" },
      { id: "road.dirt", labelKey: "subjects.dirtRoad", meaning: "path-or-region" },
      { id: "road.path", labelKey: "subjects.path", meaning: "path-or-region" },
      { id: "road.sidewalk", labelKey: "subjects.sidewalk", meaning: "path-or-region" },
    ],
  },
  {
    id: "terrain", labelKey: "layers.terrain", defaultSubjectId: "terrain.water", defaultInstrumentId: "pencil", instruments: regionTools, eraser: "cut-region",
    subjects: [
      { id: "terrain.water", labelKey: "subjects.water", meaning: "path-or-region" },
      { id: "terrain.river", labelKey: "subjects.river", meaning: "path-or-region" },
      { id: "terrain.stream", labelKey: "subjects.stream", meaning: "path-or-region" },
      { id: "terrain.meadow", labelKey: "subjects.meadow", meaning: "region" },
      { id: "terrain.field", labelKey: "subjects.field", meaning: "region" },
      { id: "terrain.forest", labelKey: "subjects.forest", meaning: "region" },
      { id: "terrain.rocks", labelKey: "subjects.rocks", meaning: "region" },
      { id: "terrain.custom", labelKey: "subjects.customTerrain", meaning: "path-or-region" },
    ],
  },
  {
    id: "boundaries", labelKey: "layers.boundaries", defaultSubjectId: "boundary.place", defaultInstrumentId: "polygon", instruments: regionTools, eraser: "cut-region",
    subjects: [
      { id: "boundary.place", labelKey: "subjects.placeBoundary", meaning: "place-boundary" },
      { id: "boundary.zone", labelKey: "subjects.zone", meaning: "place-boundary" },
      { id: "boundary.custom", labelKey: "subjects.customBoundary", meaning: "place-boundary" },
    ],
  },
  {
    id: "buildings", labelKey: "layers.buildings", defaultSubjectId: "building.building", defaultInstrumentId: "rectangle", instruments: regionTools, eraser: "cut-region",
    subjects: [
      { id: "building.building", labelKey: "subjects.building", meaning: "building-footprint" },
      { id: "building.tower", labelKey: "subjects.tower", meaning: "building-footprint" },
      { id: "building.ruin", labelKey: "subjects.ruin", meaning: "building-footprint" },
      { id: "building.bridge", labelKey: "subjects.bridge", meaning: "building-footprint" },
      { id: "building.custom", labelKey: "subjects.customBuilding", meaning: "building-footprint" },
    ],
  },
  {
    id: "construction", labelKey: "layers.construction", defaultSubjectId: "construction.partition", defaultInstrumentId: "line", instruments: structuralTools, eraser: "cut-wall",
    subjects: [
      { id: "construction.wall", labelKey: "subjects.wall", meaning: "wall-network", groupId: "walls" },
      { id: "construction.partition", labelKey: "subjects.partition", meaning: "wall-network", groupId: "walls" },
      { id: "platform.platform", labelKey: "subjects.platform", meaning: "construction-surface", groupId: "platforms", instruments: surfaceTools, defaultInstrumentId: "rectangle" },
      { id: "platform.porch", labelKey: "subjects.porch", meaning: "construction-surface", groupId: "platforms", instruments: surfaceTools, defaultInstrumentId: "rectangle" },
      { id: "platform.terrace", labelKey: "subjects.terrace", meaning: "construction-surface", groupId: "platforms", instruments: surfaceTools, defaultInstrumentId: "rectangle" },
      { id: "platform.balcony", labelKey: "subjects.balcony", meaning: "construction-surface", groupId: "platforms", instruments: surfaceTools, defaultInstrumentId: "rectangle" },
      { id: "platform.mezzanine", labelKey: "subjects.mezzanine", meaning: "construction-surface", groupId: "platforms", instruments: surfaceTools, defaultInstrumentId: "rectangle" },
      { id: "platform.stage", labelKey: "subjects.stage", meaning: "construction-surface", groupId: "platforms", instruments: surfaceTools, defaultInstrumentId: "rectangle" },
      { id: "platform.custom", labelKey: "subjects.customPlatform", meaning: "construction-surface", groupId: "platforms", instruments: surfaceTools, defaultInstrumentId: "rectangle" },
    ],
  },
  {
    id: "openings", labelKey: "layers.openings", defaultSubjectId: "opening.door", defaultInstrumentId: "place", instruments: openingTools, eraser: "delete-object",
    subjects: [
      { id: "opening.door", labelKey: "subjects.door", meaning: "wall-opening", groupId: "openings" },
      { id: "opening.window", labelKey: "subjects.window", meaning: "wall-opening", groupId: "openings" },
      { id: "opening.gate", labelKey: "subjects.gate", meaning: "wall-opening", groupId: "openings" },
      { id: "opening.passage", labelKey: "subjects.passage", meaning: "wall-opening", groupId: "openings" },
      { id: "opening.stairs", labelKey: "subjects.stairs", meaning: "vertical-transition", groupId: "vertical-connections", instruments: ["select", "marquee", "rectangle", "circle", "ellipse", "polygon", "erase"], defaultInstrumentId: "rectangle" },
      { id: "opening.elevator", labelKey: "subjects.elevator", meaning: "vertical-transition", groupId: "vertical-connections", instruments: ["select", "marquee", "rectangle", "circle", "erase"], defaultInstrumentId: "rectangle" },
    ],
  },
  {
    id: "equipment", labelKey: "layers.equipment", defaultSubjectId: "equipment.furniture", defaultInstrumentId: "rectangle", instruments: ["select", "marquee", "pencil", "pen", "line", "rectangle", "circle", "ellipse", "arc", "polygon", "point", "erase"], eraser: "delete-object",
    subjects: [
      { id: "equipment.furniture", labelKey: "subjects.furniture", meaning: "object" },
      { id: "equipment.object", labelKey: "subjects.object", meaning: "object" },
      { id: "equipment.vegetation", labelKey: "subjects.vegetation", meaning: "object" },
      { id: "equipment.monument", labelKey: "subjects.monument", meaning: "object" },
      { id: "equipment.small-architecture", labelKey: "subjects.smallArchitecture", meaning: "object" },
      { id: "equipment.bridge", labelKey: "subjects.objectBridge", meaning: "object" },
      { id: "equipment.marker", labelKey: "subjects.marker", meaning: "point", instruments: ["select", "marquee", "point", "erase"], defaultInstrumentId: "point" },
      { id: "equipment.custom", labelKey: "subjects.customEquipment", meaning: "object" },
    ],
  },
  {
    id: "sketch", labelKey: "layers.sketch", defaultSubjectId: "sketch.stroke", defaultInstrumentId: "pencil", instruments: ["select", "marquee", "pencil", "pen", "line", "rectangle", "circle", "ellipse", "arc", "polygon", "note", "erase"], eraser: "erase-sketch",
    subjects: [
      { id: "sketch.stroke", labelKey: "subjects.sketch", meaning: "sketch" },
      { id: "sketch.note", labelKey: "subjects.note", meaning: "note", instruments: ["select", "marquee", "note", "erase"], defaultInstrumentId: "note" },
    ],
  },
];

export const visibleWorkLayers = workLayers.filter(({ id }) => id !== "openings");

export const constructionCategories: readonly ConstructionCategory[] = [
  { id: "walls", layerId: "construction", defaultSubjectId: "construction.partition" },
  { id: "openings", layerId: "openings", defaultSubjectId: "opening.door" },
  { id: "vertical-connections", layerId: "openings", defaultSubjectId: "opening.stairs" },
  { id: "platforms", layerId: "construction", defaultSubjectId: "platform.platform" },
];

export function visibleLayerId(layerId: WorkLayerId): WorkLayerId {
  return layerId === "openings" ? "construction" : layerId;
}

export function constructionCategory(layerId: WorkLayerId, subjectId: string) {
  return constructionCategories.find((category) => category.layerId === layerId && getWorkLayer(layerId).subjects.some((subject) => subject.id === subjectId && subject.groupId === category.id))
    ?? constructionCategories[0];
}

const byLayer = new Map(workLayers.map((layer) => [layer.id, layer]));

export function getWorkLayer(id: WorkLayerId) {
  const layer = byLayer.get(id);
  if (!layer) throw new Error(`Unknown work layer: ${id}`);
  return layer;
}

function getWorkSubject(layerId: WorkLayerId, subjectId: string) {
  return getWorkLayer(layerId).subjects.find((subject) => subject.id === subjectId);
}

export function availableInstruments(layerId: WorkLayerId, subjectId: string) {
  const layer = getWorkLayer(layerId);
  return getWorkSubject(layerId, subjectId)?.instruments ?? layer.instruments;
}
