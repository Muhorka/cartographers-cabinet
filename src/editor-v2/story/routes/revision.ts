import type { VerticalTransition } from "../../construction/wall-features";
import type { EditorProject } from "../../model/project-model";
import GeometryFactory from "jsts/org/locationtech/jts/geom/GeometryFactory.js";
import GeoJSONReader from "jsts/org/locationtech/jts/io/GeoJSONReader.js";
import InteriorPoint from "jsts/org/locationtech/jts/algorithm/InteriorPoint.js";
import { pointInRegion, regionGeoJson } from "../../geometry/region-constraints";
import { projectRevision, valueRevision } from "../../state/project-revision";
import { projectStoryData } from "../project-effective";
import { defaultStoryAccessPolicy, storyRefKey, type StoryAccessPolicy, type StoryData, type StoryObjectMetadata, type StoryObjectRef, type StoryTextPatch } from "../types";
import { outdoorElementSemantics, routeElementWidthCap } from "./outdoor-element-semantics";
import type { StoryRouteRecord } from "./types";

const REVISION_PREFIX = "story-route:v1:";
const geometryReader = new GeoJSONReader(new GeometryFactory());
const has = (value: object, key: PropertyKey) => Object.prototype.hasOwnProperty.call(value, key);
const ids = (values: readonly string[] = []) => [...new Set(values)].toSorted((first, second) => first.localeCompare(second));
const ref = ({ kind, id, scopeId }: StoryObjectRef) => ({ kind, id, ...(scopeId ? { scopeId } : {}) });
const compare = (first: unknown, second: unknown) => JSON.stringify(first).localeCompare(JSON.stringify(second));

function normalizedAccess(input: StoryAccessPolicy) {
  const access = { ...defaultStoryAccessPolicy(), ...input };
  return {
    allow: ids(access.allow), deny: ids(access.deny), permission: access.permission,
    physicalState: access.physicalState, lock: access.lock ?? "none", keyIds: ids(access.keyIds),
    guardIds: ids(access.guardIds), secretKnowledge: ids(access.secretKnowledge), hidden: Boolean(access.hidden),
    ...(access.knownBy === undefined ? {} : { knownBy: ids(access.knownBy) }),
  };
}

const defaultAccessRevision = JSON.stringify(normalizedAccess(defaultStoryAccessPolicy()));
function semanticMetadata(metadata: StoryObjectMetadata | undefined, override = false) {
  if (!metadata) return undefined;
  const access = metadata.access ? normalizedAccess(metadata.access) : undefined;
  const meaningfulAccess = access && (override || JSON.stringify(access) !== defaultAccessRevision) ? access : undefined;
  const owners = has(metadata, "owners") ? ids(metadata.owners ?? []) : undefined;
  if (!meaningfulAccess && owners === undefined) return undefined;
  return { ...(meaningfulAccess ? { access: meaningfulAccess } : {}), ...(owners === undefined ? {} : { owners }) };
}

/**
 * Routing uses a representative landing point, not transition decoration.
 * JTS's interior-point algorithm is important here: the arithmetic mean of a
 * concave footprint's vertices can be outside the footprint (or in a hole).
 */
export function routeTransitionPoint(transition: VerticalTransition) {
  try {
    const coordinate = InteriorPoint.getInteriorPoint(geometryReader.read(regionGeoJson(transition.footprint)));
    if (!coordinate) return undefined;
    const point = { x: coordinate.x, y: coordinate.y };
    return pointInRegion(point, transition.footprint) ? point : undefined;
  } catch {
    return undefined;
  }
}

function routeRef(refValue: StoryObjectRef, roadIds: ReadonlySet<string>) {
  return refValue.kind === "place" || refValue.kind === "room" || refValue.kind === "opening" || refValue.kind === "transition"
    || refValue.kind === "element" && roadIds.has(refValue.id);
}

function patchOverrides(patches: readonly StoryTextPatch[], roadIds: ReadonlySet<string>) {
  const overrides = new Map<string, { ref: ReturnType<typeof ref>; access?: ReturnType<typeof normalizedAccess>; owners?: string[] }>();
  for (const patch of patches) {
    if (!routeRef(patch.target, roadIds) || !patch.metadata) continue;
    const key = storyRefKey(patch.target); const previous = overrides.get(key) ?? { ref: ref(patch.target) };
    if (patch.metadata.access) previous.access = normalizedAccess(patch.metadata.access);
    if (has(patch.metadata, "owners")) previous.owners = ids(patch.metadata.owners ?? []);
    overrides.set(key, previous);
  }
  return [...overrides.values()].filter(({ access, owners }) => access !== undefined || owners !== undefined).toSorted(compare);
}

