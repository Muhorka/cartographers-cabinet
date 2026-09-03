import type { EditorProject } from "../model/project-model";
import { allStoryObjectRefs, canonicalProjectStoryRef } from "./project-adapter";
import { storyRefKey, type StoryObjectMetadata, type StoryObjectRef, type StoryPropertyValue } from "./types";

type StoryIntegrityIssue = { message: string; path: (string | number)[]; severity: "warning" };
type Path = StoryIntegrityIssue["path"];

/** Reports recoverable Story links that no longer resolve to this project. */
export function projectStoryIntegrityIssues(project: EditorProject): StoryIntegrityIssue[] {
  const issues: StoryIntegrityIssue[] = [];
  const add = (message: string, path: Path) => issues.push({ message, path, severity: "warning" });
  const story = project.story;
  const placeIds = new Set(project.places.map(({ id }) => id));
  const levelIds = new Set(project.places.filter(({ kind }) => kind === "level").map(({ id }) => id));
  const roadIds = new Set(project.elements.filter(({ layerId }) => layerId === "roads").map(({ id }) => id));
  const openingIds = new Set(project.constructions.flatMap(({ openings }) => openings.map(({ id }) => id)));
  const transitionIds = new Set(project.constructions.flatMap(({ transitions }) => transitions.map(({ id }) => id)));
  const worldIds = new Set(story.world.map(({ id }) => id));
  const refs = allStoryObjectRefs(project);
  const refKeys = new Set(refs.map(storyRefKey));
  const inspectRef = (ref: StoryObjectRef, path: Path) => {
    const canonical = canonicalProjectStoryRef(project, ref, refs);
    if (!refKeys.has(storyRefKey(canonical))) add(`Story reference does not resolve to a project object: ${storyRefKey(ref)}`, path);
  };
  const inspectWorldId = (id: string, path: Path, label: string) => {
    if (!worldIds.has(id)) add(`Story ${label} does not resolve to a world entry: ${id}`, path);
  };
  const inspectValue = (value: StoryPropertyValue, path: Path) => {
    if (Array.isArray(value)) { value.forEach((item, index) => inspectValue(item as StoryPropertyValue, [...path, index])); return; }
    if (value && typeof value === "object" && "kind" in value && "id" in value) inspectRef(value as StoryObjectRef, path);
    else if (value && typeof value === "object" && "entityId" in value) inspectWorldId(String(value.entityId), path, "entity reference");
  };
  const inspectMetadata = (metadata: Pick<StoryObjectMetadata, "properties" | "owners" | "access"> | undefined, path: Path) => {
    for (const [key, value] of Object.entries(metadata?.properties ?? {})) inspectValue(value, [...path, "properties", key]);
    (metadata?.owners ?? []).forEach((id, index) => inspectWorldId(id, [...path, "owners", index], "owner reference"));
    for (const field of ["allow", "deny", "keyIds", "guardIds", "secretKnowledge", "knownBy"] as const) {
      (metadata?.access?.[field] ?? []).forEach((id, index) => inspectWorldId(id, [...path, "access", field, index], `access.${field} reference`));
    }
  };
  const groupIds = new Set([...story.groups.map(({ id }) => id), ...story.zones.flatMap(({ legacyGroupId }) => legacyGroupId ? [legacyGroupId] : [])]);
  const zoneIds = new Set(story.zones.map(({ id }) => id));
  const scenarioIds = new Set(story.scenarios.map(({ id }) => id));
  const propertyIds = new Set(story.propertyDefinitions.map(({ id }) => id));
  const stepIdsByScenario = new Map(story.scenarios.map((scenario) => [scenario.id, new Set(scenario.steps.map(({ id }) => id))]));
  const inspectCollectionId = (id: string, known: ReadonlySet<string>, path: Path, label: string) => {
    if (!known.has(id)) add(`Story ${label} does not resolve to an existing record: ${id}`, path);
  };

  story.world.forEach((entry, index) => Object.entries(entry.properties).forEach(([key, value]) => inspectValue(value, ["story", "world", index, "properties", key])));
  story.memberships.forEach((membership, index) => {
    inspectWorldId(membership.subjectId, ["story", "memberships", index, "subjectId"], "membership subject");
    inspectWorldId(membership.groupId, ["story", "memberships", index, "groupId"], "membership group");
  });
  story.objects.forEach((object, index) => { inspectRef(object.ref, ["story", "objects", index, "ref"]); inspectMetadata(object.metadata, ["story", "objects", index, "metadata"]); });
  story.groups.forEach((group, index) => {
    group.memberRefs.forEach((ref, memberIndex) => inspectRef(ref, ["story", "groups", index, "memberRefs", memberIndex]));
    group.entryIds.forEach((id, entryIndex) => inspectWorldId(id, ["story", "groups", index, "entryIds", entryIndex], "group entry reference"));
    inspectMetadata(group.metadata, ["story", "groups", index, "metadata"]);
  });
  story.zones.forEach((zone, index) => {
    if (zone.ownerPlaceId && !placeIds.has(zone.ownerPlaceId)) add(`Story zone owner does not exist: ${zone.ownerPlaceId}`, ["story", "zones", index, "ownerPlaceId"]);
    zone.members.forEach((member, memberIndex) => inspectRef(member.ref, ["story", "zones", index, "members", memberIndex, "ref"]));
    zone.entryIds?.forEach((id, entryIndex) => inspectWorldId(id, ["story", "zones", index, "entryIds", entryIndex], "zone entry reference"));
    inspectMetadata(zone.metadata, ["story", "zones", index, "metadata"]);
  });

  const inspectLens = (expression: unknown, path: Path) => {
    if (!expression || typeof expression !== "object") return;
    const node = expression as { kind?: string; items?: unknown[]; item?: unknown; predicate?: { kind?: string; ref?: StoryObjectRef; groupId?: string; propertyId?: string; entryId?: string; zoneId?: string; equals?: StoryPropertyValue } };
    if (node.kind === "all" || node.kind === "any") node.items?.forEach((item, index) => inspectLens(item, [...path, "items", index]));
    else if (node.kind === "not") inspectLens(node.item, [...path, "item"]);
    else if (node.kind === "predicate" && node.predicate) {
      const predicate = node.predicate; const predicatePath = [...path, "predicate"];
      if (predicate.kind === "object" && predicate.ref) inspectRef(predicate.ref, [...predicatePath, "ref"]);
      else if (predicate.kind === "group") inspectCollectionId(String(predicate.groupId), groupIds, [...predicatePath, "groupId"], "group reference");
      else if (predicate.kind === "property") {
        inspectCollectionId(String(predicate.propertyId), propertyIds, [...predicatePath, "propertyId"], "property reference");
        if (Object.hasOwn(predicate, "equals")) inspectValue(predicate.equals as StoryPropertyValue, [...predicatePath, "equals"]);
      } else if (predicate.kind === "access" || predicate.kind === "owner") inspectWorldId(String(predicate.entryId), [...predicatePath, "entryId"], "lens entry reference");
      else if (predicate.kind === "zone") inspectCollectionId(String(predicate.zoneId), zoneIds, [...predicatePath, "zoneId"], "zone reference");
    }
  };
  story.lenses.forEach((lens, index) => inspectLens(lens.expression, ["story", "lenses", index, "expression"]));
  const inspectPatch = (patch: { target: StoryObjectRef; properties?: Record<string, StoryPropertyValue>; metadata?: Pick<StoryObjectMetadata, "owners" | "access"> }, path: Path) => {
    inspectRef(patch.target, [...path, "target"]);
    Object.entries(patch.properties ?? {}).forEach(([key, value]) => inspectValue(value, [...path, "properties", key]));
    inspectMetadata(patch.metadata, [...path, "metadata"]);
  };
  story.scenarios.forEach((scenario, index) => {
    scenario.patches.forEach((patch, patchIndex) => inspectPatch(patch, ["story", "scenarios", index, "patches", patchIndex]));
    scenario.steps.forEach((step, stepIndex) => step.patches.forEach((patch, patchIndex) => inspectPatch(patch, ["story", "scenarios", index, "steps", stepIndex, "patches", patchIndex])));
  });
  story.relations.forEach((relation, index) => ["from", "to"].forEach((side) => {
    const actor = relation[side as "from" | "to"];
    if ("kind" in actor) inspectRef(actor, ["story", "relations", index, side]);
    else inspectWorldId(actor.entryId, ["story", "relations", index, side, "entryId"], "relation endpoint");
  }));
  story.intentions.forEach((intention, index) => {
    if (intention.authorId) inspectWorldId(intention.authorId, ["story", "intentions", index, "authorId"], "intention author reference");
    inspectRef(intention.subject, ["story", "intentions", index, "subject"]);
    if (intention.target) inspectRef(intention.target, ["story", "intentions", index, "target"]);
    intention.through?.forEach((ref, refIndex) => inspectRef(ref, ["story", "intentions", index, "through", refIndex]));
    if (intention.avoidZoneId) inspectCollectionId(intention.avoidZoneId, zoneIds, ["story", "intentions", index, "avoidZoneId"], "avoid-zone reference");
    if (intention.accessEntryId) inspectWorldId(intention.accessEntryId, ["story", "intentions", index, "accessEntryId"], "intention access reference");
  });
  story.evidence.forEach((item, index) => item.refs.forEach((ref, refIndex) => inspectRef(ref, ["story", "evidence", index, "refs", refIndex])));
  story.documents.forEach((document, index) => document.references.forEach((reference, referenceIndex) => {
    if (reference.kind === "object") inspectRef(reference.ref, ["story", "documents", index, "references", referenceIndex, "ref"]);
    else inspectCollectionId(reference.scenarioId, scenarioIds, ["story", "documents", index, "references", referenceIndex, "scenarioId"], "document scenario reference");
  }));

  const inspectEndpoint = (endpoint: { placeId: string; levelId?: string }, path: Path) => {
    if (!placeIds.has(endpoint.placeId)) add(`Story route place does not resolve to a project place: ${endpoint.placeId}`, [...path, "placeId"]);
    if (endpoint.levelId && !levelIds.has(endpoint.levelId)) add(`Story route level does not resolve to a project level: ${endpoint.levelId}`, [...path, "levelId"]);
  };
  story.routes.forEach((route, index) => {
    inspectEndpoint(route.query.from, ["story", "routes", index, "query", "from"]); inspectEndpoint(route.query.to, ["story", "routes", index, "query", "to"]);
    if (route.query.actorId) inspectWorldId(route.query.actorId, ["story", "routes", index, "query", "actorId"], "route actor reference");
    if (route.query.scenarioId) inspectCollectionId(route.query.scenarioId, scenarioIds, ["story", "routes", index, "query", "scenarioId"], "route scenario reference");
    if (route.query.stepId && !stepIdsByScenario.get(route.query.scenarioId ?? "")?.has(route.query.stepId)) add(route.query.scenarioId
      ? `Story route step does not resolve inside scenario ${route.query.scenarioId}: ${route.query.stepId}`
      : `Story route step has no scenario context: ${route.query.stepId}`, ["story", "routes", index, "query", "stepId"]);
    const alternatives = route.result.route && !route.result.routes.some(({ id }) => id === route.result.route!.id)
      ? [...route.result.routes, route.result.route]
      : route.result.routes;
    alternatives.forEach((alternative, alternativeIndex) => {
      const alternativePath = ["story", "routes", index, "result", "alternatives", alternativeIndex] as Path;
      alternative.usedOpeningIds.forEach((id, openingIndex) => inspectCollectionId(id, openingIds, [...alternativePath, "usedOpeningIds", openingIndex], "route opening reference"));
      alternative.usedTransitionIds.forEach((id, transitionIndex) => inspectCollectionId(id, transitionIds, [...alternativePath, "usedTransitionIds", transitionIndex], "route transition reference"));
      alternative.segments.forEach((segment, segmentIndex) => {
        const segmentPath = [...alternativePath, "segments", segmentIndex] as Path;
        inspectEndpoint(segment, segmentPath);
        if (!segment.sourceId) return;
        const sourceIds = segment.kind === "road" ? roadIds : segment.kind === "transition" ? transitionIds : openingIds;
        inspectCollectionId(segment.sourceId, sourceIds, [...segmentPath, "sourceId"], `route ${segment.kind} source reference`);
      });
    });
  });
  return issues;
}
