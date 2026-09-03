"use client";
import { useEffect, useMemo, useState } from "react";
import type { StoryDisclosureSection } from "../story/components/story-disclosure-book";
import { useWorkbenchZones } from "./use-workbench-zones";
import { ZoneMapOverlay } from "./zone-map-overlay";
import type { EditorSession, EditorSessionState, ProjectTransaction } from "../state/editor-session";
import { scopedSelectionRefs, type EditorStoryView } from "../webmcp/editor-context";
import type { MapSelection } from "./map-sheet-types";
import { StoryInspector, StoryLenses, StoryTopBar, StoryWorldbook, useStoryView } from "../story/components";
import { storyCopy } from "../story/i18n/story-copy";
import { workbenchCopy } from "../i18n/workbench-copy";
import { activeStoryLensIds } from "../story/lens-view";
import { emptyStoryData, storyRefKey, type StoryObjectMetadata, type StoryObjectRef } from "../story/types";
import { storyDataSchema } from "../story/schema";
import { createAndAssignStoryEntry } from "../story/project-quick-assignment";
import { assignProjectKeyHolders } from "../story/project-key-holders";
import { StoryDoorKeys } from "../story/components/story-door-keys";
import { applyProjectStoryMetadata } from "../story/project-commands";
import { assertProjectStoryObjectEditable } from "../story/story-locks";
import { resolveStoryOwnership } from "../story/ownership";
import { displayProject } from "../story/project-view";
import { StoryMapOverlay } from "./story-map-overlay";
import { StoryRouteOverlay } from "./story-route-overlay";
import { StoryRoutePanel } from "../story/components/story-route-panel";
import { StoryWorldDescription } from "../story/components/story-world-description";
import { isStoryRouteCurrent } from "../story/routes/revision";
import { createStoryRouteCalculationService } from "../story/routes/route-service";
import styles from "./workbench-story.module.css";
import { useStoryWorkspacePanels } from "./use-story-workspace-panels";
import { replaceProjectScenarios } from "../story/scenario-commands";
import { useStoryRouteInteraction } from "./use-story-route-interaction";
import { createWorkbenchStoryResolution, storyInspectorNeedsObjectCatalog } from "./workbench-story-resolution";

