import { createLevelForBuilding } from "../model/hierarchy-operations";
import type { EditorSession } from "../state/editor-session";
import type { EditorTransactionCommit } from "./use-editor-transaction";

export function createWorkbenchLevel(session: EditorSession, buildingId: string, position: "above" | "below", locale: "pl" | "en", commit: EditorTransactionCommit) {
  const levels = session.getState().project.places.filter(({ parentId, kind }) => parentId === buildingId && kind === "level");
  const count = levels.filter(({ order }) => position === "below" ? (order ?? 0) < 0 : (order ?? 0) > 0).length + 1;
  const id = crypto.randomUUID(); const constructionId = crypto.randomUUID();
  const name = position === "below" ? locale === "pl" ? count === 1 ? "Piwnica" : `Piwnica ${count}` : count === 1 ? "Basement" : `Basement ${count}` : locale === "pl" ? `Piętro ${count}` : `Floor ${count}`;
  return commit(`add-level:${position}:${buildingId}`, (project) => createLevelForBuilding(project, { id, constructionId, buildingId, name, position, roomName: (index) => locale === "pl" ? `Pomieszczenie ${index}` : `Room ${index}` }, { createId: () => crypto.randomUUID() })) ? id : undefined;
}
