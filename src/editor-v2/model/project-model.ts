import type { ConstructionDocument } from "../construction/construction-document";
import type { BezierNode, KernelPoint } from "../geometry/geometry-types";
import type { WorkLayerId } from "../toolbox/toolbox-model";
import { emptyStoryData, type StoryData } from "../story/types";
import { migrateStoryData } from "../story/migration";

export type RegionShape =
  | { kind: "polygon"; points: KernelPoint[] }
  | { kind: "rectangle"; x: number; y: number; width: number; height: number }
  | { kind: "circle"; cx: number; cy: number; radius: number }
  | { kind: "ellipse"; cx: number; cy: number; rx: number; ry: number }
  | { kind: "bezier"; nodes: BezierNode[]; closed: true }
  | { kind: "compound"; polygons: RegionPolygon[] };

export type RegionPolygon = { outer: KernelPoint[]; holes: KernelPoint[][] };

export type MapAppearance = { fillColor?: string; fillOpacity?: number };

export type ConstructionSurfaceKind = "platform" | "porch" | "terrace" | "balcony" | "mezzanine" | "stage" | "custom";

export type ConstructionSurface = {
  id: string;
  belongsToId: string;
  name: string;
  description?: string;
  kind: ConstructionSurfaceKind;
  shape: RegionShape;
  attachment: "free" | "attached";
  elevation: number;
  visible: boolean;
  locked: boolean;
  tags: string[];
  access: string[];
  properties: Record<string, string | number | boolean | null>;
  appearance?: MapAppearance;
};

export type ProjectMeasureSettings = {
  units: "metric" | "imperial";
  gridVisible: boolean;
  showAxes: boolean;
  gridOpacity: number;
  gridSpacingMeters: number;
  snapToGrid: boolean;
  showRoomAreas: boolean;
  pencilSmoothing: number;
};

type PlaceKind = "world" | "location" | "building" | "level" | "room" | "object" | "standalone-room" | "custom";

export type PlaceNode = {
  id: string;
  parentId?: string;
  name: string;
  description?: string;
  kind: PlaceKind;
  transform: { x: number; y: number; rotation: number };
  boundary?: RegionShape;
  constructionId?: string;
  order?: number;
  tags: string[];
  access: string[];
  properties: Record<string, string | number | boolean | null>;
  appearance?: MapAppearance;
  visible?: boolean;
  locked?: boolean;
};

type DrawingGeometry =
  | { kind: "region"; shape: RegionShape }
  | { kind: "path"; points: KernelPoint[]; closed: boolean }
  | { kind: "bezier"; nodes: BezierNode[]; closed: boolean }
  | { kind: "point"; at: KernelPoint }
  /** A note keeps `at` for backwards compatibility; new notes also carry a drawn box. */
  | { kind: "note"; at: KernelPoint; text: string; width?: number; height?: number; rotation?: number };

export type DrawingElement = {
  id: string;
  belongsToId: string;
  name: string;
  description?: string;
  layerId: Extract<WorkLayerId, "terrain" | "roads" | "equipment" | "sketch">;
  widthMeters?: number;
  widthProfile?: { t: number; left: number; right: number }[];
  ribbonCutouts?: RegionShape[];
  subjectId: string;
  geometry: DrawingGeometry;
  visible: boolean;
  locked: boolean;
  tags: string[];
  access: string[];
  properties: Record<string, string | number | boolean | null>;
  appearance?: MapAppearance;
};

/** A persistent centre-line crossing. Roads remain independent and editable. */
export type RoadJunction = {
  id: string;
  belongsToId: string;
  point: KernelPoint;
  roadIds: string[];
};

export type EditorProject = {
  /** Canonical editor document. v7/v8 are accepted only at import boundaries. */
  schemaVersion: 9;
  id: string;
  name: string;
  updatedAt: string;
  places: PlaceNode[];
  elements: DrawingElement[];
  surfaces: ConstructionSurface[];
  constructions: ConstructionDocument[];
  measureSettings: ProjectMeasureSettings;
  roadJunctions?: RoadJunction[];
  story: StoryData;
};

export type LegacyEditorProject = Omit<EditorProject, "schemaVersion" | "story"> & { schemaVersion: 7 | 8; story?: StoryData };

export function emptyProject(id: string, name: string): EditorProject {
  return { schemaVersion: 9, id, name, updatedAt: new Date(0).toISOString(), places: [], elements: [], surfaces: [], constructions: [], measureSettings: defaultMeasureSettings(), roadJunctions: [], story: emptyStoryData() };
}

export function defaultMeasureSettings(): ProjectMeasureSettings {
  return { units: "metric", gridVisible: false, showAxes: false, gridOpacity: .18, gridSpacingMeters: 1, snapToGrid: false, showRoomAreas: false, pencilSmoothing: .25 };
}

export function normalizeEditorProject(project: EditorProject | LegacyEditorProject | (Omit<EditorProject, "schemaVersion" | "surfaces" | "measureSettings" | "story"> & { schemaVersion: 7; surfaces?: ConstructionSurface[]; measureSettings?: ProjectMeasureSettings; story?: StoryData })): EditorProject {
  const cloned = structuredClone(project); const roadIds = new Set(cloned.elements.filter(({ layerId }) => layerId === "roads").map(({ id }) => id));
  return { ...cloned, schemaVersion: 9, surfaces: structuredClone(project.surfaces ?? []), measureSettings: { ...defaultMeasureSettings(), ...project.measureSettings }, roadJunctions: structuredClone(project.roadJunctions ?? []).filter(({ roadIds: ids }) => ids.length >= 2 && ids.every((id) => roadIds.has(id))), story: migrateStoryData(project.story) };
}
