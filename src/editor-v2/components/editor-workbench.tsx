"use client";
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { HierarchyNavigator } from "./hierarchy-navigator";
import { useWorkbenchStory } from "./use-workbench-story";
import { StoryDisclosureBook } from "../story/components/story-disclosure-book";
import { createStoryObjectFocus } from "../story/object-focus";
import { AgentChangeNotice, type AgentChangeReport } from "../webmcp/agent-change-notice";
import { useProposalChangeReader } from "../webmcp/use-proposal-change-reader";
import { WebMcpDiagnosticsPanel } from "./webmcp-diagnostics-panel";
import { InspectorPanel } from "./inspector-panel";
import { MapSheet, type MapSelection } from "./map-sheet";
import { DrawingNotice } from "./drawing-notice"; import { confirmationNotice } from "./confirmation-notice";
import { workbenchNoticeKind } from "./workbench-notice";
import { constructionClearCategoryForToolbox, constructionClearNotice } from "./construction-clear-notice"; import { OverlapNotice } from "./overlap-notice"; import { projectLibraryFileActions } from "./project-library-file-actions";
import { WorkbenchToolbox } from "./workbench-toolbox";
import { SelectionActionStrip } from "./selection-action-strip";
import { useEditorPlanning } from "../planning/use-editor-planning";
import { useEditorDrawing } from "./use-editor-drawing";
import { useEditorSelection } from "./use-editor-selection";
import { useSelectionDeleteShortcut } from "./use-selection-delete-shortcut"; import { useSelectionRotation } from "./use-selection-rotation";
import { toolboxCopy } from "../i18n/toolbox-copy";
import { workbenchCopy, type EditorLocale } from "../i18n/workbench-copy";
import { createProjectAtScale, createStarterProject, type StartingScale } from "../model/starter-project";
import { reparentPlace, updatePlaceDetails } from "../model/hierarchy-operations";
import { deleteWorkbenchPlace } from "./workbench-place-deletion";
import { createWorkbenchLevel } from "./workbench-level-creation";
import { projectRevision } from "../state/project-revision";
import { reorderLevel } from "../model/level-operations";
import { addMapLevel, type MapLevelKind } from "../model/add-containing-scale";
import type { EditorProject, MapAppearance, ProjectMeasureSettings } from "../model/project-model";
import { availableWorkSubjects, workLayerAvailability } from "../model/work-context";
import { removeProject, saveProject, setPreference } from "../persistence/project-library";
import { EditorSession, type EditorSessionState } from "../state/editor-session";
import { workLayers, type InstrumentId } from "../toolbox/toolbox-model";
import type { SheetViewport } from "./map-sheet-geometry";
import { buildingOverlapGroups, mergeBuildingOverlapGroup, type BuildingMergeMode } from "../drawing/building-overlap-operations";
import styles from "./editor-workbench.module.css";
import { activatePreferredLayer, nextMapSelection, preferredCutoutTarget, viewportFor } from "./workbench-helpers";
import { loadInitialWorkbenchProject, restoreWorkbenchProject } from "./workbench-project-loading";
import { outlineInstrumentFor } from "../toolbox/toolbox-state";
import { CheckpointPanel } from "./checkpoint-panel";
import { LegalMarginalia, type LegalMarginaliaHandle } from "./legal-marginalia";
import type { LegalMarginaliaSection } from "./legal-marginalia-copy";
import { GlobalLegalFooter } from "./global-legal-footer";
import { checkpointCopy } from "../i18n/checkpoint-copy";
import { useProjectCheckpoints } from "./use-project-checkpoints";
import { useProjectAutosave } from "./use-project-autosave";
import { useWorkbenchProjectSwitch } from "./use-workbench-project-switch";
import { useEditorV2Tools } from "../webmcp/use-editor-tools";
import { requestStoryViewTransition } from "./story-view-transition";
import { canContinueSemanticDraft } from "./toolbox-change-policy";
import { TransitionCreationDialog } from "./transition-creation-dialog"; import { WorkbenchMasthead } from "./workbench-masthead";
import { useEditorTransaction } from "./use-editor-transaction";
const ProjectLibraryDialog = lazy(() => import("./project-library-dialog").then((module) => ({ default: module.ProjectLibraryDialog })));
type Mode = "drawing" | "story";
export function EditorWorkbench() {
  const [locale, setLocale] = useState<EditorLocale>("pl"); const copy = workbenchCopy[locale];
  const [projects, setProjects] = useState<EditorProject[]>([]); const [session, setSession] = useState<EditorSession>(); const [snapshot, setSnapshot] = useState<EditorSessionState>();
  const [mode, setMode] = useState<Mode>("drawing"); const [libraryOpen, setLibraryOpen] = useState(false); const [draftName, setDraftName] = useState(""); const [startingScale, setStartingScale] = useState<StartingScale>("world"); const [pendingDeleteId, setPendingDeleteId] = useState<string>();
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set()); const [selections, setSelections] = useState<MapSelection[]>([]); const [toolboxCollapsed, setToolboxCollapsed] = useState(false);
  const [leftOpen, setLeftOpen] = useState(true); const [rightOpen, setRightOpen] = useState(true);
  const [pendingLegalSection, setPendingLegalSection] = useState<LegalMarginaliaSection>();
  const legalMarginaliaRef = useRef<LegalMarginaliaHandle>(null);
  const [pendingPlaceDeleteId, setPendingPlaceDeleteId] = useState<string>(); const [pendingClearLayer, setPendingClearLayer] = useState(false); const [pendingClearCategory, setPendingClearCategory] = useState<ReturnType<typeof constructionClearCategoryForToolbox>>("all");
  const [sketchVisible, setSketchVisible] = useState(true); const [sketchOpacity, setSketchOpacity] = useState(.75);
  const [eraserSize, setEraserSize] = useState(10);
  const [gapClosingEnabled, setGapClosingEnabled] = useState(false); const [gapClosingTolerance, setGapClosingTolerance] = useState(14);
  const [outlineInstrument, setOutlineInstrument] = useState<InstrumentId>();
  const [cutoutActive, setCutoutActive] = useState(false); const [addOutlineActive, setAddOutlineActive] = useState(false);
  const [pendingOverlapDeparture, setPendingOverlapDeparture] = useState(false); const [dismissedOverlapSignature, setDismissedOverlapSignature] = useState<string>();
  const overlapContinuation = useRef<{ action(replacementPlaceId?: string): void; targetPlaceId?: string } | undefined>(undefined);
  const [viewport, setViewport] = useState<SheetViewport>({ center: { x: 60, y: 40 }, zoom: 6, rotation: 0 });
  const [operationError, setOperationError] = useState<string>();
  const autosave = useProjectAutosave(snapshot?.project, (saved) => setProjects((current) => [saved, ...current.filter(({ id }) => id !== saved.id)]));
  const [bootError, setBootError] = useState<string>();
  function installLoadedProject(loaded: Awaited<ReturnType<typeof restoreWorkbenchProject>>) {
    setSession(loaded.session); setSnapshot(loaded.snapshot); setSelections([]); setViewport(loaded.viewport);
    setExpandedIds(new Set(loaded.project.places.map(({ id }) => id))); setSketchVisible(loaded.sketchVisible); setSketchOpacity(loaded.sketchOpacity);
    setEraserSize(loaded.eraserSize); setGapClosingEnabled(loaded.gapClosingEnabled); setGapClosingTolerance(loaded.gapClosingTolerance);
  }
  const projectNavigation = useWorkbenchProjectSwitch({ session, locale, autosave, install: installLoadedProject, onError: setOperationError });
  const { loadProject } = projectNavigation;
  const workbenchTransaction = useEditorTransaction(session, () => refresh(), (failure) => setOperationError(failure === "transaction-failed" ? copy.editingStatus.blocked["transaction-failed"] : undefined));
  useEffect(() => { let cancelled = false;
    void loadInitialWorkbenchProject().then(({ locale, projects, loaded }) => {
      if (!cancelled) { setLocale(locale); setProjects(projects); installLoadedProject(loaded); }
    }).catch((error: unknown) => { if (!cancelled) setBootError(error instanceof Error ? error.message : String(error)); });
    return () => { cancelled = true; };
  }, []);
  useEffect(() => {
    if (!rightOpen || !pendingLegalSection) return;
    const section = pendingLegalSection;
    const frame = requestAnimationFrame(() => {
      legalMarginaliaRef.current?.openSection(section);
      setPendingLegalSection(undefined);
    });
    return () => cancelAnimationFrame(frame);
  }, [pendingLegalSection, rightOpen]);
  function refresh(nextSession = session) { if (nextSession && projectNavigation.getSession() === nextSession) setSnapshot(nextSession.getViewState()); }
  function changeLocale() { const next: EditorLocale = locale === "pl" ? "en" : "pl"; setLocale(next); localStorage.setItem("cartographer-locale", next); document.documentElement.lang = next; void setPreference("locale", next); }
  function openPlace(placeId: string) {
    drawing.requestAfterDraft(() => requestAfterOverlap((replacementId) => commitOpenPlace(replacementId ?? placeId), placeId));
  }
  function selectOnMap(next?: MapSelection, additive = false) {
    story.clearZone();
    setSelections((current) => nextMapSelection(current, next, additive));
    if (next?.kind !== "place") return;
    const parentId = snapshot?.project.places.find(({ id }) => id === next.id)?.parentId;
    setExpandedIds((current) => new Set([...current, ...(parentId ? [parentId] : []), next.id]));
  }
  function selectSurfaceFromTree(surfaceId: string, ownerId: string) {
    const owner = snapshot?.project.places.find(({ id }) => id === ownerId);
    const mapId = owner?.kind === "room" ? owner.parentId : ownerId;
    if (mapId && mapId !== activePlaceId) commitOpenPlace(mapId);
    selectOnMap({ kind: "surface", id: surfaceId });
  }
  function selectForEditing(next: MapSelection, additive = false) {
    if (!session || !snapshot) return;
    drawing.requestAfterDraft(() => {
      selectOnMap(next, additive); refresh();
    });
  }
  function commitOpenPlace(placeId: string) {
    if (!session) return; const current = session.getState(); const requested = current.project.places.find(({ id }) => id === placeId); if (!requested) return;
    const levels = requested.kind === "building" ? current.project.places.filter(({ parentId, kind }) => parentId === requested.id && kind === "level") : [];
    const openedId = levels.length === 1 ? levels[0].id : placeId;
    session.openPlace(openedId); activatePreferredLayer(session, openedId); setSelections([]); setViewport(viewportFor(current.project, openedId)); void setPreference(`activePlaceId:${current.project.id}`, openedId); refresh();
  }
  function requestAfterOverlap(action: (replacementPlaceId?: string) => void, targetPlaceId?: string) {
    if (!session) return; const current = session.getState(); const groups = current.activePlaceId ? buildingOverlapGroups(current.project, current.activePlaceId) : [];
    if (!groups.length) { action(); return; }
    overlapContinuation.current = { action, targetPlaceId }; setPendingOverlapDeparture(true); setDismissedOverlapSignature(undefined);
  }
  function mergeOverlaps(mode: BuildingMergeMode) {
    if (!session) return; const state = session.getState(); if (!state.activePlaceId) return;
    const groups = buildingOverlapGroups(state.project, state.activePlaceId); let project = state.project; const replacements = new Map<string, string>();
    for (const group of groups) {
      const ids = group.map(({ id }) => id); const result = mergeBuildingOverlapGroup(project, ids, mode, { createId: () => crypto.randomUUID(), createRoomName: (index) => locale === "pl" ? `Pomieszczenie ${index}` : `Room ${index}` });
      if (result.state !== "merged") continue;
      ids.filter((id) => id !== result.survivorId).forEach((id) => replacements.set(id, result.survivorId)); project = result.project;
    }
    if (!workbenchTransaction.commit(`merge-overlaps:${mode}`, project)) return;
    setSelections([]); setDismissedOverlapSignature(undefined);
    if (buildingOverlapGroups(project, state.activePlaceId).length) { setPendingOverlapDeparture(true); return; }
    const continuation = overlapContinuation.current; overlapContinuation.current = undefined; setPendingOverlapDeparture(false);
    continuation?.action(continuation.targetPlaceId ? replacements.get(continuation.targetPlaceId) : undefined);
  }
  function updatePlace(placeId: string, details: { name?: string; description?: string; tags?: string[]; appearance?: MapAppearance }) { if (!session) return; workbenchTransaction.commit(`details:${placeId}`, (project) => updatePlaceDetails(project, placeId, details)); }
  function updateMeasureSettings(settings: ProjectMeasureSettings) { if (!session) return; workbenchTransaction.commit("settings:measurements", (project) => ({ ...project, measureSettings: settings })); }
  function reparent(placeId: string, parentId?: string) { if (!session || !workbenchTransaction.commit(`reparent:${placeId}`, (project) => reparentPlace(project, placeId, parentId))) return; setSelections([]); }
  function deletePlace(placeId: string) {
    if (!session) return;
    const result = deleteWorkbenchPlace(session, placeId, workbenchTransaction.commit); if (!result) return;
    if (result.fallbackId) { setViewport(viewportFor(result.project, result.fallbackId)); void setPreference(`activePlaceId:${result.project.id}`, result.fallbackId); }
    setSelections([]); refresh();
  }
  function requestDeletePlace(placeId: string) {
    if (!snapshot || snapshot.project.places.find(({ id }) => id === placeId)?.locked) return;
    const hasContents = snapshot.project.places.some(({ parentId }) => parentId === placeId) || [...snapshot.project.elements, ...snapshot.project.surfaces].some(({ belongsToId }) => belongsToId === placeId);
    if (hasContents) setPendingPlaceDeleteId(placeId); else deletePlace(placeId);
  }
  function addLevel(buildingId: string, position: "above" | "below") {
    if (!session || !snapshot) return;
    const id = createWorkbenchLevel(session, buildingId, position, locale, workbenchTransaction.commit); if (!id) return;
    setExpandedIds((current) => new Set([...current, buildingId, id])); session.openPlace(id); activatePreferredLayer(session, id); void setPreference(`activePlaceId:${snapshot.project.id}`, id); setSelections([]); setViewport(viewportFor(session.getState().project, id)); refresh();
  }
  function changeLevelOrder(levelId: string, beforeLevelId?: string) {
    if (!session) return;
    workbenchTransaction.commit(`reorder-level:${levelId}`, (project) => reorderLevel(project, levelId, beforeLevelId));
  }
  function addBroaderMap(placeId: string, kind: MapLevelKind, name?: string) {
    drawing.requestAfterDraft(() => requestAfterOverlap(() => commitAddBroaderMap(placeId, kind, name)));
  }
  function commitAddBroaderMap(placeId: string, desiredKind: MapLevelKind, chosenName?: string) {
    if (!session || !snapshot) return;
    const result = addMapLevel(snapshot.project, placeId, desiredKind, chosenName, locale, { createId: () => crypto.randomUUID() }); if (!result) return;
    if (!workbenchTransaction.commit(`wrap:${placeId}:${desiredKind}`, result.project)) return;
    session.openPlace(result.openedId); activatePreferredLayer(session, result.openedId); void setPreference(`activePlaceId:${snapshot.project.id}`, result.openedId); setExpandedIds((current) => new Set([...current, ...result.addedIds, result.openedId])); setSelections([]); setViewport(viewportFor(result.project, result.openedId)); refresh();
  }
  async function createProject(input?: { name: string; scale: StartingScale }) { const name = (input?.name ?? draftName).trim(); if (!name) return; const created = await saveProject(createProjectAtScale(crypto.randomUUID(), name, locale, input?.scale ?? startingScale)); setProjects((current) => [created, ...current]); setDraftName(""); setLibraryOpen(false); drawing.reset(); await loadProject(created); return created; }
  async function duplicateProject(id: string) { const source = snapshot?.project.id === id ? snapshot.project : projects.find((project) => project.id === id); if (!source) return; const duplicate = await saveProject({ ...structuredClone(source), id: crypto.randomUUID(), name: `${source.name} — ${locale === "pl" ? "kopia" : "copy"}` }); setProjects((current) => [duplicate, ...current]); return duplicate; }
  async function deleteProject(id: string) { try { await autosave.remove(id, () => removeProject(id)); let remaining = projects.filter((project) => project.id !== id); if (!remaining.length) remaining = [await saveProject(createStarterProject(crypto.randomUUID(), locale === "pl" ? "Nowy projekt" : "New project", locale))]; setProjects((current) => [...current.filter((project) => project.id !== id), ...remaining.filter((project) => !current.some(({ id }) => id === project.id))]); setPendingDeleteId(undefined); if (projectNavigation.getSession()?.getViewState().project.id === id && await loadProject(remaining[0])) drawing.reset(); return true; } catch (error) { setOperationError(String(error)); return false; } }
  async function renameProjectInLibrary(id: string, name: string) { const active = projectNavigation.getSession(); if (active?.getViewState().project.id === id) { if (!workbenchTransaction.commit(`rename-project:${id}`, (project) => ({ ...project, name: name.trim() }))) return; const result = await autosave.flush(active.getViewState().project); return result.state === "saved" ? result.project : undefined; } const source = autosave.latest(id) ?? projects.find((project) => project.id === id); if (!source) return; const result = await autosave.flush({ ...source, name: name.trim() }); return result.state === "saved" ? result.project : undefined; }
  async function openSavedProject(id: string) { const project = snapshot?.project.id === id ? snapshot.project : projects.find((candidate) => candidate.id === id); if (!project) return false; const opened = await loadProject(project); if (opened) drawing.reset(); return opened; }
  const { exportProject, exportView, importProject } = projectLibraryFileActions({ snapshot, projects, locale, viewport, onError: setOperationError, onImport: (project) => setProjects((current) => [project, ...current]) });
  const cutoutTarget = preferredCutoutTarget(snapshot?.project, selections.length === 1 ? selections[0] : undefined, snapshot?.activePlaceId, snapshot?.boundaryEditing);
  const drawing = useEditorDrawing({ session, snapshot, locale, copy, refresh: () => refresh(), onSelection: selectOnMap, cutoutActive, addOutlineActive, cutoutTarget });
  const enterStory = () => { drawing.leaveDrawing(); setMode("story"); };
  const planning = useEditorPlanning({ session, snapshot, selections, locale, refresh: () => refresh() }); const rotation = useSelectionRotation({ session, snapshot, selections, locale, refresh: () => refresh(), onSelections: setSelections });
  const editing = useEditorSelection({ session, snapshot, locale, copy, refresh: () => refresh(), onSelection: selectOnMap, onSelections: setSelections }); useSelectionDeleteShortcut(mode === "drawing" && !libraryOpen && selections.length ? () => editing.removeMany(selections) : undefined);
  const activePlaceId = snapshot?.activePlaceId; const history = session?.getHistoryState() ?? { canUndo: false, canRedo: false }; const currentProject = snapshot?.project; const headerName = currentProject?.name ?? "…";
  const story = useWorkbenchStory({ session, snapshot, selections, locale, mode, refresh: () => refresh(), zoom: viewport.zoom, onSelect: selectOnMap, onOpenPlace: commitOpenPlace, onFocus: createStoryObjectFocus(() => session?.getViewState(), commitOpenPlace, setSelections), onOpenWorldbook: () => drawing.requestAfterDraft(() => requestAfterOverlap(enterStory)) });
  const [agentChange, setAgentChange] = useState<AgentChangeReport>();
  const readProposalChanges = useProposalChangeReader(session);
  const projectCheckpoints = useProjectCheckpoints(currentProject, locale); useEditorV2Tools(session, activePlaceId, { getEditorContext: () => story.liveContext, setStoryView: (view) => requestStoryViewTransition({ view, drawing, hasOverlap: () => { const current = session?.getState(); const active = current?.activePlaceId; return Boolean(current && active && buildingOverlapGroups(current.project, active).length); }, requestAfterOverlap: (action) => requestAfterOverlap(action), setMode: enterStory, setStoryView: story.setView }), preserveAgentChange: projectCheckpoints.preserveAgentChange, reportAgentChange: setAgentChange, refresh: () => refresh(), openPlace: (placeId) => { if (!session) return false; const exists = session.getState().project.places.some(({ id }) => id === placeId); if (exists) commitOpenPlace(placeId); return exists; }, focusObjects: (refs) => createStoryObjectFocus(() => session?.getViewState(), commitOpenPlace, setSelections)(refs.map(({ type, ...ref }) => ({ ...ref, kind: type }))), clearFocus: () => setSelections([]), getCheckpoints: () => projectCheckpoints.items, createCheckpoint: (name) => projectCheckpoints.preserve(name), deleteCheckpoint: async (id) => { await projectCheckpoints.remove(id); return true; }, showCheckpoint: (checkpointId, opacity) => { if (checkpointId && !projectCheckpoints.items.some(({ id }) => id === checkpointId)) return false; projectCheckpoints.setActiveId(checkpointId); if (opacity !== undefined) projectCheckpoints.setOpacity(opacity); return true; }, getProjects: () => projects, createProject: (name, scale) => createProject({ name, scale }), openProject: openSavedProject, duplicateProject, renameProject: renameProjectInLibrary, deleteProject });
  const overlapGroups = useMemo(() => currentProject && activePlaceId ? buildingOverlapGroups(currentProject, activePlaceId) : [], [activePlaceId, currentProject]);
  const overlapSignature = overlapGroups.map((group) => group.map(({ id }) => id).join(":" )).join("|");
  const activePlaceName = currentProject?.places.find(({ id }) => id === activePlaceId)?.name ?? "…";
  const activeLayerLabel = toolboxCopy[locale].layers[snapshot?.toolbox.activeLayerId ?? "sketch"];
  const clearLayerLabel = snapshot?.toolbox.activeLayerId === "construction" || snapshot?.toolbox.activeLayerId === "openings"
    ? copy.clearConstructionQuestion(activePlaceName)
    : copy.clearLayerQuestion(activeLayerLabel, activePlaceName);
  const placeDeleteNotice = pendingPlaceDeleteId ? confirmationNotice(copy.deletePlaceQuestion, copy.deletePlaceWithContents, copy.drawingStatus.cancel, () => { const id = pendingPlaceDeleteId; setPendingPlaceDeleteId(undefined); deletePlace(id); }, () => setPendingPlaceDeleteId(undefined)) : undefined;
  const roadNotice = snapshot?.roadConflict ? { message: copy.drawingStatus.blocked["road-obstacle"], tone: "warning" as const, actions: [{ id: "close-road-notice", label: copy.close, onClick: () => { session?.dismissRoadConflict(); refresh(); } }] } : undefined;
  const clearLayerNotice = pendingClearLayer ? pendingClearCategory !== "all"
    ? constructionClearNotice({ locale, place: activePlaceName, category: pendingClearCategory, confirmLabel: copy.confirmClearLayer, cancelLabel: copy.drawingStatus.cancel, onCategoryChange: setPendingClearCategory, onConfirm: () => { setPendingClearLayer(false); if (session && workbenchTransaction.accept(session.clearCurrentLayer(snapshot?.toolbox.activeLayerId, pendingClearCategory))) setSelections([]); }, onCancel: () => setPendingClearLayer(false) })
    : confirmationNotice(clearLayerLabel, copy.confirmClearLayer, copy.drawingStatus.cancel, () => { setPendingClearLayer(false); if (session && workbenchTransaction.accept(session.clearCurrentLayer())) setSelections([]); }, () => setPendingClearLayer(false)) : undefined;
  const secondaryNotice = placeDeleteNotice ?? clearLayerNotice ?? drawing.notice ?? rotation.notice ?? editing.notice;
  const otherNotice = roadNotice ?? secondaryNotice;
  const hasOverlapNotice = workbenchNoticeKind({ roadNotice, overlapNotice: overlapGroups.length > 0 && (pendingOverlapDeparture || dismissedOverlapSignature !== overlapSignature), pendingOverlapDeparture, otherNotice: secondaryNotice }) === "overlap";
  const tree = useMemo(() => currentProject?.places ?? [], [currentProject]);
  const availableLayerIds = useMemo(() => new Set(workLayers.filter(({ id }) => currentProject && activePlaceId && workLayerAvailability(currentProject, activePlaceId, id).available).map(({ id }) => id)), [activePlaceId, currentProject]);
  const availableSubjectIds = useMemo(() => currentProject && activePlaceId ? new Set(availableWorkSubjects(currentProject, activePlaceId, "equipment").map(({ id }) => id)) : undefined, [activePlaceId, currentProject]);
  if (!session || !snapshot || !currentProject || !activePlaceId) return <main className={styles.loading}>{bootError ? <section role="alert"><h1>Nie udało się wczytać projektu</h1><p>Zapisane projekty nie zostały usunięte ani zastąpione.</p><pre>{bootError}</pre><button type="button" onClick={() => window.location.reload()}>Spróbuj ponownie</button></section> : "✦"}</main>;
  const selectionInstrument = cutoutActive || addOutlineActive ? outlineInstrument ?? outlineInstrumentFor(snapshot.toolbox) : snapshot.toolbox.byLayer[snapshot.toolbox.activeLayerId].instrumentId;
  const selecting = mode === "drawing" && (selectionInstrument === "select" || selectionInstrument === "marquee");
  const canClearLayer = !currentProject.places.find(({ id }) => id === activePlaceId)?.locked;
  const deleteListedSelection = (selection: MapSelection) => drawing.requestAfterDraft(() => selection.kind === "place" ? requestDeletePlace(selection.id) : editing.remove(selection));
  return <main className={styles.workshop}>
    <WorkbenchMasthead locale={locale} copy={copy} mode={mode} onLanguage={changeLocale} onModeToggle={() => mode === "story" ? setMode("drawing") : drawing.requestAfterDraft(() => requestAfterOverlap(enterStory))}/>
    <section className={styles.projectBar}><button type="button" className={styles.libraryButton} onClick={() => drawing.requestAfterDraft(() => setLibraryOpen(true))}><span>✦</span><small>{copy.project}</small><strong><b>{headerName}</b><i>{copy.projects}</i></strong></button><div className={styles.modes}><button type="button" className={mode === "drawing" ? styles.activeMode : undefined} onClick={() => setMode("drawing")}>{copy.drawing}</button><button type="button" className={mode === "story" ? styles.activeMode : undefined} onClick={() => drawing.requestAfterDraft(() => requestAfterOverlap(enterStory))}>{copy.story}</button><em role={autosave.saveFailed ? "alert" : undefined}>{autosave.saveFailed ? copy.saveFailed : autosave.saving ? copy.saving : copy.saved}</em>{autosave.saveFailed && <button type="button" onClick={() => void autosave.flushSession(session)}>{copy.retrySave}</button>}</div></section>
    {operationError && !libraryOpen && <p className={styles.operationError} role="alert">{operationError}</p>}
    <section className={`${styles.desk}${leftOpen ? "" : ` ${styles.leftClosed}`}${rightOpen ? "" : ` ${styles.rightClosed}`}`}>
      <aside className={styles.leftBook}><button type="button" className={styles.bookFold} title={locale === "pl" ? "Zwiń lewą księgę" : "Fold left book"} aria-label={locale === "pl" ? "Zwiń lewą księgę" : "Fold left book"} onClick={() => setLeftOpen(false)}>‹</button><header className={styles.bookHeading}><h2>{mode === "story" ? copy.story : copy.atlas}</h2></header><StoryDisclosureBook {...story.leftBookProps} tree={<HierarchyNavigator places={tree} surfaces={currentProject.surfaces} activePlaceId={activePlaceId} expandedPlaceIds={expandedIds} copy={copy.hierarchy} onOpenPlace={openPlace} onSelectSurface={selectSurfaceFromTree} onExpandedChange={(id, expanded) => setExpandedIds((current) => { const next = new Set(current); if (expanded) next.add(id); else next.delete(id); return next; })} onAddContainingPlace={addBroaderMap} onAddLevel={(buildingId, position) => drawing.requestAfterDraft(() => addLevel(buildingId, position))} onReorderLevel={(levelId, beforeLevelId) => drawing.requestAfterDraft(() => changeLevelOrder(levelId, beforeLevelId))}/>}/></aside>
      {!leftOpen && <button type="button" className={`${styles.bookTab} ${styles.leftTab}`} title={locale === "pl" ? "Rozwiń lewą księgę" : "Open left book"} aria-label={locale === "pl" ? "Rozwiń lewą księgę" : "Open left book"} onClick={() => setLeftOpen(true)}>›</button>}
      <section className={styles.center} data-mode={mode}>{mode === "story" && story.toolbar}<AgentChangeNotice canUndo={Boolean(agentChange?.revision === projectRevision(currentProject) && history.canUndo)} report={agentChange} locale={locale} currentRevision={projectRevision(currentProject)} currentProjectId={currentProject.id} onReadProposalChanges={readProposalChanges} onUndo={() => { session.undo(); refresh(); setAgentChange(undefined); }} onClose={() => setAgentChange(undefined)} onCompare={(id) => projectCheckpoints.setActiveId(id)}/>
        {mode === "drawing" && <div className={styles.toolDock}>
          <WorkbenchToolbox state={snapshot.toolbox} copy={toolboxCopy[locale]} availableLayerIds={availableLayerIds} availableSubjectIds={availableSubjectIds} boundaryName={activePlaceName} boundaryEditing={snapshot.boundaryEditing} cutoutActive={cutoutActive} addOutlineActive={addOutlineActive} canCutout={Boolean(cutoutTarget)} canAddOutline={Boolean(preferredCutoutTarget(currentProject, selections.length === 1 ? selections[0] : undefined, snapshot.activePlaceId, snapshot.boundaryEditing, "add"))} outlineInstrumentId={outlineInstrument} onOutlineInstrumentChange={(instrument) => drawing.requestAfterDraft(() => setOutlineInstrument(instrument))} collapsed={toolboxCollapsed} canUndo={drawing.canUndoDraft || history.canUndo} canRedo={drawing.canRedoDraft || history.canRedo} canClearLayer={canClearLayer} clearLayerLabel={clearLayerLabel} sketchVisible={sketchVisible} sketchOpacity={sketchOpacity} eraserSize={eraserSize} gapClosingEnabled={gapClosingEnabled} gapClosingTolerance={gapClosingTolerance} pencilSmoothing={currentProject.measureSettings.pencilSmoothing} onPencilSmoothing={(amount) => updateMeasureSettings({ ...currentProject.measureSettings, pencilSmoothing: amount })} selectionActions={<SelectionActionStrip rotationControl={rotation.input} planningActions={planning.planningActions} selections={selections} project={currentProject} copy={copy} onDelete={editing.removeMany} onDuplicate={editing.duplicateElements} onRotate={editing.rotateElements} onMirror={editing.mirrorElements} onMerge={editing.mergeElements} onJoinRoads={editing.joinSelectedRoads} onDuplicateSurfaces={editing.duplicateSurfaces} onTransformSurfaces={editing.transformSurfaces} onMergeSurfaces={editing.mergeSurfaces} onMergeRooms={editing.mergeRooms} onDuplicateRooms={editing.duplicateRooms} onTransformRooms={editing.transformRooms} onDuplicatePlaces={editing.duplicatePlaces} onTransformPlaces={editing.transformPlaces} onMergePlaces={editing.mergePlaces}/>}
            onChange={(toolbox) => { const apply = () => { if (toolbox.activeLayerId !== snapshot.toolbox.activeLayerId) { setSelections([]); setCutoutActive(false); setAddOutlineActive(false); } session.setToolbox(toolbox); refresh(); }; if (canContinueSemanticDraft(snapshot.toolbox, toolbox, drawing.hasGestureDraft)) apply(); else drawing.requestAfterDraft(apply); }} onBoundaryEditing={(active) => drawing.requestAfterDraft(() => { setCutoutActive(false); setAddOutlineActive(false); session.setBoundaryEditing(active); refresh(); })} onCutoutActive={(active) => drawing.requestAfterDraft(() => { setCutoutActive(active); if (active) { setAddOutlineActive(false); setOutlineInstrument(outlineInstrumentFor(snapshot.toolbox, outlineInstrument)); } })} onAddOutlineActive={(active) => drawing.requestAfterDraft(() => { setAddOutlineActive(active); if (active) { setCutoutActive(false); setOutlineInstrument(outlineInstrumentFor(snapshot.toolbox, outlineInstrument)); } })} onUndo={() => { if (!drawing.undoDraft()) { session.undo(); refresh(); } }} onRedo={() => { if (!drawing.redoDraft()) { session.redo(); refresh(); } }} onClearLayer={() => drawing.requestAfterDraft(() => { setPendingClearCategory(constructionClearCategoryForToolbox(snapshot.toolbox)); setPendingClearLayer(true); })} onCollapsed={setToolboxCollapsed} onSketchVisible={(visible) => { setSketchVisible(visible); void setPreference(`sketchVisible:${currentProject.id}`, String(visible)); }} onSketchOpacity={(opacity) => { setSketchOpacity(opacity); void setPreference(`sketchOpacity:${currentProject.id}`, String(opacity)); }} onEraserSize={(size) => { setEraserSize(size); void setPreference(`eraserSize:${currentProject.id}`, String(size)); }} onGapClosingEnabled={(enabled) => { setGapClosingEnabled(enabled); if (enabled) drawing.correctPendingDraft(gapClosingTolerance / viewport.zoom); void setPreference(`gapClosingEnabled:${currentProject.id}`, String(enabled)); }} onGapClosingTolerance={(tolerance) => { setGapClosingTolerance(tolerance); if (gapClosingEnabled) drawing.correctPendingDraft(tolerance / viewport.zoom); void setPreference(`gapClosingTolerance:${currentProject.id}`, String(tolerance)); }}/>
        </div>}<div className={styles.sheetFrame}><div className={styles.sheetTitle}>{currentProject.places.find(({ id }) => id === activePlaceId)?.name}</div>{drawing.transitionRequest && <TransitionCreationDialog project={currentProject} activePlaceId={activePlaceId} kind={drawing.transitionRequest.input.subjectId === "opening.elevator" ? "elevator" : "stairs"} copy={copy} onConfirm={drawing.confirmTransition} onCancel={drawing.cancelTransition}/>}{hasOverlapNotice && (pendingOverlapDeparture || !otherNotice) ? <OverlapNotice copy={copy.overlapDecision} mustResolve={pendingOverlapDeparture} onMerge={mergeOverlaps} onResume={() => { overlapContinuation.current = undefined; setPendingOverlapDeparture(false); setDismissedOverlapSignature(overlapSignature); }}/> : <DrawingNotice notice={otherNotice}/>}<MapSheet selectionOnly={mode === "story"} pointPicker={mode === "story" ? story.pointPicker : undefined} storyOverlay={story.overlay} rotationControl={selecting && !planning.nodeInsertion.active ? rotation.control : undefined} onNoteTextChange={mode === "drawing" ? editing.editNoteText : undefined} project={mode === "story" ? story.displayProject ?? currentProject : rotation.previewProject ?? currentProject} activePlaceId={activePlaceId} viewport={viewport} copy={copy.map} nodeInsertion={mode === "drawing" ? planning.nodeInsertion : undefined} selectedIds={selections.map(({ id }) => id)} draftStrokes={drawing.draftStrokes} gestureDraft={drawing.gestureDraft} interaction={mode === "drawing" ? { enabled: !selecting, instrumentId: selectionInstrument } : undefined} selectionEditing={selecting} outlineEditing={mode === "drawing" && snapshot.boundaryEditing} selectionMode={selectionInstrument === "marquee" ? "marquee" : "direct"} selectionLayerId={selecting ? snapshot.toolbox.activeLayerId : undefined} sketchVisible={sketchVisible} sketchOpacity={sketchOpacity} eraserSize={eraserSize} gapClosingEnabled={gapClosingEnabled} gapClosingTolerance={gapClosingTolerance} tracingProject={projectCheckpoints.tracingProject} tracingOpacity={projectCheckpoints.opacity} onSelect={selecting ? selectForEditing : selectOnMap} onSelectMany={setSelections} onOpenPlace={openPlace} onClearSelection={() => selectOnMap(undefined)} onDeleteSelected={selections.length ? () => editing.removeMany(selections) : undefined} onCancelDrawing={drawing.cancelCurrentDrawing} onViewportChange={setViewport} onMeasureSettingsChange={updateMeasureSettings} onGesture={drawing.applyGesture} onGestureDraftChange={drawing.setGestureDraft} onMoveSelection={(selection, delta) => editing.moveMany(selections.some(({ kind, id }) => kind === selection.kind && id === selection.id) ? selections : [selection], delta)} onMoveWallEndpoint={editing.moveEndpoint} onResizeOpening={editing.resizeOpening} onResizeTransition={editing.resizeTransition} onResizeElement={editing.resizeElement} onResizeSurface={editing.resizeSurface} onResizePlace={editing.resizePlace} onMoveElementVertex={editing.moveElementVertex} onMoveSurfaceVertex={editing.moveSurfaceVertex} onMovePlaceVertex={editing.movePlaceVertex}/></div></section>
      <aside className={styles.rightBook}><button type="button" className={styles.bookFold} title={locale === "pl" ? "Zwiń prawą księgę" : "Fold right book"} aria-label={locale === "pl" ? "Zwiń prawą księgę" : "Fold right book"} onClick={() => setRightOpen(false)}>›</button><header className={`${styles.bookHeading} ${styles.inspectorHeading}`}><small>{copy.inspector}</small><span aria-hidden="true">✦</span></header><InspectorPanel selectionEditor={story.zoneInspector} detailsEditor={story.inspector} onNoteTextChange={editing.editNoteText} onDeleteSelection={deleteListedSelection} onUpdateSelection={editing.editSelectionState} project={currentProject} activePlaceId={activePlaceId} selections={selections} copy={copy} readOnly={mode === "story"} onUpdatePlace={updatePlace} onUpdateElement={editing.editElement} onUpdateSurface={editing.editSurface} onResizeOpening={editing.resizeOpening} onUpdateTransition={editing.editTransition} onDeletePlace={(id) => drawing.requestAfterDraft(() => requestDeletePlace(id))} onAddLevel={(id, position) => drawing.requestAfterDraft(() => requestAfterOverlap((replacementId) => addLevel(replacementId ?? id, position), id))} onReparentPlace={(id, parentId) => drawing.requestAfterDraft(() => reparent(id, parentId))} onSelect={mode === "drawing" ? selectForEditing : selectOnMap} geometryTools={mode === "drawing" ? planning.inspector : undefined} footer={<CheckpointPanel error={projectCheckpoints.error} checkpoints={projectCheckpoints.items} activeCheckpointId={projectCheckpoints.activeId} tracingOpacity={projectCheckpoints.opacity} copy={checkpointCopy[locale]} locale={locale} onSave={(name) => void projectCheckpoints.preserve(name)} onTracing={projectCheckpoints.setActiveId} onOpacity={projectCheckpoints.setOpacity} onRestore={(id) => void (async () => { const result = await projectNavigation.restoreCheckpoint(id, (before, after) => projectCheckpoints.preserveAgentChange(before, after, checkpointCopy[locale].safetyName(new Date()), "safety")); if (!result) return; drawing.reset(); setSelections([]); if (!result.project.places.some((place) => place.id === activePlaceId)) { const root = result.project.places.find((place) => !place.parentId); if (root) result.session.openPlace(root.id); } refresh(result.session); })()} onRemove={(id) => void projectCheckpoints.remove(id)}/>} bottom={<LegalMarginalia ref={legalMarginaliaRef} locale={locale}/>}/></aside>
      {!rightOpen && <button type="button" className={`${styles.bookTab} ${styles.rightTab}`} title={locale === "pl" ? "Rozwiń prawą księgę" : "Open right book"} aria-label={locale === "pl" ? "Rozwiń prawą księgę" : "Open right book"} onClick={() => setRightOpen(true)}>‹</button>}
    </section>
    {libraryOpen && <Suspense fallback={<p className={styles.loading} role="status">{locale === "pl" ? "Otwieranie biblioteki…" : "Opening the library…"}</p>}><ProjectLibraryDialog projects={projects} activeProjectId={currentProject.id} copy={copy} draftName={draftName} startingScale={startingScale} pendingDeleteId={pendingDeleteId} error={operationError} onDraftName={setDraftName} onStartingScale={setStartingScale} onCreate={() => drawing.requestAfterDraft(() => requestAfterOverlap(() => void createProject()))} onOpen={(id) => drawing.requestAfterDraft(() => requestAfterOverlap(() => { void openSavedProject(id).then((opened) => { if (opened) setLibraryOpen(false); }); }))} onDuplicate={(id) => void duplicateProject(id)} onRename={(id, name) => void renameProjectInLibrary(id, name)} onExport={exportProject} onExportView={(id, format) => { void exportView(id, format); }} onImport={(file) => void importProject(file)} onAskDelete={setPendingDeleteId} onDelete={(id) => void deleteProject(id)} onCancelDelete={() => setPendingDeleteId(undefined)}
      onClose={() => { setOperationError(undefined); setLibraryOpen(false); }}/></Suspense>}
    <GlobalLegalFooter locale={locale} onOpenMarginalia={(section) => { setRightOpen(true); setPendingLegalSection(section); }}/>
    <WebMcpDiagnosticsPanel locale={locale}/>
  </main>;
}
