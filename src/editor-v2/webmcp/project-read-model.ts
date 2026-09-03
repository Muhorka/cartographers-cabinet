import { constructionNetwork } from "../construction/construction-network";
import { validateVerticalTransitions, wallFeatureIssues } from "../construction/wall-features";

import type { EditorProject } from "../model/project-model";
import { editorProjectSchema } from "../persistence/project-file";
import { constructionPlaceForView, elementContextDepth, surfaceContextDepth, visiblePlaceGroups } from "../components/map-sheet-geometry";
import { availableWorkSubjects } from "../model/work-context";
import { validContainingPlaces, validElementOwners } from "../model/hierarchy-operations";
import { constructionCategories, workLayers } from "../toolbox/toolbox-model";

export type ProjectObjectType = "place" | "room" | "element" | "surface" | "wall" | "opening" | "transition";
type ProjectObjectRef = { type: ProjectObjectType; id: string; scopeId?: string };
export type ProjectObjectRecord = {
  ref: ProjectObjectRef;
  name: string;
  kind: string;
  ownerId?: string;
  description?: string;
  tags: string[];
  layerId?: string;
  subjectId?: string;
  properties?: Record<string, string | number | boolean | null>;
};

function constructionOwner(project: EditorProject, constructionId: string) {
  return project.places.find((place) => place.constructionId === constructionId);
}

function projectObjectRecords(project: EditorProject): ProjectObjectRecord[] {
  const records: ProjectObjectRecord[] = project.places.filter(({ kind }) => kind !== "room").map((place) => ({
    ref: { type: "place", id: place.id }, name: place.name, kind: place.kind, ownerId: place.parentId,
    description: place.description, tags: place.tags, properties: place.properties,
  }));
  records.push(...project.elements.map((element) => ({
    ref: { type: "element" as const, id: element.id }, name: element.name, kind: element.geometry.kind,
    ownerId: element.belongsToId, description: element.description, tags: element.tags, layerId: element.layerId,
    subjectId: element.subjectId, properties: element.properties,
  })));
  records.push(...project.surfaces.map((surface) => ({
    ref: { type: "surface" as const, id: surface.id }, name: surface.name, kind: surface.kind,
    ownerId: surface.belongsToId, description: surface.description, tags: surface.tags,
    layerId: "construction", subjectId: `platform.${surface.kind}`,
    properties: { ...surface.properties, attachment: surface.attachment, elevation: surface.elevation, visible: surface.visible, locked: surface.locked },
  })));
  const representedRooms = new Set<string>();
  for (const construction of project.constructions) {
    const owner = constructionOwner(project, construction.id); const scopeId = owner?.id ?? construction.id;
    for (const room of construction.rooms) {
      representedRooms.add(room.id); const place = project.places.find(({ id }) => id === room.id);
      records.push({ ref: { type: "room", id: room.id, scopeId }, name: place?.name ?? room.name, kind: "room", ownerId: owner?.id, description: place?.description ?? room.description, tags: place?.tags ?? room.tags, properties: place?.properties ?? room.properties });
    }
    records.push(...construction.walls.map((wall, index) => ({ ref: { type: "wall" as const, id: wall.id, scopeId }, name: `Wall ${index + 1}`, kind: wall.role, ownerId: owner?.id, tags: [] })));
    records.push(...construction.openings.map((opening, index) => ({ ref: { type: "opening" as const, id: opening.id, scopeId }, name: `${opening.kind} ${index + 1}`, kind: opening.kind, ownerId: owner?.id, tags: [] })));
    records.push(...construction.transitions.map((transition, index) => ({ ref: { type: "transition" as const, id: transition.id, scopeId }, name: `${transition.kind} ${index + 1}`, kind: transition.kind, ownerId: owner?.id, tags: [] })));
  }
  for (const place of project.places.filter(({ kind, id }) => kind === "room" && !representedRooms.has(id))) records.push({ ref: { type: "room", id: place.id, scopeId: place.parentId }, name: place.name, kind: "room", ownerId: place.parentId, description: place.description, tags: place.tags, properties: place.properties });
  return records;
}

function normalized(value: unknown) {
  return String(value ?? "").normalize("NFD").replaceAll(/[\u0300-\u036f]/g, "").toLocaleLowerCase();
}

export function searchProjectObjects(project: EditorProject, query: string, options: { types?: ProjectObjectType[]; limit?: number } = {}) {
  const words = normalized(query).trim().split(/\s+/).filter(Boolean); const allowed = options.types?.length ? new Set(options.types) : undefined;
  const names = new Map(project.places.map(({ id, name }) => [id, name]));
  return projectObjectRecords(project).filter((record) => {
    if (allowed && !allowed.has(record.ref.type)) return false;
    const text = normalized([record.name, record.kind, record.description, record.layerId, record.subjectId, record.ownerId ? names.get(record.ownerId) : undefined, ...record.tags, JSON.stringify(record.properties ?? {})].filter(Boolean).join(" "));
    return words.every((word) => text.includes(word));
  }).slice(0, Math.min(100, Math.max(1, options.limit ?? 50)));
}