function storyInput(story: StoryData, roadIds: ReadonlySet<string>) {
  const seenObjects = new Set<string>();
  const objects = story.objects.flatMap((object) => {
    const key = storyRefKey(object.ref); if (seenObjects.has(key)) return []; seenObjects.add(key);
    if (!routeRef(object.ref, roadIds)) return [];
    const metadata = semanticMetadata(object.metadata); return metadata ? [{ ref: ref(object.ref), ...metadata }] : [];
  }).toSorted(compare);
  const memberships = [...new Map(story.memberships.map(({ subjectId, groupId, kind }) => {
    const value = { subjectId, groupId, kind }; return [JSON.stringify(value), value] as const;
  })).values()].toSorted(compare);
  const worldById = new Map(story.world.map((entry) => [entry.id, entry]));
  const memberOfTargets = ids(memberships.filter(({ kind }) => kind === "member-of").map(({ groupId }) => groupId)).map((id) => {
    const kind = worldById.get(id)?.kind; return { id, acceptsMembers: kind === undefined || kind === "faction" || kind === "access-group" };
  });
  const zones = story.zones.flatMap((zone) => {
    const metadata = semanticMetadata(zone.metadata); if (!metadata) return [];
    const members = ids(zone.members.filter(({ ref: member }) => routeRef(member, roadIds)).map(({ ref: member }) => storyRefKey(member)))
      .map((key) => ref(zone.members.find(({ ref: member }) => storyRefKey(member) === key)!.ref));
    if (!members.length && !zone.shape) return [];
    return [{ ...(zone.ownerPlaceId ? { ownerPlaceId: zone.ownerPlaceId } : {}), ...(zone.shape ? { shape: zone.shape } : {}), members, ...metadata }];
  }).toSorted(compare);
  const scenarios = story.scenarios.flatMap((scenario) => {
    const overrides = patchOverrides(scenario.patches, roadIds);
    const steps = scenario.steps.flatMap((step) => {
      const stepOverrides = patchOverrides(step.patches, roadIds);
      return stepOverrides.length ? [{ id: step.id, overrides: stepOverrides }] : [];
    }).toSorted(compare);
    return overrides.length || steps.length ? [{ id: scenario.id, overrides, steps }] : [];
  }).toSorted(compare);
  return { objects, memberships, memberOfTargets, zones, scenarios };
}

function elementInput(project: EditorProject) {
  return project.elements.flatMap((element) => {
    const semantics = outdoorElementSemantics(element);
    const obstacle = semantics.barrier && (element.geometry.kind === "region" || semantics.water && (element.geometry.kind === "path" || element.geometry.kind === "bezier"));
    if (!semantics.road && !obstacle && !semantics.bridge) return [];
    const widthCap = !semantics.road && semantics.water && element.geometry.kind !== "region" ? routeElementWidthCap(element) : undefined;
    return [{
      id: element.id, belongsToId: element.belongsToId, geometry: element.geometry,
      roles: { road: semantics.road, obstacle, water: obstacle && semantics.water, bridge: semantics.bridge },
      ...(widthCap === undefined ? {} : { widthCap }),
      ...(semantics.road ? {
        ribbon: {
          ...(element.widthMeters === undefined ? {} : { widthMeters: element.widthMeters }),
          ...(element.widthProfile?.length ? { widthProfile: element.widthProfile } : {}),
          ...(element.ribbonCutouts?.length ? { ribbonCutouts: element.ribbonCutouts } : {}),
        },
      } : {}),
      ...(semantics.road && element.access.length ? { access: ids(element.access) } : {}),
    }];
  }).toSorted(compare);
}

