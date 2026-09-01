import type { PointerEvent } from "react";
import type { WorkLayerId } from "../toolbox/toolbox-model";

export type SelectableCandidate = SVGElement & { dataset: DOMStringMap };

type CandidateChoice = {
  selectionLayerId?: WorkLayerId;
  selected: ReadonlySet<string>;
  additive: boolean;
};

/**
 * Applies the common map selection rule to an already ordered hit list.
 *
 * An active layer is a preference, not a filter: when Ctrl/Meta/Shift is held
 * an already selected active-layer hit must yield to the next unselected hit,
 * including a different kind (for example a building followed by equipment).
 * Story's selection-only mode has no active layer, so the DOM hit order is
 * preserved there.
 */
export function chooseSelectableCandidate(candidates: readonly SelectableCandidate[], { selectionLayerId, selected, additive }: CandidateChoice) {
  const preferred = selectionLayerId === undefined
    ? candidates
    : candidates.filter(({ dataset }) => dataset.selectionLayer === selectionLayerId);
  const fallback = selectionLayerId === undefined
    ? []
    : candidates.filter((candidate) => candidate.dataset.selectionLayer !== selectionLayerId);
  const ordered = [...preferred, ...fallback];
  if (!additive) return ordered[0];
  const unselected = (candidate: SelectableCandidate) => {
    const id = candidate.dataset.selectionId;
    return Boolean(id && !selected.has(id));
  };
  return ordered.find(unselected) ?? ordered[0];
}

function selectableAncestor(element: EventTarget | null): SelectableCandidate | undefined {
  const closest = (element as Element | null)?.closest?.<SVGElement>("[data-selectable='true']");
  return closest?.dataset.selectionId && closest.dataset.selectionKind ? closest as SelectableCandidate : undefined;
}

export function preferredSelectable({ event, selectionEditing, selectionLayerId, selected, additive }: { event: PointerEvent<SVGSVGElement>; selectionEditing: boolean; selectionLayerId?: WorkLayerId; selected: ReadonlySet<string>; additive: boolean }) {
  const direct = selectableAncestor(event.target);
  if (!selectionEditing || typeof document.elementsFromPoint !== "function") return direct;

  const candidates: SelectableCandidate[] = []; const seen = new Set<Element>();
  try {
    for (const element of document.elementsFromPoint(event.clientX, event.clientY)) {
      const selectable = selectableAncestor(element);
      if (selectable && event.currentTarget.contains(selectable) && !seen.has(selectable)) {
        seen.add(selectable); candidates.push(selectable);
      }
    }
  } catch {
    // A browser can reject hit testing for a transient document. The direct
    // event target still gives selection a safe, deterministic fallback.
  }
  if (direct && !seen.has(direct)) candidates.push(direct);
  return chooseSelectableCandidate(candidates, { selectionLayerId, selected, additive });
}
