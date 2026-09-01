import { ribbonAppearance } from "../geometry/ribbon-style";
import { isRibbonElement } from "../geometry/ribbon-geometry";
import type { MapSelection } from "./map-sheet";
import { selectionIsLocked } from "../drawing/selection-locks";
import type { ConstructionSurface, DrawingElement, EditorProject, MapAppearance, PlaceNode } from "../model/project-model";
import type { WorkbenchCopy } from "../i18n/workbench-copy";
import styles from "./inspector-panel.module.css";
import { constructionPlaceForView } from "./map-sheet-geometry";
import { AppearanceFields } from "./appearance-fields";
import { SheetObjectList } from "./sheet-object-list";
import { validContainingPlaces, validElementOwners } from "../model/hierarchy-operations";
import type { ReactNode } from "react";
import type { VerticalTransition } from "../construction/wall-features";
import { defaultElementColor } from "../model/element-appearance";

type Props = {
  project: EditorProject;
  activePlaceId: string;
  selections?: MapSelection[];
  copy: WorkbenchCopy;
  onUpdatePlace(placeId: string, details: { name?: string; description?: string; tags?: string[]; appearance?: MapAppearance }): void;
  onUpdateElement(id: string, details: { widthMeters?: number; name?: string; description?: string; tags?: string[]; belongsToId?: string; appearance?: MapAppearance; properties?: Record<string, string | number | boolean | null>; geometry?: DrawingElement["geometry"]; visible?: boolean; locked?: boolean }): void;
  onNoteTextChange?(id: string, text: string): void;
  onUpdateSurface?(id: string, details: { name?: string; description?: string; tags?: string[]; belongsToId?: string; appearance?: MapAppearance; visible?: boolean; locked?: boolean; attachment?: "free" | "attached"; elevation?: number }): void;
  onResizeOpening(id: string, width: number): void;
  onUpdateTransition?(id: string, details: Partial<Pick<VerticalTransition, "kind" | "sourceLevelId" | "targetLevelId" | "connectedLevelIds" | "style" | "direction" | "sameLevelRise">>): void;
  onDeletePlace(placeId: string): void;
  onAddLevel(buildingId: string, position: "above" | "below"): void;
  onReparentPlace(placeId: string, containingPlaceId?: string): void;
  onSelect(selection: MapSelection, additive?: boolean): void;
  onDeleteSelection?(selection: MapSelection): void;
  onUpdateSelection?(selection: MapSelection, details: { visible?: boolean; locked?: boolean }): void;
  readOnly?: boolean;
  detailsEditor?: ReactNode;
  selectionEditor?: ReactNode;
  geometryTools?: ReactNode;
  footer?: ReactNode;
  bottom?: ReactNode;
};

export function InspectorPanel(props: Props) {
  const selection = props.selections?.at(-1); const placeId = selection?.kind === "place" ? selection.id : props.activePlaceId;
  const place = props.project.places.find(({ id }) => id === placeId);
  const formProps = { ...props, readOnly: props.readOnly || selectionIsLocked(props.project, selection ?? { kind: "place", id: placeId }) };
  const form = (props.selections?.length ?? 0) > 1 ? <p className={styles.selectionKind}>{props.copy.selectedCount(props.selections!.length)}</p> : !selection || selection.kind === "place" ? place ? <PlaceForm place={place} project={props.project} copy={props.copy} onUpdate={props.onUpdatePlace} onDelete={props.onDeletePlace} onAddLevel={props.onAddLevel} onReparent={props.onReparentPlace} readOnly={formProps.readOnly}/> : <p className={styles.empty}>{props.copy.noSelection}</p> : <SelectionForm {...formProps} selection={selection}/>;
  const nativeForm = props.detailsEditor
    ? !props.readOnly && (props.selections?.length ?? 0) <= 1 ? form : undefined
    : form;
  const storyEditor = props.selectionEditor ?? props.detailsEditor;
  return <aside className={styles.panel}>
    {storyEditor && <div className={styles.storyEditor}>{storyEditor}</div>}
    {!props.selectionEditor && nativeForm && <div className={styles.nativeEditor}>{!props.detailsEditor && <h2>{selection ? props.copy.selection : props.copy.openPlace}</h2>}{nativeForm}{!props.readOnly && props.geometryTools}</div>}
    {props.footer}
    <SheetObjectList project={props.project} activePlaceId={props.activePlaceId} selections={props.selections} copy={props.copy.objectList} onSelect={props.onSelect} onUpdateElement={props.readOnly ? undefined : props.onUpdateElement} onUpdateSelection={props.readOnly ? undefined : props.onUpdateSelection} onDelete={props.readOnly ? undefined : props.onDeleteSelection}/>
    {props.bottom}
  </aside>;
}