/** Stable, versioned fingerprint of project data that can change a calculated route. */
export function storyRouteRevision(project: EditorProject) {
  const elements = elementInput(project); const roadIds = new Set(elements.filter(({ roles }) => roles.road).map(({ id }) => id));
  const input = {
    places: project.places.map(({ id, parentId, kind, transform, boundary, constructionId, access }) => ({
      id, ...(parentId ? { parentId } : {}), kind, transform, ...(boundary ? { boundary } : {}),
      ...(constructionId ? { constructionId } : {}), ...(access.length ? { access: ids(access) } : {}),
    })).toSorted(compare),
    elements,
    constructions: project.constructions.map(({ id, walls, rooms, openings, transitions, enclosure }) => ({
      id,
      walls: walls.map(({ id: wallId, start, end, thickness, role }) => ({ id: wallId, start, end, thickness, role })),
      rooms: rooms.map(({ id: roomId, faceId, access }) => ({ id: roomId, faceId, ...(access.length ? { access: ids(access) } : {}) })).toSorted(compare),
      openings: openings.map(({ id: openingId, kind, wallId, position, width }) => ({ id: openingId, kind, wallId, position, width })).toSorted(compare),
      transitions: transitions.map((transition) => ({
        id: transition.id, point: routeTransitionPoint(transition),
        ...(transition.sourceLevelId ? { sourceLevelId: transition.sourceLevelId } : {}),
        ...(transition.targetLevelId ? { targetLevelId: transition.targetLevelId } : {}),
        ...(transition.connectedLevelIds === undefined ? {} : { connectedLevelIds: ids(transition.connectedLevelIds) }),
        sameLevelRise: Boolean(transition.sameLevelRise),
      })).toSorted(compare),
      ...(enclosure ? { enclosure } : {}),
    })).toSorted(compare),
    story: storyInput(projectStoryData(project), roadIds),
  };
  return `${REVISION_PREFIX}${valueRevision(input)}`;
}

/** Exact pre-semantic algorithm retained only to recognize untouched legacy saves. */
export function legacyStoryRouteRevision(project: EditorProject, sourceProjectId = project.id) {
  const story = Object.fromEntries(Object.entries(project.story).filter(([key]) => key !== "routes"));
  return projectRevision({ ...project, id: sourceProjectId, story } as EditorProject);
}

type RevisionCheck = { current: string; legacy: Map<string, string> };
function revisionCheck(project: EditorProject): RevisionCheck { return { current: storyRouteRevision(project), legacy: new Map() }; }
function isSourceRevisionCurrent(project: EditorProject, sourceRevision: string, check: RevisionCheck) {
  if (sourceRevision === check.current) return true;
  if (sourceRevision.startsWith(REVISION_PREFIX)) return false;
  const legacy = /^(.*):[0-9a-f]+:\d+$/.exec(sourceRevision);
  if (!legacy?.[1]) return false;
  if (!check.legacy.has(legacy[1])) check.legacy.set(legacy[1], legacyStoryRouteRevision(project, legacy[1]));
  return check.legacy.get(legacy[1]) === sourceRevision;
}

function recordSourceRevisions(record: Pick<StoryRouteRecord, "sourceRevision" | "result">) {
  return [record.sourceRevision, record.result.sourceRevision, ...record.result.routes.flatMap(({ sourceRevision }) => sourceRevision ?? []), ...(record.result.route?.sourceRevision ? [record.result.route.sourceRevision] : [])];
}

/** Accepts v1 semantic records and only byte-equivalent legacy content cloned under another id. */
export function isStoryRouteCurrent(project: EditorProject, record: Pick<StoryRouteRecord, "sourceRevision" | "result">, currentRevision = storyRouteRevision(project)) {
  const check: RevisionCheck = { current: currentRevision, legacy: new Map() };
  return recordSourceRevisions(record).every((sourceRevision) => isSourceRevisionCurrent(project, sourceRevision, check));
}

function rebaseStoryRouteRecordWithCheck(project: EditorProject, record: StoryRouteRecord, check: RevisionCheck): StoryRouteRecord {
  if (!recordSourceRevisions(record).every((revision) => isSourceRevisionCurrent(project, revision, check)) || recordSourceRevisions(record).every((revision) => revision === check.current)) return record;
  const sourceRevision = check.current;
  const routes = record.result.routes.map((route) => ({ ...route, sourceRevision }));
  const route = record.result.route ? { ...record.result.route, sourceRevision } : undefined;
  return { ...record, sourceRevision, result: { ...record.result, sourceRevision, routes, ...(route ? { route } : {}) } };
}

export function rebaseStoryRouteRecord(project: EditorProject, record: StoryRouteRecord): StoryRouteRecord {
  return rebaseStoryRouteRecordWithCheck(project, record, revisionCheck(project));
}

/** One-time, lossless migration for current legacy records at the session boundary. */
export function rebaseCurrentStoryRoutes(project: EditorProject): EditorProject {
  const check = revisionCheck(project); const routes = project.story.routes.map((record) => rebaseStoryRouteRecordWithCheck(project, record, check));
  return routes.some((record, index) => record !== project.story.routes[index]) ? { ...project, story: { ...project.story, routes } } : project;
}
