import { z } from "zod";
import { storyDataSchema } from "../story/schema";
import { isRibbonSubject } from "../geometry/ribbon-geometry";
import { defaultMeasureSettings, normalizeEditorProject, type EditorProject } from "../model/project-model";
import { validateProjectRelations } from "./project-relations";
export const PROJECT_FILE_FORMAT = "cartographers-cabinet.project";
export const PROJECT_FILE_VERSION = 1;
export const PROJECT_FILE_MIME_TYPE = "application/vnd.cartographers-cabinet.project+json";
export const MAX_PROJECT_FILE_BYTES = 25 * 1024 * 1024;
const shortText = z.string().max(512);
const identifier = z.string().trim().min(1).max(512);
const description = z.string().max(100_000);
const finiteNumber = z.number().finite().min(-1_000_000_000).max(1_000_000_000);
const positiveNumber = finiteNumber.positive();
const point = z.object({ x: finiteNumber, y: finiteNumber }).strict();
const roadJunction = z.object({ id: identifier, belongsToId: identifier, point, roadIds: z.array(identifier).min(2).max(32) }).strict();
const bezierNode = z.object({ anchor: point, inHandle: point.optional(), outHandle: point.optional() }).strict();
const stringList = z.array(shortText).max(10_000);
const propertyValue = z.union([z.string().max(100_000), finiteNumber, z.boolean(), z.null()]);
const properties = z.record(z.string().max(512), propertyValue).superRefine((value, context) => {
  if (Object.keys(value).length > 10_000) context.addIssue({ code: "custom", message: "Too many custom properties." });
  for (const key of Object.keys(value)) if (["__proto__", "prototype", "constructor"].includes(key)) {
    context.addIssue({ code: "custom", message: `Unsafe property name: ${key}` });
  }
});
const polygon = z.object({
  outer: z.array(point).min(3).max(100_000),
  holes: z.array(z.array(point).min(3).max(100_000)).max(10_000),
}).strict();
const regionShape = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("polygon"), points: z.array(point).min(3).max(100_000) }).strict(),
  z.object({ kind: z.literal("rectangle"), x: finiteNumber, y: finiteNumber, width: positiveNumber, height: positiveNumber }).strict(),
  z.object({ kind: z.literal("circle"), cx: finiteNumber, cy: finiteNumber, radius: positiveNumber }).strict(),
  z.object({ kind: z.literal("ellipse"), cx: finiteNumber, cy: finiteNumber, rx: positiveNumber, ry: positiveNumber }).strict(),
  z.object({ kind: z.literal("bezier"), nodes: z.array(bezierNode).min(2).max(100_000), closed: z.literal(true) }).strict(),
  z.object({ kind: z.literal("compound"), polygons: z.array(polygon).min(1).max(10_000) }).strict(),
]);
const appearance = z.object({
  fillColor: z.string().regex(/^#[0-9a-f]{6}$/i).optional(),
  fillOpacity: z.number().finite().min(0).max(1).optional(),
}).strict();
const place = z.object({
  id: identifier,
  parentId: identifier.optional(),
  name: shortText,
  description: description.optional(),
  kind: z.enum(["world", "location", "building", "level", "room", "object", "standalone-room", "custom"]),
  transform: z.object({ x: finiteNumber, y: finiteNumber, rotation: finiteNumber }).strict(),
  boundary: regionShape.optional(),
  constructionId: identifier.optional(),
  order: z.number().int().finite().min(-100_000).max(100_000).optional(),
  tags: stringList,
  access: stringList,
  properties,
  appearance: appearance.optional(),
  visible: z.boolean().optional(), locked: z.boolean().optional(),
}).strict();
const drawingGeometry = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("region"), shape: regionShape }).strict(),
  z.object({ kind: z.literal("path"), points: z.array(point).min(1).max(100_000), closed: z.boolean() }).strict(),
  z.object({ kind: z.literal("bezier"), nodes: z.array(bezierNode).min(1).max(100_000), closed: z.boolean() }).strict(),
  z.object({ kind: z.literal("point"), at: point }).strict(),
  z.object({ kind: z.literal("note"), at: point, text: description, width: finiteNumber.positive().optional(), height: finiteNumber.positive().optional(), rotation: finiteNumber.optional() }).strict(),
]);
const widthProfile = z.array(z.object({ t: z.number().finite().min(0).max(1), left: z.number().finite().positive().max(500), right: z.number().finite().positive().max(500) }).strict()).max(1000).superRefine((profile, context) => { for (let index = 1; index < profile.length; index += 1) if (profile[index]!.t <= profile[index - 1]!.t) context.addIssue({ code: "custom", message: "Road width profile positions must be strictly increasing.", path: [index, "t"] }); });
const drawingElement = z.object({
  id: identifier,
  belongsToId: identifier,
  name: shortText,
  description: description.optional(),
  layerId: z.enum(["terrain", "roads", "equipment", "sketch"]),
  widthMeters: z.number().finite().positive().max(1000).optional(),
  widthProfile: widthProfile.optional(),
  ribbonCutouts: z.array(regionShape).max(1000).optional(),
  subjectId: identifier,
  geometry: drawingGeometry,
  visible: z.boolean(),
  locked: z.boolean(),
  tags: stringList,
  access: stringList,
  properties,
  appearance: appearance.optional(),
}).strict().superRefine((element, context) => { if (isRibbonSubject(element.layerId, element.subjectId) && element.geometry.kind !== "path" && element.geometry.kind !== "bezier") context.addIssue({ code: "custom", message: "Ribbon subjects must use path or bezier geometry.", path: ["geometry", "kind"] }); if (!isRibbonSubject(element.layerId, element.subjectId) && element.ribbonCutouts) context.addIssue({ code: "custom", message: "Ribbon cutouts are only valid on ribbon elements.", path: ["ribbonCutouts"] }); });
const constructionSurface = z.object({
  id: identifier,
  belongsToId: identifier,
  name: shortText,
  description: description.optional(),
  kind: z.enum(["platform", "porch", "terrace", "balcony", "mezzanine", "stage", "custom"]),
  shape: regionShape,
  attachment: z.enum(["free", "attached"]),
  elevation: finiteNumber,
  visible: z.boolean(),
  locked: z.boolean(),
  tags: stringList,
  access: stringList,
  properties,
  appearance: appearance.optional(),
}).strict();
const measureSettings = z.object({
  units: z.enum(["metric", "imperial"]),
  gridVisible: z.boolean(), showAxes: z.boolean().default(false),
  gridOpacity: z.number().finite().min(0).max(1),
  gridSpacingMeters: positiveNumber,
  snapToGrid: z.boolean(),
  showRoomAreas: z.boolean(),
  pencilSmoothing: z.number().finite().min(0).max(1).default(.25),
}).strict();
const wall = z.object({
  id: identifier,
  start: point,
  end: point,
  thickness: positiveNumber,
  role: z.enum(["boundary", "wall", "partition"]),
  visible: z.boolean().optional(), locked: z.boolean().optional(),
}).strict();
const room = z.object({
  id: identifier,
  faceId: identifier,
  name: shortText,
  description: description.optional(),
  tags: stringList,
  access: stringList,
  properties,
  visible: z.boolean().optional(), locked: z.boolean().optional(),
  appearance: appearance.optional(),
}).strict().transform((roomValue) => { const cleaned = { ...roomValue }; delete cleaned.appearance; return cleaned; });
const opening = z.object({
  id: identifier,
  kind: z.enum(["door", "window", "gate", "passage"]),
  wallId: identifier,
  position: z.number().finite().min(0).max(1),
  width: positiveNumber,
  visible: z.boolean().optional(), locked: z.boolean().optional(),
}).strict();
const transition = z.object({
  id: identifier,
  kind: z.enum(["stairs", "elevator"]),
  footprint: regionShape,
  sourceLevelId: identifier.optional(),
  targetLevelId: identifier.optional(),
  connectedLevelIds: z.array(identifier).max(100).optional(),
  style: z.enum(["straight", "l", "u", "spiral", "curved"]).optional(),
  direction: z.number().finite().optional(),
  sameLevelRise: z.boolean().optional(),
  visible: z.boolean().optional(), locked: z.boolean().optional(),
}).strict();
const construction = z.object({
  id: identifier,
  revision: z.number().int().finite().nonnegative(),
  walls: z.array(wall).max(200_000),
  rooms: z.array(room).max(100_000),
  openings: z.array(opening).max(100_000),
  transitions: z.array(transition).max(100_000),
  enclosure: regionShape.optional(),
}).strict();

