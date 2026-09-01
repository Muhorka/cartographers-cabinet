import { useMemo, useState } from "react";
import { canRotateSelection, rotateSelection, rotationSelectionBounds, type RotationReason } from "../drawing/selection-rotation";
import type { EditorSession, EditorSessionState } from "../state/editor-session";
import type { MapSelection } from "./map-sheet-types";
import type { EditorProject } from "../model/project-model";
import type { DrawingNoticeModel } from "./drawing-notice";
import type { SelectionRotationControl } from "./selection-rotation-handle";
import styles from "./selection-rotation-input.module.css";

const reasons: Record<RotationReason, [string, string]> = {
  "not-found": ["Nie znaleziono zaznaczonych obiektów.", "The selected objects could not be found."],
  "mixed-owners": ["Te elementy konstrukcji należą do różnych planów. Obróć je osobno.", "These structural elements belong to different plans. Rotate them separately."],
  locked: ["Najpierw odblokuj zaznaczone elementy.", "Unlock the selected objects first."],
  "locked-outline": ["Ten obrót zmieniłby obrys. Najpierw włącz edycję obrysu.", "This rotation would change the outline. Enable outline editing first."],
  "anchored-opening": ["Drzwi i okna obracają się razem ze ścianą, w której są osadzone.", "Doors and windows rotate with their supporting wall."],
  "outside-outline": ["Po obrocie element wykraczałby poza dozwolony obrys lub przecinał budynek.", "The rotated object would leave its allowed outline or intersect a building."],
  collision: ["Nie można bezpiecznie zastosować tego obrotu do ścian planu.", "This rotation cannot safely be applied to the plan's walls."],
  unsupported: ["Nie można obrócić tego zaznaczenia.", "This selection cannot be rotated."],
};

export function useSelectionRotation({ session, snapshot, selections, locale, refresh, onSelections }: { session?: EditorSession; snapshot?: EditorSessionState; selections: MapSelection[]; locale: "pl" | "en"; refresh(): void; onSelections(selections: MapSelection[]): void }) {
  const [draft, setDraft] = useState<{ source: EditorProject; key: string; project: EditorProject }>();
  const [failure, setFailure] = useState<string>();
  const key = `${snapshot?.activePlaceId}:${snapshot?.boundaryEditing}:${selections.map(({ kind, id }) => `${kind}:${id}`).join("|")}`;
  const identity = useMemo(() => ({ createId: () => crypto.randomUUID(), createRoomName: (index: number) => locale === "pl" ? `Pomieszczenie ${index}` : `Room ${index}` }), [locale]);
  const capability = snapshot?.activePlaceId && selections.length ? canRotateSelection(snapshot.project, snapshot.activePlaceId, selections, snapshot.boundaryEditing) : undefined;
  const bounds = useMemo(() => snapshot?.activePlaceId && selections.length ? rotationSelectionBounds(snapshot.project, snapshot.activePlaceId, selections) : undefined, [snapshot, selections]);
  const explain = (reason: RotationReason) => reasons[reason][locale === "pl" ? 0 : 1];
  const calculate = (degrees: number) => snapshot?.activePlaceId ? rotateSelection(snapshot.project, snapshot.activePlaceId, selections, degrees, identity, snapshot.boundaryEditing) : undefined;
  const commit = (degrees: number) => {
    setDraft(undefined); setFailure(undefined); if (!session || Math.abs(degrees) < 1e-8) return;
    const result = calculate(degrees); if (!result) return;
    if (result.state === "blocked") { setFailure(explain(result.reason)); return; }
    const transaction = session.executeTransaction({ id: "rotate:selection", apply: () => result.project });
    if (transaction.changed) onSelections(result.selections);
    else if (transaction.code !== "no-change") setFailure(locale === "pl" ? "Nie udało się zapisać obrotu. Plan pozostał bez zmian." : "The rotation could not be saved. The plan was not changed.");
    refresh();
  };
  const control: SelectionRotationControl | undefined = capability?.can && bounds ? {
    center: { x: (bounds.minX + bounds.maxX) / 2, y: (bounds.minY + bounds.maxY) / 2 }, top: bounds.minY, label: locale === "pl" ? "Obróć zaznaczenie" : "Rotate selection",
    onPreview: (degrees) => { const result = calculate(degrees); setDraft(result?.state === "applied" && snapshot ? { source: snapshot.project, key, project: result.project } : undefined); },
    onCommit: commit, onCancel: () => setDraft(undefined),
  } : undefined;
  const notice: DrawingNoticeModel | undefined = failure ? { message: failure, tone: "warning", actions: [{ id: "close-rotation", label: locale === "pl" ? "Zamknij" : "Close", onClick: () => setFailure(undefined) }] } : undefined;
  return { control, notice, previewProject: draft?.source === snapshot?.project && draft?.key === key ? draft.project : undefined, input: selections.length ? <RotationInput locale={locale} disabled={!capability?.can} reason={capability && !capability.can ? explain(capability.reason) : undefined} onRotate={commit}/> : undefined };
}

function RotationInput({ locale, disabled, reason, onRotate }: { locale: "pl" | "en"; disabled: boolean; reason?: string; onRotate(degrees: number): void }) {
  const [value, setValue] = useState("15"); const degrees = Number(value);
  return <form className={styles.rotation} onSubmit={(event) => { event.preventDefault(); if (!disabled && value.trim() && Number.isFinite(degrees)) onRotate(degrees); }} title={reason}>
    <label>{locale === "pl" ? "Kąt obrotu" : "Rotation angle"}<input aria-label={locale === "pl" ? "Kąt obrotu w stopniach" : "Rotation angle in degrees"} type="number" step="any" value={value} onChange={(event) => setValue(event.target.value)} disabled={disabled}/><span>°</span></label>
    <button type="submit" disabled={disabled || !value.trim() || !Number.isFinite(degrees)}>{locale === "pl" ? "Obróć" : "Rotate"}</button>
  </form>;
}
