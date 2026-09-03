type SelectionKind = "place" | "element" | "surface" | "room" | "wall" | "opening" | "transition";

/** A construction record is addressed by its construction id, not by its local object id alone. */
export type SelectionReference = { kind: SelectionKind; id: string; scopeId?: string };

export function selectionKey(selection: SelectionReference) {
  return JSON.stringify([selection.kind, selection.scopeId ?? null, selection.id]);
}