const rawEditorProjectSchema = z.object({
  schemaVersion: z.union([z.literal(7), z.literal(8), z.literal(9)]),
  id: identifier,
  name: shortText.refine((value) => Boolean(value.trim()), "Project name cannot be empty."),
  updatedAt: z.iso.datetime({ offset: true }),
  places: z.array(place).max(100_000),
  elements: z.array(drawingElement).max(200_000),
  surfaces: z.array(constructionSurface).max(100_000).optional(),
  constructions: z.array(construction).max(100_000),
  measureSettings: measureSettings.optional(),
  roadJunctions: z.array(roadJunction).max(100_000).optional(),
  story: storyDataSchema.optional(),
}).strict();

export const editorProjectSchema = rawEditorProjectSchema
  .transform((project) => normalizeEditorProject({ ...project, surfaces: project.surfaces ?? [], measureSettings: project.measureSettings ?? defaultMeasureSettings() } as Parameters<typeof normalizeEditorProject>[0]))
  .superRefine(validateProjectRelations);

export type ProjectFileEnvelope = {
  format: typeof PROJECT_FILE_FORMAT;
  fileVersion: typeof PROJECT_FILE_VERSION;
  exportedAt: string;
  project: EditorProject;
};

const projectFileEnvelopeSchema = z.object({
  format: z.literal(PROJECT_FILE_FORMAT),
  fileVersion: z.literal(PROJECT_FILE_VERSION),
  exportedAt: z.iso.datetime({ offset: true }),
  project: editorProjectSchema,
}).strict();

