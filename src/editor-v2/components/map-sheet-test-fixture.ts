import { createConstructionDocument } from "../construction/construction-document";
import { emptyProject, type EditorProject } from "../model/project-model";

export function project(): EditorProject {
  const construction = createConstructionDocument("plan", [
    { id: "top", start: { x: 0, y: 0 }, end: { x: 20, y: 0 }, thickness: .3, role: "boundary" },
    { id: "right", start: { x: 20, y: 0 }, end: { x: 20, y: 12 }, thickness: .3, role: "boundary" },
    { id: "bottom", start: { x: 20, y: 12 }, end: { x: 0, y: 12 }, thickness: .3, role: "boundary" },
    { id: "left", start: { x: 0, y: 12 }, end: { x: 0, y: 0 }, thickness: .3, role: "boundary" },
  ], { createId: () => "room", createName: () => "Hall" });
  construction.openings = [
    { id: "door", kind: "door", wallId: "top", position: .25, width: 2 },
    { id: "window", kind: "window", wallId: "right", position: .5, width: 2 },
    { id: "gate", kind: "gate", wallId: "bottom", position: .5, width: 3 },
    { id: "passage", kind: "passage", wallId: "left", position: .5, width: 2 },
  ];
  construction.transitions = [{ id: "stairs", kind: "stairs", footprint: { kind: "rectangle", x: 7, y: 4, width: 5, height: 3 } }];
  return { ...emptyProject("p", "Atlas"), places: [
    { id: "world", name: "World", kind: "world", transform: { x: 0, y: 0, rotation: 0 }, boundary: { kind: "rectangle", x: 0, y: 0, width: 100, height: 70 }, tags: [], access: [], properties: {} },
    { id: "estate", parentId: "world", name: "Estate", kind: "location", transform: { x: 15, y: 10, rotation: 5 }, boundary: { kind: "rectangle", x: 0, y: 0, width: 60, height: 40 }, tags: [], access: [], properties: {} },
    { id: "floor", parentId: "estate", name: "Ground floor", kind: "level", transform: { x: 8, y: 6, rotation: 0 }, boundary: { kind: "rectangle", x: 0, y: 0, width: 20, height: 12 }, constructionId: "plan", tags: [], access: [], properties: {} },
    { id: "garden", parentId: "estate", name: "Garden", kind: "object", transform: { x: 34, y: 8, rotation: 0 }, boundary: { kind: "ellipse", cx: 0, cy: 0, rx: 8, ry: 5 }, tags: [], access: [], properties: {} },
  ], elements: [
    { id: "pond", belongsToId: "estate", name: "Pond", layerId: "terrain", subjectId: "terrain.water", geometry: { kind: "region", shape: { kind: "circle", cx: 45, cy: 26, radius: 4 } }, visible: true, locked: false, tags: [], access: [], properties: {} },
    { id: "draft", belongsToId: "estate", name: "Draft note", layerId: "sketch", subjectId: "sketch.stroke", geometry: { kind: "path", points: [{ x: 2, y: 2 }, { x: 8, y: 8 }], closed: false }, visible: true, locked: false, tags: [], access: [], properties: {} },
  ], constructions: [construction] };
}

export function pointerEvent(type: string, clientX: number, clientY: number, pointerId = 9, pointerType = "mouse", ctrlKey = false, buttons = type === "pointerup" || type === "pointercancel" ? 0 : 1) {
  const event = new Event(type, { bubbles: true });
  Object.defineProperties(event, { pointerId: { value: pointerId }, pointerType: { value: pointerType }, button: { value: 0 }, buttons: { value: buttons }, clientX: { value: clientX }, clientY: { value: clientY }, ctrlKey: { value: ctrlKey }, metaKey: { value: false }, shiftKey: { value: false } });
  return event;
}