const empty = emptyStoryData();
export function useWorkbenchStory({ session, snapshot, selections, inspectedPlaceId, locale, mode, refresh, zoom, onSelect, onFocus, onOpenPlace, onOpenWorldbook }: {
  session?: EditorSession; snapshot?: EditorSessionState; selections: MapSelection[]; locale: "pl" | "en";
  inspectedPlaceId?: string;
  mode: "drawing" | "story"; refresh(): void; zoom: number; onSelect(selection: MapSelection): void; onFocus(refs: StoryObjectRef[]): boolean; onOpenPlace(id: string): void; onOpenWorldbook(): void;
}) {
  const project = snapshot?.project; const copy = storyCopy[locale];
  const [error, setError] = useState<string>();
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [bookOpen, setBookOpen] = useState<Partial<Record<StoryDisclosureSection, boolean>>>({ tree: true, zones: false });
  const showWorldbook = () => { setBookOpen((current) => ({ ...current, worldbook: true })); onOpenWorldbook(); };
  const showRoutes = () => { setBookOpen((current) => ({ ...current, routes: true, worldbook: false })); };
  function commit(transaction: ProjectTransaction) {
    if (!session) return false;
    const result = session.executeTransaction({ ...transaction, isolation: "structural" });
    if (result.code !== "committed" && result.code !== "no-change") throw new Error(result.reason ?? (locale === "pl" ? "Zmiana nie została zapisana. Dotychczasowe dane pozostały bez zmian." : "The change was not saved. Existing data is unchanged."));
    setError(undefined); refresh(); return true;
  }
  const controller = useStoryView(project?.story ?? empty, (update, transaction) => {
    if (!session) return;
    try { commit({ id: transaction.id, apply: (current) => {
      const story = storyDataSchema.parse(typeof update === "function" ? update(current.story) : update);
      const validated = replaceProjectScenarios(current, story.scenarios);
      return { ...validated, story: { ...story, scenarios: validated.story.scenarios } };
    } }); }
    catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); }
  }, [], project?.id ?? "no-project");
  const { view, updateView } = controller;
  const lensIds = activeStoryLensIds(view).filter((id) => project?.story.lenses.some((lens) => lens.id === id));
  const [reviewProject, setReviewProject] = useState<string>();
  const [routeSelectionVersion, setRouteSelectionVersion] = useState(0);
  const reviewOpen = Boolean(project && reviewProject === project.id);
  const stepId = mode === "story" && project?.story.scenarios.find(({ id }) => id === view.activeScenarioId)?.steps.some(({ id }) => id === view.activeStepId) ? view.activeStepId : undefined; const setStepId = (activeStepId?: string) => updateView({ activeStepId });
  const routeService = useMemo(() => createStoryRouteCalculationService(), []);
  useEffect(() => () => routeService.cancel(), [routeService]);
  const scenarioId = mode === "story" && project?.story.scenarios.some(({ id }) => id === view.activeScenarioId) ? view.activeScenarioId : undefined;
  const context = { scenarioId, stepId, lensId: mode === "story" ? lensIds[0] : undefined };
  const routeOwner = mode !== "story" ? undefined : reviewOpen && bookOpen.worldbook ? "scene-review" : bookOpen.routes ? "route-editor" : undefined;
  const routeInteraction = useStoryRouteInteraction({ project, context, mode, owner: routeOwner, activeRouteId: view.activeRouteId, activePlaceId: snapshot?.activePlaceId, selectionVersion: routeSelectionVersion });
  const { pointRequest, pointPicker } = routeInteraction;
  const editTarget = view.scenarioContext === "active" && scenarioId ? "scenario" as const : "base" as const;
  const inspectorScenarioId = editTarget === "scenario" ? scenarioId : undefined;
  const inspectorStepId = editTarget === "scenario" ? stepId : undefined;
  const renderedProject = useMemo(() => project ? displayProject(project, { scenarioId, stepId }) : undefined, [project, scenarioId, stepId]);
  const rawRefs = project ? scopedSelectionRefs(project, selections, snapshot?.activePlaceId) : [];
  const inspectingOpenPlace = !selections.length;
  const inspectedRefs = inspectingOpenPlace && project && inspectedPlaceId ? scopedSelectionRefs(project, [{ kind: "place", id: inspectedPlaceId }], snapshot?.activePlaceId) : rawRefs;
  const storyResolution = useMemo(() => {
    if (!project) return undefined;
    return createWorkbenchStoryResolution(project, { scenarioId, stepId }, { scenarioId: inspectorScenarioId, stepId: inspectorStepId }, locale);
  }, [project, scenarioId, stepId, inspectorScenarioId, inspectorStepId, locale]);
  const selected = inspectedRefs.flatMap(({ type, id, scopeId }) => {
    const result = storyResolution?.resolve({ kind: type, id, scopeId });
    return result ? [result] : [];
  });
  const resolvedObjects = mode === "story" ? storyResolution?.resolveObjects() ?? [] : [];
  const inspectorNeedsObjectCatalog = detailsOpen && storyInspectorNeedsObjectCatalog(project?.story.propertyDefinitions ?? [], selected.map(({ ref }) => ref));
  const resolvedInspectorObjects = mode === "story" || inspectorNeedsObjectCatalog ? storyResolution?.resolveInspectorObjects() ?? [] : selected;
  const selection = selected.map((item) => ({ ...item.ref, name: item.name, metadata: item.metadata as Record<string, unknown> }));
  function setView(patch: EditorStoryView) {
    const next: Parameters<typeof updateView>[0] = {};
    if ("scenarioId" in patch) { next.activeScenarioId = patch.scenarioId; next.scenarioContext = patch.scenarioId ? "active" : "base"; setStepId(undefined); }
    if ("stepId" in patch) setStepId(patch.stepId);
    if ("lensId" in patch) next.activeLensId = patch.lensId;
    if ("lensIds" in patch) next.activeLensIds = patch.lensIds;
    if ("previewLens" in patch) next.previewLens = patch.previewLens ?? undefined;
    if ("routeId" in patch) { next.activeRouteId = patch.routeId; setRouteSelectionVersion((version) => version + 1); }
    if ("editTarget" in patch) next.scenarioContext = patch.editTarget === "scenario" ? "active" : "base";
    updateView(next);
  }
  const liveContext = { selections: rawRefs, inspectedPlaceId, mode, view: { ...context, lensIds: mode === "story" ? lensIds : [], previewLens: mode === "story" ? view.previewLens : undefined, routeId: mode === "story" ? view.activeRouteId : undefined, editTarget } };
  const selectedOwnership = project && selected.length === 1
    ? resolveStoryOwnership(project, project.story, selected[0].ref, { scenarioId: inspectorScenarioId, stepId: inspectorStepId })
    : undefined;
  const ownershipResetSource = editTarget === "base" ? "local" : inspectorStepId ? "step" : "scenario";
  const canResetOwnership = Boolean(selectedOwnership?.directPresent && selectedOwnership.directSource?.kind === ownershipResetSource);
  const openWorldbook = (collection: Parameters<typeof controller.chooseCollection>[0]) => {
    setReviewProject(undefined);
    if (collection === "routes") { controller.chooseCollection(collection); showRoutes(); return; }
    controller.chooseCollection(collection); showWorldbook();
  };
  const metadataChange = (refs: typeof selected[number]["ref"][], metadata: StoryObjectMetadata, action: "add" | "remove" | "replace", options?: { accessFields?: Array<keyof import("../story/types").StoryAccessPolicy> }) => {
    if (!session) return false;
    try { return commit({ id: `story-metadata:${crypto.randomUUID()}`, apply: (current) => applyProjectStoryMetadata(current, { refs, metadata, action, ...options, target: liveContext.view.editTarget, context }) }); }
    catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); return false; }
  };
  const resetOwnership = (refs: StoryObjectRef[]) => {
    if (!session || !project) return false;
    try {
      return commit({ id: `story-ownership-reset:${crypto.randomUUID()}`, apply: (current) => {
        refs.forEach((ref) => assertProjectStoryObjectEditable(current, ref));
        return applyProjectStoryMetadata(current, { refs, metadata: {}, action: "replace", resetOwnership: true, target: liveContext.view.editTarget, context });
      }});
    } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); return false; }
  };
  const quickAssign = (kind: "character" | "faction" | "boolean-property", name: string) => {
    if (!session) return false;
    try {
      commit({ id: `story-assign:${crypto.randomUUID()}`, apply: (current) => createAndAssignStoryEntry(current, { refs: selected.map(({ ref }) => ref), kind, name, target: liveContext.view.editTarget, context }) });
      return true;
    } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); return false; }
  };
  const selectedOpening = selected.length === 1 && selected[0].ref.kind === "opening" ? selected[0].ref as typeof selected[number]["ref"] & { kind: "opening" } : undefined;
  const doorKeys = project && selectedOpening ? <StoryDoorKeys ref={selectedOpening} project={project} locale={locale} target={liveContext.view.editTarget} context={context} onOpenWorldbook={() => openWorldbook("characters")} onAssign={(assignment) => {
    if (!session) return;
    try { commit({ id: `story-key:${crypto.randomUUID()}`, apply: (current) => assignProjectKeyHolders(current, { ...assignment, ref: selectedOpening, target: liveContext.view.editTarget, context }) }); }
    catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); }
  }}/> : undefined;
  const workspace = useStoryWorkspacePanels({ project, controller, locale, context, refs: rawRefs.map(({ type, ...ref }) => ({ ...ref, kind: type })), reviewOpen, onReviewOpenChange: (open) => setReviewProject(open ? project?.id : undefined), commit, setContext: setView, onFocus, onOpenDetails: () => setDetailsOpen(true), onOpenWorldbook: showWorldbook, onOpenRoutes: showRoutes, onError: setError, onPreviewRoute: routeInteraction.previewReview });
  const scenario = project?.story.scenarios.find(({ id }) => id === scenarioId);
  const savedRoute = project?.story.routes.find(({ id }) => id === view.activeRouteId);
  const staleRoute = project && savedRoute && !isStoryRouteCurrent(project, savedRoute);
  const zones = useWorkbenchZones({ project, activePlaceId: snapshot?.activePlaceId, selectionRefs: rawRefs.map(({ type, ...ref }) => ({ ...ref, kind: type })), inspectedRefs: selected.map(({ ref }) => ref), resolveObjects: () => storyResolution?.resolveObjects() ?? [], locale, commit, onError: setError });
  const worldRoot = project?.places.find(({ kind, parentId }) => kind === "world" && !parentId) ?? project?.places.find(({ parentId }) => !parentId);
  const worldDescription = project && worldRoot ? <StoryWorldDescription locale={locale} value={worldRoot.description ?? ""} onChange={(description) => commit({ id: `world-description:${worldRoot.id}`, apply: (current) => ({ ...current, places: current.places.map((place) => place.id === worldRoot.id ? { ...place, description } : place) }) })}/> : undefined;
  // Effective selection is a read-only view model; commands always start from the untouched project.
  const inspectorStory = project ? { ...project.story, objects: [...project.story.objects.filter(({ ref }) => !selected.some((item) => storyRefKey(item.ref) === storyRefKey(ref))), ...selected.map(({ ref, metadata }) => ({ ref, metadata }))] } : empty;
  return {
    liveContext, setView, zoneInspector: zones.inspector ? <>{error && <p role="alert">{error}</p>}{zones.inspector}</> : undefined, clearZone: zones.clear, displayProject: renderedProject, pointPicker,
    leftBookProps: {
      labels: { tree: workbenchCopy[locale].projectTree, worldbook: copy.worldbook, zones: copy.zones, lenses: copy.lenses, routes: copy.routes, properties: copy.propertyDictionary },
      zones: zones.list,
      visibleSections: mode === "drawing" ? ["tree", "zones"] as const : undefined,
      openSections: mode === "story" ? bookOpen : undefined,
      onOpenSectionsChange: mode === "story" ? setBookOpen : undefined,
      worldbook: !project ? undefined : <div className={styles.book}>
        {worldDescription}
        {workspace.reviewOpen ? workspace.reviewPanel : <StoryWorldbook story={project.story} copy={copy} controller={controller} resolvedObjects={resolvedObjects} renderEntry={workspace.renderEntry} excludedCollections={["zones", "propertyDefinitions", "routes"]}/>}
      </div>,
      lenses: project ? <StoryLenses key={project.id} story={project.story} resolvedObjects={resolvedObjects} copy={copy} lenses={controller.collections.lenses} activeLensId={view.activeLensId} activeLensIds={lensIds} previewLens={view.previewLens} onToggle={(id) => updateView({ activeLensIds: lensIds.includes(id) ? lensIds.filter((value) => value !== id) : [...lensIds, id] })} onPreview={(previewLens) => updateView({ previewLens })} onSelect={(activeLensId) => updateView({ activeLensId })} onChange={(items) => controller.editCollection("lenses", items, copy.updateStory)}/> : undefined,
      routes: !project ? undefined : <div className={styles.book}><StoryRoutePanel key={view.activeRouteId ?? "new"} initialRoute={project.story.routes.find(({ id }) => id === view.activeRouteId)} onDelete={(id) => { controller.commit((current) => ({ ...current, routes: current.routes.filter((route) => route.id !== id) }), { id: `story-route-remove:${id}`, label: copy.remove, scope: "story" }); routeInteraction.previewEditor(); updateView({ activeRouteId: undefined }); }} onRequestPoint={routeInteraction.requestPoint} project={project} activePlaceId={snapshot?.activePlaceId} locale={locale} context={context} routeService={routeService} onPreview={routeInteraction.previewEditor} onSave={(route) => { controller.commit((current) => ({ ...current, routes: [...current.routes.filter(({ id }) => id !== route.id), route] }), { id: `story-route:${route.id}`, label: copy.save, scope: "story" }); routeInteraction.previewEditor(route); updateView({ activeRouteId: route.id }); }} onOpenPlace={onOpenPlace}/></div>,
      properties: !project ? undefined : <div className={styles.book}><StoryWorldbook story={project.story} copy={copy} controller={controller} resolvedObjects={resolvedObjects} includedCollections={["propertyDefinitions"]} heading={copy.propertyDictionary}/></div>,
    },
    toolbar: <div className={styles.toolbar}><StoryTopBar copy={copy} view={view} lenses={controller.collections.lenses} scenarios={controller.collections.scenarios} steps={scenario?.steps} routes={controller.collections.routes} previewRoute={routeInteraction.route} onStep={setStepId} onChange={(patch) => { updateView(patch); if ("activeScenarioId" in patch) setStepId(undefined); if ("activeRouteId" in patch) setRouteSelectionVersion((version) => version + 1); }} onScenario={(id) => setView({ scenarioId: id || undefined })}/>
      {workspace.controls}{workspace.notice}
      <div className={styles.history}><button type="button" disabled={!session?.getHistoryState().canUndo} onClick={() => { session?.undo(); refresh(); }}>{locale === "pl" ? "Cofnij" : "Undo"}</button><button type="button" disabled={!session?.getHistoryState().canRedo} onClick={() => { session?.redo(); refresh(); }}>{locale === "pl" ? "Ponów" : "Redo"}</button></div>
      {pointRequest && <p role="status">{locale === "pl" ? `Wskaż ${pointRequest.endpoint === "from" ? "początek" : "koniec"} trasy na mapie.` : `Pick the route ${pointRequest.endpoint} point on the map.`}<button type="button" onClick={routeInteraction.cancelPoint}>{locale === "pl" ? "Anuluj" : "Cancel"}</button></p>}
      {staleRoute && <p role="status">{locale === "pl" ? "Plan lub reguły się zmieniły — zapisana trasa wymaga przeliczenia." : "The plan or rules changed — recalculate the saved route."}<button type="button" onClick={() => openWorldbook("routes")}>{locale === "pl" ? "Otwórz i przelicz" : "Open and recalculate"}</button></p>}
    </div>,
    inspector: <div className={styles.inspectorStack}>{error && <p role="alert">{locale === "pl" ? "Nie zapisano zmiany: " : "Change not saved: "}{error}<button type="button" onClick={() => setError(undefined)}>×</button></p>}<StoryInspector key={JSON.stringify([project?.id ?? null, selection.map(storyRefKey), scenarioId ?? null, stepId ?? null, liveContext.view.editTarget ?? null, selected.map(({ name, description, metadata, editor }) => ({ name, description, metadata, locked: editor.locked }))])} scope={inspectingOpenPlace ? "open-place" : "selection"} readOnly={selected.some(({ editor }) => editor.locked)} story={inspectorStory} selections={selection} resolvedObjects={resolvedInspectorObjects} ownership={selectedOwnership} canResetOwnership={canResetOwnership} detailsOpen={detailsOpen} onDetailsOpenChange={setDetailsOpen} copy={copy} editTarget={liveContext.view.editTarget} onQuickAssign={quickAssign} onOpenWorldbook={openWorldbook} onSelectCurrentPlace={snapshot?.activePlaceId ? () => onSelect({ kind: "place", id: snapshot.activePlaceId! }) : undefined} keyHoldersEditor={doorKeys} onMetadataChange={metadataChange} onResetOwnership={resetOwnership} agentContext={{ label: copy.agent, detail: locale === "pl" ? `Zaznaczone obiekty: ${rawRefs.length}. Agent odczytuje je przez narzędzia strony.` : `Selected objects: ${rawRefs.length}. Available through page tools.` }}/>{zones.membership}</div>,
    overlay: project && snapshot?.activePlaceId ? <><ZoneMapOverlay project={project} activePlaceId={snapshot.activePlaceId} zoom={zoom} selectedZoneId={zones.selectedId}/>{mode === "story" && <><StoryMapOverlay lensView={{ activeLensIds: lensIds, previewLens: view.previewLens }} project={project} activePlaceId={snapshot.activePlaceId} context={context} zoom={zoom}/><StoryRouteOverlay project={project} activePlaceId={snapshot.activePlaceId} context={context} route={routeInteraction.route}/></>}</> : undefined,
  };
}