export function hierarchySnapshot(project: EditorProject) {
  const byId = new Map(project.places.map((place) => [place.id, place]));
  const pathFor = (id: string) => { const path: string[] = []; const seen = new Set<string>(); let current = byId.get(id); while (current && !seen.has(current.id)) { seen.add(current.id); path.unshift(current.name); current = current.parentId ? byId.get(current.parentId) : undefined; } return path; };
  const places = project.places.map(({ id, parentId, name, kind, order, description, tags }) => ({ id, parentId, name, kind, order, description, tags, path: pathFor(id) }));
  const surfaces = project.surfaces.map(({ id, belongsToId, name, kind, description, tags }) => ({ id, parentId: belongsToId, ownerId: belongsToId, name, kind: "surface" as const, surfaceKind: kind, description, tags, ref: { type: "surface" as const, id }, path: [...pathFor(belongsToId), name] }));
  return [...places, ...surfaces];
}

export function projectOverview(project: EditorProject, activePlaceId?: string) {
  const records = projectObjectRecords(project); const count = (type: ProjectObjectType) => records.filter(({ ref }) => ref.type === type).length;
  const roots = project.places.filter(({ parentId }) => !parentId);
  const world = roots.find(({ kind }) => kind === "world") ?? roots[0];
  return { id: project.id, name: project.name, worldDescription: world?.description, schemaVersion: project.schemaVersion, updatedAt: project.updatedAt, activePlace: project.places.find(({ id }) => id === activePlaceId), roots: roots.map(({ id, name, kind }) => ({ id, name, kind })), counts: { places: count("place"), rooms: count("room"), elements: count("element"), surfaces: count("surface"), walls: count("wall"), openings: count("opening"), transitions: count("transition") } };
}

export function currentMapSnapshot(project: EditorProject, activePlaceId: string) {
  const groups = visiblePlaceGroups(project, activePlaceId); const elements = project.elements.filter((element) => elementContextDepth(project, activePlaceId, element) !== undefined); const surfaces = project.surfaces.filter((surface) => surfaceContextDepth(project, activePlaceId, surface) !== undefined);
  const owner = constructionPlaceForView(project, activePlaceId); const construction = project.constructions.find(({ id }) => id === owner?.constructionId);
  const place = (candidate: typeof groups.active) => candidate && ({ id: candidate.id, name: candidate.name, kind: candidate.kind });
  return { active: place(groups.active), children: groups.children.map(place), descendants: groups.descendants.map(place), context: groups.context.map(place), elements: elements.map(({ id, name, layerId, subjectId, belongsToId, visible, locked }) => ({ id, name, layerId, subjectId, belongsToId, visible, locked })), surfaces: surfaces.map(({ id, name, kind, belongsToId, visible, locked, attachment }) => ({ id, name, kind, layerId: "construction", subjectId: `platform.${kind}`, belongsToId, visible, locked, attachment })), construction: construction && { id: construction.id, ownerId: owner?.id, revision: construction.revision, walls: construction.walls.length, rooms: construction.rooms.length, openings: construction.openings.length, transitions: construction.transitions.length } };
}

export function constructionSnapshot(project: EditorProject, placeId: string) {
  const owner = constructionPlaceForView(project, placeId); const construction = project.constructions.find(({ id }) => id === owner?.constructionId);
  if (!owner || !construction) return undefined;
  const network = constructionNetwork(construction.walls, construction.enclosure);
  return { owner: { id: owner.id, name: owner.name, kind: owner.kind }, construction, faces: network.faces, diagnostics: network.diagnostics };
}

export function validContainerSnapshot(project: EditorProject, ref: { type: "place" | "element"; id: string }) {
  const places = ref.type === "place" ? validContainingPlaces(project, ref.id) : validElementOwners(project, ref.id);
  return places.map(({ id, parentId, name, kind }) => ({ id, parentId, name, kind }));
}

const instrumentPurpose: Record<string, string> = {
  select: "zaznaczanie i przenoszenie", marquee: "zaznaczanie obszaru", place: "stawianie elementu na mapie",
  pencil: "rysowanie odręczne", pen: "rysowanie krzywych Beziera", line: "rysowanie pojedynczej ściany lub odcinka",
  "wall-run": "rysowanie serii połączonych ścian", rectangle: "rysowanie prostokąta", circle: "rysowanie koła",
  ellipse: "rysowanie elipsy", arc: "rysowanie łuku trzypunktowego", polygon: "rysowanie wielokąta", point: "stawianie punktu", note: "dodawanie notatki", erase: "usuwanie zgodnie z aktywną warstwą",
};

