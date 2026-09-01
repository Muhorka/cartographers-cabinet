import type { ConstructionSurface, PlaceNode } from "../model/project-model";
import styles from "./hierarchy-navigator.module.css";
import { useState } from "react";
import { AddLevelGlyph, ChevronGlyph, DisplayedPlaceGlyph, PlaceGlyph } from "./hierarchy-glyphs";

export type HierarchyNavigatorCopy = {
  ariaLabel: string;
  openPlace: string;
  expandPlace: string;
  collapsePlace: string;
  addContainingPlace: string;
  addLevel: string;
  addLevelAbove?: string;
  addLevelBelow?: string;
  reorderLevel: string;
  containingKind: string;
  containingName: string;
  createContaining: string;
  cancel: string;
  noPlaces: string;
  kindLabels: Record<PlaceNode["kind"], string>;
  surface?: string;
};

type HierarchyNavigatorProps = {
  places: PlaceNode[];
  surfaces?: ConstructionSurface[];
  activePlaceId?: string;
  inspectedPlaceId?: string;
  expandedPlaceIds: ReadonlySet<string>;
  copy: HierarchyNavigatorCopy;
  onOpenPlace(placeId: string): void;
  onExpandedChange(placeId: string, expanded: boolean): void;
  onAddContainingPlace?(placeId: string, kind: "world" | "location" | "building" | "level" | "custom", name?: string): void;
  onAddLevel?(buildingId: string, position: "above" | "below"): void;
  onReorderLevel?(levelId: string, beforeLevelId?: string): void;
  onSelectSurface?(surfaceId: string, ownerId: string): void;
};

export function HierarchyNavigator({
  places,
  activePlaceId,
  inspectedPlaceId,
  expandedPlaceIds,
  copy,
  onOpenPlace,
  onExpandedChange,
  onAddContainingPlace,
  onAddLevel,
  onReorderLevel,
  surfaces = [],
  onSelectSurface,
}: HierarchyNavigatorProps) {
  const byContainer = groupPlacesByContainer(places);
  const roots = places.filter((place) => !place.parentId || !places.some((candidate) => candidate.id === place.parentId));
  const inspectedPlace = places.find(({ id }) => id === inspectedPlaceId) ?? places.find(({ id }) => id === activePlaceId);
  const choices = inspectedPlace ? levelChoices(inspectedPlace) : [];
  const canAddContainingPlace = Boolean(onAddContainingPlace && inspectedPlace && choices.length);
  const [adding, setAdding] = useState(false); const [kind, setKind] = useState<"world" | "location" | "building" | "level" | "custom">("custom"); const [name, setName] = useState("");
  const openAdding = () => { if (!inspectedPlace) return; setKind(levelChoices(inspectedPlace)[0] ?? "custom"); setName(""); setAdding(true); };

  return (
    <nav className={styles.navigator} aria-label={copy.ariaLabel}>
      {roots.length > 0 ? (
        <ul className={styles.tree} role="tree" aria-label={copy.ariaLabel}>
          {roots.map((place) => (
            <PlaceBranch
              key={place.id}
              place={place}
              byContainer={byContainer}
              surfaces={surfaces}
              activePlaceId={activePlaceId}
              inspectedPlaceId={inspectedPlaceId}
              expandedPlaceIds={expandedPlaceIds}
              copy={copy}
              onOpenPlace={onOpenPlace}
              onExpandedChange={onExpandedChange}
              onAddLevel={onAddLevel}
              onReorderLevel={onReorderLevel}
              onSelectSurface={onSelectSurface}
            />
          ))}
        </ul>
      ) : (
        <p className={styles.empty}>{copy.noPlaces}</p>
      )}

      {canAddContainingPlace && (
        <button type="button" className={styles.addContaining} onClick={openAdding}>
          <AddLevelGlyph />
          <span>{copy.addContainingPlace}</span>
        </button>
      )}
      {adding && inspectedPlace && onAddContainingPlace && <form className={styles.addForm} onSubmit={(event) => { event.preventDefault(); onAddContainingPlace(inspectedPlace.id, kind, name.trim() || undefined); setAdding(false); }}>
        <label><span>{copy.containingKind}</span><select value={kind} onChange={(event) => setKind(event.currentTarget.value as typeof kind)}>{choices.map((choice) => <option key={choice} value={choice}>{copy.kindLabels[choice]}</option>)}</select></label>
        <label><span>{copy.containingName}</span><input value={name} onChange={(event) => setName(event.currentTarget.value)} placeholder={copy.kindLabels[kind]}/></label>
        <div><button type="submit">{copy.createContaining}</button><button type="button" onClick={() => setAdding(false)}>{copy.cancel}</button></div>
      </form>}
    </nav>
  );
}