function createProjectFileEnvelope(project: EditorProject, exportedAt = new Date().toISOString()): ProjectFileEnvelope {
  return projectFileEnvelopeSchema.parse({ format: PROJECT_FILE_FORMAT, fileVersion: PROJECT_FILE_VERSION, exportedAt, project });
}
export function serializeProjectFile(project: EditorProject, exportedAt?: string) {
  return JSON.stringify(createProjectFileEnvelope(project, exportedAt), null, 2);
}

export function parseProjectFile(source: string | unknown): ProjectFileEnvelope {
  if (typeof source === "string" && new TextEncoder().encode(source).byteLength > MAX_PROJECT_FILE_BYTES) throw new Error("Project file is too large.");
  let value: unknown = source;
  if (typeof source === "string") {
    try { value = JSON.parse(source) as unknown; }
    catch { throw new Error("Project file is not valid JSON."); }
  }
  return projectFileEnvelopeSchema.parse(value);
}

export function cloneImportedProject(project: EditorProject, newProjectId: string, importedAt = new Date().toISOString()): EditorProject {
  const source = editorProjectSchema.parse(project);
  if (!newProjectId.trim() || newProjectId === source.id) throw new Error("Imported project needs a fresh identifier.");
  return editorProjectSchema.parse({ ...structuredClone(source), id: newProjectId, updatedAt: importedAt });
}

export function renameProject(project: EditorProject, name: string, changedAt = new Date().toISOString()): EditorProject {
  const nextName = name.trim();
  if (!nextName) throw new Error("Project name cannot be empty.");
  return editorProjectSchema.parse({ ...structuredClone(project), name: nextName, updatedAt: changedAt });
}
export function projectExportFileName(projectName: string) {
  const safe = projectName.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `${safe || "project"}.cartographer.json`;
}