function SelectionForm(props: Props & { selection: MapSelection }) {
  const { project, activePlaceId, selection, copy } = props;
  const noteCopy = copy;
  const constructionOwner = constructionPlaceForView(project, activePlaceId);
  const construction = project.constructions.find(({ id }) => id === constructionOwner?.constructionId);
  if (selection.kind === "element") {
    const element = project.elements.find(({ id }) => id === selection.id); if (!element) return <p className={styles.empty}>{copy.noSelection}</p>;
    return <ElementForm element={element} project={project} copy={noteCopy} onUpdate={props.onUpdateElement} onNoteTextChange={props.onNoteTextChange} readOnly={props.readOnly}/>;
  }
  if (selection.kind === "surface") {
    const surface = project.surfaces.find(({ id }) => id === selection.id); if (!surface) return <p className={styles.empty}>{copy.noSelection}</p>;
    return <SurfaceForm surface={surface} project={project} copy={copy} onUpdate={props.onUpdateSurface} readOnly={props.readOnly}/>;
  }
  if (selection.kind === "room") {
    const room = construction?.rooms.find(({ id }) => id === selection.id); if (!room) return <p className={styles.empty}>{copy.noSelection}</p>;
    const roomPlace = project.places.find(({ id }) => id === room.id);
    return <div className={styles.form}><strong className={styles.selectionKind}>{copy.room}</strong>{!props.readOnly && <AppearanceFields appearance={roomPlace?.appearance} defaultColor={constructionOwner?.appearance?.fillColor ?? "#c9b77f"} colorLabel={copy.fillColor} opacityLabel={copy.fillOpacity} resetLabel={copy.inheritAppearance} onChange={(appearance) => props.onUpdatePlace(room.id, { appearance })} onReset={() => props.onUpdatePlace(room.id, { appearance: undefined })}/>}<p className={styles.hint}>{copy.roomDerived}</p></div>;
  }
  if (selection.kind === "wall") {
    const wall = construction?.walls.find(({ id }) => id === selection.id); if (!wall) return <p className={styles.empty}>{copy.noSelection}</p>;
    return <div className={styles.form}><strong className={styles.selectionKind}>{copy.wall}</strong><div className={styles.belongs}><span>{copy.type}</span><strong>{copy.wallTypes[wall.role]}</strong></div><div className={styles.belongs}><span>{copy.width}</span><strong>{wall.thickness}</strong></div></div>;
  }
  if (selection.kind === "opening") {
    const opening = construction?.openings.find(({ id }) => id === selection.id); if (!opening) return <p className={styles.empty}>{copy.noSelection}</p>;
    return <div className={styles.form}><strong className={styles.selectionKind}>{copy.opening}</strong><div className={styles.belongs}><span>{copy.type}</span><strong>{copy.openingTypes[opening.kind]}</strong></div><label><span>{copy.width}</span><input disabled={props.readOnly} type="number" min="0.2" step="0.1" value={opening.width} onChange={(event) => { const width = Number(event.currentTarget.value); if (Number.isFinite(width) && width > 0 && width !== opening.width) props.onResizeOpening(opening.id, width); }}/></label></div>;
  }
  const transitionDocument = project.constructions.find((candidate) => candidate.transitions.some(({ id }) => id === selection.id));
  const transition = transitionDocument?.transitions.find(({ id }) => id === selection.id); if (!transition) return <p className={styles.empty}>{copy.noSelection}</p>;
  const sourceLevel = project.places.find(({ constructionId }) => constructionId === transitionDocument?.id); const buildingId = sourceLevel?.parentId; const levels = buildingId ? project.places.filter(({ parentId, kind }) => parentId === buildingId && kind === "level").toSorted((first, second) => (first.order ?? 0) - (second.order ?? 0)) : [];
  const connected = new Set(transition.connectedLevelIds ?? [transition.sourceLevelId, transition.targetLevelId].filter((id): id is string => Boolean(id)));
  return <div className={styles.form}><strong className={styles.selectionKind}>{transition.kind === "elevator" ? copy.elevator : copy.stairs}</strong><label><span>{copy.type}</span><select disabled={props.readOnly} value={transition.kind} onChange={(event) => props.onUpdateTransition?.(transition.id, { kind: event.currentTarget.value as VerticalTransition["kind"] })}><option value="stairs">{copy.stairs}</option><option value="elevator">{copy.elevator}</option></select></label>{transition.kind === "stairs" && <><label><span>{copy.stairStyle}</span><select disabled={props.readOnly} value={transition.style ?? "straight"} onChange={(event) => props.onUpdateTransition?.(transition.id, { style: event.currentTarget.value as NonNullable<VerticalTransition["style"]> })}>{Object.entries(copy.stairStyles).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label><span>{copy.direction}</span><input disabled={props.readOnly} type="number" min="-360" max="360" step="15" value={transition.direction ?? 0} onChange={(event) => props.onUpdateTransition?.(transition.id, { direction: Number(event.currentTarget.value) })}/></label></>}<label><input disabled={props.readOnly} type="checkbox" checked={Boolean(transition.sameLevelRise)} onChange={(event) => props.onUpdateTransition?.(transition.id, { sameLevelRise: event.currentTarget.checked, connectedLevelIds: event.currentTarget.checked ? sourceLevel ? [sourceLevel.id] : [] : [...connected] })}/><span>{copy.sameLevelRise}</span></label>{!transition.sameLevelRise && levels.length > 0 && <TransitionLevelChecklist levels={levels} connected={connected} sourceLevelId={sourceLevel?.id} label={copy.connectsLevels} disabled={props.readOnly} onChange={(connectedLevelIds) => props.onUpdateTransition?.(transition.id, { connectedLevelIds, sourceLevelId: sourceLevel?.id, targetLevelId: connectedLevelIds.find((id) => id !== sourceLevel?.id) })}/>} </div>;
}

function TransitionLevelChecklist({ levels, connected, sourceLevelId, label, disabled, onChange }: { levels: PlaceNode[]; connected: ReadonlySet<string>; sourceLevelId?: string; label: string; disabled?: boolean; onChange(ids: string[]): void }) {
  return <fieldset className={styles.levelChecklist} disabled={disabled}><legend>{label}</legend>{levels.map((level) => {
    const source = level.id === sourceLevelId; const checked = source || connected.has(level.id);
    return <label key={level.id}><input type="checkbox" checked={checked} disabled={disabled || source} onChange={(event) => { const next = new Set(connected); if (sourceLevelId) next.add(sourceLevelId); if (event.currentTarget.checked) next.add(level.id); else next.delete(level.id); onChange([...next]); }}/><span>{level.name}</span></label>;
  })}</fieldset>;
}

function SurfaceForm({ surface, project, copy, onUpdate, readOnly }: { surface: ConstructionSurface; project: EditorProject; copy: WorkbenchCopy; onUpdate?(id: string, details: { name?: string; description?: string; tags?: string[]; belongsToId?: string; appearance?: MapAppearance; visible?: boolean; locked?: boolean; attachment?: "free" | "attached"; elevation?: number }): void; readOnly?: boolean }) {
  const disabled = readOnly || !onUpdate;
  return <div className={styles.form}><strong className={styles.selectionKind}>{copy.object}</strong><label><span>{copy.belongsTo}</span><select disabled={disabled} value={surface.belongsToId} onChange={(event) => onUpdate?.(surface.id, { belongsToId: event.currentTarget.value })}>{project.places.map((place) => <option key={place.id} value={place.id}>{place.name}</option>)}</select></label><label><span>{copy.type}</span><select disabled={disabled} value={surface.attachment} onChange={(event) => onUpdate?.(surface.id, { attachment: event.currentTarget.value as "free" | "attached" })}><option value="free">{copy.hierarchy.kindLabels.object}</option><option value="attached">{copy.belongsTo}</option></select></label>{!disabled && <AppearanceFields appearance={surface.appearance} defaultColor="#b8945c" colorLabel={copy.fillColor} opacityLabel={copy.fillOpacity} onChange={(appearance) => onUpdate?.(surface.id, { appearance })}/>}</div>;
}

function ElementForm({ element, project, copy, onUpdate, onNoteTextChange, readOnly }: { element: DrawingElement; project: EditorProject; copy: WorkbenchCopy; onUpdate(id: string, details: { widthMeters?: number; name?: string; description?: string; tags?: string[]; belongsToId?: string; appearance?: MapAppearance; properties?: Record<string, string | number | boolean | null>; geometry?: DrawingElement["geometry"]; visible?: boolean; locked?: boolean }): void; onNoteTextChange?(id: string, text: string): void; readOnly?: boolean }) {
  const owners = validElementOwners(project, element.id);
  const note = element.geometry.kind === "note" ? element.geometry : undefined;
  return <div className={styles.form}><strong className={styles.selectionKind}>{copy.object}</strong>{note ? <><label><span>{copy.noteText ?? "Note text"}</span><textarea readOnly={readOnly} key={`${element.id}:text`} value={note.text} onChange={(event) => { if (!readOnly) { const text = event.currentTarget.value; if (onNoteTextChange) onNoteTextChange(element.id, text); else onUpdate(element.id, { geometry: { ...note, text } }); } }}/></label><label><span>{copy.fontSize ?? "Font size"}</span><input disabled={readOnly} type="number" min="1" max="72" step="1" value={Number(element.properties.fontSize ?? 12)} onChange={(event) => onUpdate(element.id, { properties: { ...element.properties, fontSize: Number(event.currentTarget.value) } })}/></label></> : null}{isRibbonElement(element) && <label><span>{copy.width} (m)</span><input disabled={readOnly} type="number" min=".1" max="1000" step=".1" value={element.widthMeters ?? 4} onChange={(event) => { const width = Number(event.currentTarget.value); if (width >= .1 && width <= 1000) onUpdate(element.id, { widthMeters: width }); }}/></label>}<label><span>{copy.belongsTo}</span><select disabled={readOnly} value={element.belongsToId} onChange={(event) => onUpdate(element.id, { belongsToId: event.currentTarget.value })}>{owners.map((place) => <option key={place.id} value={place.id}>{place.name}</option>)}</select></label>{element.geometry.kind === "point" && <label><span>{copy.markerSize}</span><input disabled={readOnly} type="range" min="2" max="20" step="1" value={Number(element.properties.markerSize ?? 5)} onChange={(event) => onUpdate(element.id, { properties: { ...element.properties, markerSize: Number(event.currentTarget.value) } })}/></label>}{(isRibbonElement(element) || element.geometry.kind === "region" || element.geometry.kind === "point") && !readOnly && <AppearanceFields appearance={isRibbonElement(element) ? ribbonAppearance(element) : element.appearance} defaultColor={defaultElementColor(element.subjectId)} colorLabel={copy.fillColor} opacityLabel={copy.fillOpacity} onChange={(appearance) => onUpdate(element.id, { appearance })}/>}</div>;
}

function PlaceForm({ place, project, copy, onUpdate, onDelete, onAddLevel, onReparent, readOnly }: { place: PlaceNode; project: EditorProject; copy: WorkbenchCopy; onUpdate(id: string, details: { name?: string; description?: string; tags?: string[]; appearance?: MapAppearance }): void; onDelete(id: string): void; onAddLevel(buildingId: string, position: "above" | "below"): void; onReparent(id: string, parentId?: string): void; readOnly?: boolean }) {
  const containing = place.parentId ? project.places.find(({ id }) => id === place.parentId) : undefined;
  const containers = validContainingPlaces(project, place.id); const canReparent = place.kind !== "world" && place.kind !== "room";
  const buildingId = place.kind === "building" ? place.id : place.kind === "level" && containing?.kind === "building" ? containing.id : undefined;
  const siblingLevels = place.kind === "level" && containing ? project.places.filter(({ parentId, kind }) => parentId === containing.id && kind === "level") : [];
  const rootCount = project.places.filter(({ parentId }) => !parentId).length;
  const canDelete = (Boolean(place.parentId) || rootCount > 1) && place.kind !== "room" && (place.kind !== "level" || siblingLevels.length > 1);
  const polish = copy.hierarchy.kindLabels.world === "świat";
  return <div className={styles.form}>{canReparent ? <label><span>{copy.belongsTo}</span><select disabled={readOnly} value={place.parentId ?? ""} onChange={(event) => onReparent(place.id, event.currentTarget.value || undefined)}><option value="">{copy.independentMap}</option>{containers.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.name}</option>)}</select></label> : <div className={styles.belongs}><span>{copy.belongsTo}</span><strong>{containing?.name ?? copy.independentMap}</strong></div>}{place.boundary && !readOnly && <AppearanceFields appearance={place.appearance} defaultColor="#c9b77f" colorLabel={copy.fillColor} opacityLabel={copy.fillOpacity} onChange={(appearance) => onUpdate(place.id, { appearance })}/>} {buildingId && !readOnly && <div className={styles.levelActions}><button type="button" className={styles.action} onClick={() => onAddLevel(buildingId, "above")}>↑ {copy.hierarchy.addLevelAbove ?? (polish ? "Dodaj piętro powyżej" : "Add storey above")}</button><button type="button" className={styles.action} onClick={() => onAddLevel(buildingId, "below")}>↓ {copy.hierarchy.addLevelBelow ?? (polish ? "Dodaj piętro poniżej" : "Add level below")}</button></div>}{canDelete && !readOnly && <button type="button" className={styles.delete} onClick={() => onDelete(place.id)}>{copy.delete}</button>}</div>;
}