function levelChoices(place: PlaceNode): Array<"world" | "location" | "building" | "level" | "custom"> {
  if (place.kind === "world") return ["location", "custom"];
  if (place.kind === "location" || place.kind === "custom") return [...(!place.parentId ? ["world" as const] : []), "location", "custom"];
  if (place.kind === "building") return ["level", "location", ...(!place.parentId ? ["world" as const] : []), "custom"];
  if (place.kind === "standalone-room" || place.kind === "level") return ["building", "location", "world", "custom"];
  return ["custom"];
}

type PlaceBranchProps = Omit<HierarchyNavigatorProps, "places" | "onAddContainingPlace"> & {
  place: PlaceNode;
  byContainer: ReadonlyMap<string, PlaceNode[]>;
  surfaces: ConstructionSurface[];
};

function PlaceBranch({
  place,
  byContainer,
  activePlaceId,
  inspectedPlaceId,
  expandedPlaceIds,
  copy,
  onOpenPlace,
  onExpandedChange,
  onAddLevel,
  onReorderLevel,
  surfaces,
  onSelectSurface,
}: PlaceBranchProps) {
  const nestedPlaces = byContainer.get(place.id) ?? [];
  const ownedSurfaces = surfaces.filter(({ belongsToId }) => belongsToId === place.id);
  const hasNestedPlaces = nestedPlaces.length > 0 || ownedSurfaces.length > 0;
  const expanded = hasNestedPlaces && expandedPlaceIds.has(place.id);
  const displayed = place.id === activePlaceId; const inspected = place.id === (inspectedPlaceId ?? activePlaceId);
  const [addingLevel, setAddingLevel] = useState(false);

  return (
    <li className={styles.branch} role="treeitem" aria-expanded={hasNestedPlaces ? expanded : undefined} aria-current={displayed ? "page" : undefined} aria-selected={inspected}>
      <div className={`${styles.placeRow}${inspected ? ` ${styles.inspected}` : ""}${displayed ? ` ${styles.displayed}` : ""}`} onDragOver={(place.kind === "building" || place.kind === "level") && onReorderLevel ? (event) => event.preventDefault() : undefined} onDrop={(place.kind === "building" || place.kind === "level") && onReorderLevel ? (event) => { event.preventDefault(); event.stopPropagation(); const id = event.dataTransfer.getData("application/x-cartographer-level"); if (id && id !== place.id) onReorderLevel(id, place.kind === "level" ? place.id : undefined); } : undefined}>
        {hasNestedPlaces ? (
          <button
            type="button"
            className={styles.disclosure}
            aria-label={`${expanded ? copy.collapsePlace : copy.expandPlace}: ${place.name}`}
            aria-expanded={expanded}
            onClick={() => onExpandedChange(place.id, !expanded)}
          >
            <ChevronGlyph expanded={expanded} />
          </button>
        ) : (
          <span className={styles.leafMark} aria-hidden="true" />
        )}

        <button
          type="button"
          className={styles.placeButton}
          aria-label={`${copy.openPlace}: ${place.name}`}
          title={place.name}
          onClick={() => onOpenPlace(place.id)}
        >
          <PlaceGlyph kind={place.kind} />
          <span className={styles.placeText}>
            <strong>{place.name}</strong>
            <span className={styles.placeMeta}><small>{copy.kindLabels[place.kind]}</small>{displayed && <span className={styles.displayedMark} title={copy.openPlace}><DisplayedPlaceGlyph /></span>}</span>
          </span>
        </button>
        {place.kind === "level" && onReorderLevel && <span className={styles.dragHandle} draggable title={copy.reorderLevel} aria-label={copy.reorderLevel} onDragStart={(event) => { event.stopPropagation(); event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("application/x-cartographer-level", place.id); }} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); event.stopPropagation(); const id = event.dataTransfer.getData("application/x-cartographer-level"); if (id && id !== place.id) onReorderLevel(id, place.id); }}>⋮⋮</span>}
        {place.kind === "building" && onAddLevel && <button type="button" className={styles.rowAction} title={copy.addLevel} aria-label={`${copy.addLevel}: ${place.name}`} aria-expanded={addingLevel} onClick={() => setAddingLevel((current) => !current)}><AddLevelGlyph /></button>}
      </div>

      {place.kind === "building" && addingLevel && onAddLevel && <div className={styles.levelMenu}><button type="button" onClick={() => { onAddLevel(place.id, "above"); setAddingLevel(false); }}>↑ {copy.addLevelAbove ?? (copy.kindLabels.world === "świat" ? "Dodaj piętro powyżej" : "Add storey above")}</button><button type="button" onClick={() => { onAddLevel(place.id, "below"); setAddingLevel(false); }}>↓ {copy.addLevelBelow ?? (copy.kindLabels.world === "świat" ? "Dodaj poziom poniżej" : "Add level below")}</button></div>}

      {expanded && (
        <ul className={styles.group} role="group">
          {nestedPlaces.map((nestedPlace) => (
            <PlaceBranch
              key={nestedPlace.id}
              place={nestedPlace}
              byContainer={byContainer}
              surfaces={surfaces}
              activePlaceId={activePlaceId}
              inspectedPlaceId={inspectedPlaceId}
              expandedPlaceIds={expandedPlaceIds}
              copy={copy}
              onOpenPlace={onOpenPlace}
              onExpandedChange={onExpandedChange}
              onAddLevel={onAddLevel}
              onReorderLevel={onReorderLevel}
              onSelectSurface={onSelectSurface}
            />
          ))}
          {ownedSurfaces.map((surface) => (
            <li key={`surface:${surface.id}`} className={styles.branch} role="treeitem" aria-selected={false}>
              <div className={styles.placeRow}>
                <span className={styles.leafMark} aria-hidden="true" />
                <button type="button" className={styles.placeButton} aria-label={`${copy.openPlace}: ${surface.name}`} title={surface.name} onClick={() => onSelectSurface?.(surface.id, surface.belongsToId)}>
                  <span className={styles.surfaceGlyph} aria-hidden="true">▱</span>
                  <span className={styles.placeText}><strong>{surface.name}</strong><small>{copy.surface ?? "Construction surface"}</small></span>
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

function groupPlacesByContainer(places: PlaceNode[]): Map<string, PlaceNode[]> {
  const groups = new Map<string, PlaceNode[]>();
  for (const place of places) {
    if (!place.parentId) continue;
    const group = groups.get(place.parentId) ?? [];
    group.push(place);
    groups.set(place.parentId, group);
  }
  for (const [containerId, group] of groups) groups.set(containerId, group.map((item, index) => ({ item, index })).sort((left, right) => {
    if (left.item.kind === "level" && right.item.kind === "level") return (left.item.order ?? left.index) - (right.item.order ?? right.index);
    return left.index - right.index;
  }).map(({ item }) => item));
  return groups;
}