export function drawingCatalogSnapshot(project?: EditorProject, activePlaceId?: string) {
  const equipmentSubjectIds = project && activePlaceId ? new Set(availableWorkSubjects(project, activePlaceId, "equipment").map(({ id }) => id)) : undefined;
  return {
    layers: workLayers.map((layer) => ({
      id: layer.id, labelKey: layer.labelKey, defaultSubjectId: layer.defaultSubjectId, defaultInstrumentId: layer.defaultInstrumentId,
      eraser: layer.eraser,
      subjects: layer.subjects.filter((subject) => layer.id !== "equipment" || !equipmentSubjectIds || equipmentSubjectIds.has(subject.id)).map((subject) => ({ id: subject.id, labelKey: subject.labelKey, meaning: subject.meaning, groupId: subject.groupId, instruments: [...(subject.instruments ?? layer.instruments)], defaultInstrumentId: subject.defaultInstrumentId ?? layer.defaultInstrumentId })),
    })),
    constructionCategories: constructionCategories.map((category) => ({ id: category.id, layerId: category.layerId, defaultSubjectId: category.defaultSubjectId })),
    instruments: Object.entries(instrumentPurpose).map(([id, purpose]) => ({ id, purpose })),
    context: project && activePlaceId ? { activePlaceId, equipmentSubjectIds: [...(equipmentSubjectIds ?? [])] } : undefined,
    notes: ["warstwa określa znaczenie obiektu, a narzędzie sposób wprowadzenia geometrii", "punkty kreślenia są lokalne dla ownera i podawane w metrach; środek widoku ownera wynika z jego wyliczonej obwiedni", "circle przyjmuje środek i punkt na obwodzie, rectangle i ellipse przeciwległe narożniki obwiedni, a polygon wierzchołki", "podesty są konstrukcją i mogą być wolnostojące", "schody i windy są przejściami pionowymi"],
  };
}

export function inspectProjectObject(project: EditorProject, ref: { type?: ProjectObjectType; id: string; scopeId?: string }) {
  const matches = projectObjectRecords(project).filter((record) => record.ref.id === ref.id && (!ref.type || record.ref.type === ref.type) && (!ref.scopeId || record.ref.scopeId === ref.scopeId));
  return matches.map((record) => {
    if (record.ref.type === "place") return { ...record, data: project.places.find(({ id }) => id === record.ref.id) };
    if (record.ref.type === "element") return { ...record, data: project.elements.find(({ id }) => id === record.ref.id) };
    if (record.ref.type === "surface") return { ...record, data: project.surfaces.find(({ id }) => id === record.ref.id) };
    const construction = project.constructions.find(({ id }) => constructionOwner(project, id)?.id === record.ref.scopeId || id === record.ref.scopeId);
    if (!construction) return record;
    if (record.ref.type === "room") { const room = construction.rooms.find(({ id }) => id === record.ref.id); const face = room && constructionNetwork(construction.walls, construction.enclosure).faces.find(({ id }) => id === room.faceId); return { ...record, data: room, geometry: face }; }
    if (record.ref.type === "wall") return { ...record, data: construction.walls.find(({ id }) => id === record.ref.id) };
    if (record.ref.type === "opening") return { ...record, data: construction.openings.find(({ id }) => id === record.ref.id) };
    return { ...record, data: construction.transitions.find(({ id }) => id === record.ref.id) };
  });
}

export function projectConsistencyReport(project: EditorProject) {
  const issues: Array<{ severity: "error" | "warning"; code: string; message: string; refs: string[] }> = [];
  const parsed = editorProjectSchema.safeParse(project);
  if (!parsed.success) for (const issue of parsed.error.issues) issues.push({ severity: "error", code: "schema", message: issue.message, refs: [issue.path.join(".")] });
  const placeKinds = new Map(project.places.map(({ id, kind }) => [id, kind]));
  const knownMessages = new Set(issues.map(({ message }) => message));
  for (const construction of project.constructions) {
    try {
      const network = constructionNetwork(construction.walls, construction.enclosure); const faceIds = new Set(network.faces.map(({ id }) => id));
      for (const diagnostic of network.diagnostics) issues.push({ severity: diagnostic.kind === "dangling-edge" || diagnostic.kind === "cut-edge" ? "warning" : "error", code: diagnostic.kind, message: `Construction ${construction.id}: ${diagnostic.kind}`, refs: [construction.id, ...diagnostic.wallIds] });
      for (const room of construction.rooms) if (!faceIds.has(room.faceId)) issues.push({ severity: "error", code: "missing-room-face", message: `Room ${room.name} references a missing closed face.`, refs: [construction.id, room.id, room.faceId] });
      for (const issue of wallFeatureIssues(construction)) issues.push({ severity: "error", code: "invalid-wall-feature", message: issue, refs: [construction.id, issue.slice(issue.indexOf(":") + 1)] });
      for (const issue of validateVerticalTransitions(construction, { levelKinds: placeKinds })) if (!knownMessages.has(issue.message)) {
        knownMessages.add(issue.message);
        issues.push({ severity: "error", code: "invalid-transition", message: issue.message, refs: [construction.id, issue.transitionId, ...(issue.relatedTransitionId ? [issue.relatedTransitionId] : []), ...(issue.levelId ? [issue.levelId] : [])] });
      }
    } catch (error) { issues.push({ severity: "error", code: "geometry-kernel", message: error instanceof Error ? error.message : String(error), refs: [construction.id] }); }
  }
  return { valid: !issues.some(({ severity }) => severity === "error"), issueCount: issues.length, issues };
}
