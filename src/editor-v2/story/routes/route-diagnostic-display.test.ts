import { describe, expect, it } from "vitest";
import { emptyProject } from "../../model/project-model";
import { createRouteDiagnosticFormatter } from "./route-diagnostic-display";

function fixture() {
  const project = emptyProject("diagnostics", "Diagnostics");
  project.places = [
    { id: "estate", name: "Silver Estate", kind: "building", transform: { x: 0, y: 0, rotation: 0 }, tags: [], access: [], properties: {} },
    { id: "ground", parentId: "estate", name: "Ground Floor", kind: "level", constructionId: "plan", transform: { x: 0, y: 0, rotation: 0 }, tags: [], access: [], properties: {} },
  ];
  project.constructions = [{
    id: "plan", revision: 0,
    walls: [{ id: "wall", start: { x: 0, y: 0 }, end: { x: 10, y: 0 }, role: "boundary", thickness: .2 }],
    rooms: [{ id: "library", faceId: "face-library", name: "Library", tags: [], access: [], properties: {} }],
    openings: [{ id: "door-id", kind: "door", wallId: "wall", position: .5, width: 1 }],
    transitions: [{ id: "stair-id", kind: "stairs", footprint: { kind: "rectangle", x: 1, y: 1, width: 2, height: 3 }, sourceLevelId: "ground", connectedLevelIds: ["ground"] }],
  }];
  project.story.objects = [
    { ref: { kind: "opening", id: "door-id", scopeId: "plan" }, metadata: { narrativeLabel: "Library threshold" } },
    { ref: { kind: "transition", id: "stair-id", scopeId: "plan" }, metadata: {} },
  ];
  return project;
}

describe("route diagnostic display", () => {
  it("uses canonical room/face names and localized structural fallbacks", () => {
    const project = fixture(); const en = createRouteDiagnosticFormatter(project, "en"); const pl = createRouteDiagnosticFormatter(project, "pl");

    expect(en.format("Opening door-id has no 0.8 m clear portal in face face-library.")).toBe("Opening Library threshold has no 0.8 m clear portal in face Library.");
    expect(en.format("Vehicle profile cannot use transition stair-id.")).toBe("Vehicle profile cannot use transition Stairs 1.");
    expect(pl.format("Vehicle profile cannot use transition stair-id.")).toBe("Profil pojazdu nie może użyć połączenia „Schody 1”.");
    expect(en.displayName("face-library")).toBe("Library");
    expect(project.constructions[0]!.transitions[0]!.id).toBe("stair-id");
  });

  it("uses effective scenario and step names", () => {
    const project = fixture();
    project.story.scenarios = [{ id: "night", name: "Night", patches: [
      { id: "door-scene", target: { kind: "opening", id: "door-id", scopeId: "plan" }, title: "Moonlit threshold" },
      { id: "room-scene", target: { kind: "room", id: "library", scopeId: "plan" }, title: "Dark Library" },
    ], steps: [{ id: "alarm", name: "Alarm", patches: [
      { id: "door-step", target: { kind: "opening", id: "door-id", scopeId: "plan" }, title: "Barricaded threshold" },
      { id: "room-step", target: { kind: "room", id: "library", scopeId: "plan" }, title: "Burning Library" },
    ] }] }];
    const scenario = createRouteDiagnosticFormatter(project, "en", { scenarioId: "night" });
    const step = createRouteDiagnosticFormatter(project, "en", { scenarioId: "night", stepId: "alarm" });

    expect(scenario.format("Open door-id.")).toBe("Open Moonlit threshold.");
    expect(scenario.format("Room library is not available.")).toBe("Room Dark Library is not available.");
    expect(step.format("Open door-id.")).toBe("Open Barricaded threshold.");
    expect(step.format("Opening door-id has no 1 m clear portal in face face-library.")).toBe("Opening Barricaded threshold has no 1 m clear portal in face Burning Library.");
  });

  it("replaces short ids only in planner/access slots, never in ordinary prose", () => {
    const project = fixture();
    project.places.push(
      { id: "is", name: "Sealed Gallery", kind: "custom", transform: { x: 0, y: 0, rotation: 0 }, tags: [], access: [], properties: {} },
      { id: "to", name: "North Landing", kind: "custom", transform: { x: 0, y: 0, rotation: 0 }, tags: [], access: [], properties: {} },
      { id: "room", name: "Blue Room", kind: "custom", transform: { x: 0, y: 0, rotation: 0 }, tags: [], access: [], properties: {} },
    );
    const formatter = createRouteDiagnosticFormatter(project, "en");

    expect(formatter.format("This room is open to guests.")).toBe("This room is open to guests.");
    expect(formatter.format("is is sealed.")).toBe("Sealed Gallery is sealed.");
    expect(formatter.format("Confirm who is allowed to use room.")).toBe("Confirm who is allowed to use Blue Room.");
    expect(formatter.format("Transition stair-id has no valid landing on to.")).toBe("Transition Stairs 1 has no valid landing on North Landing.");
  });

  it("preserves unknown and ambiguously scoped ids", () => {
    const project = fixture();
    project.places.push({ id: "upper", parentId: "estate", name: "Upper Floor", kind: "level", constructionId: "other-plan", transform: { x: 0, y: 0, rotation: 0 }, tags: [], access: [], properties: {} });
    project.constructions.push({
      id: "other-plan", revision: 0, walls: [{ id: "other-wall", start: { x: 0, y: 0 }, end: { x: 10, y: 0 }, role: "boundary", thickness: .2 }],
      rooms: [{ id: "other-room", faceId: "shared-face", name: "East Room", tags: [], access: [], properties: {} }],
      openings: [{ id: "shared-door", kind: "door", wallId: "other-wall", position: .5, width: 1 }], transitions: [],
    });
    project.constructions[0]!.rooms.push({ id: "west-room", faceId: "shared-face", name: "West Room", tags: [], access: [], properties: {} });
    project.constructions[0]!.openings.push({ id: "shared-door", kind: "door", wallId: "wall", position: .2, width: 1 });
    project.story.objects.push(
      { ref: { kind: "opening", id: "shared-door", scopeId: "plan" }, metadata: { narrativeLabel: "West door" } },
      { ref: { kind: "opening", id: "shared-door", scopeId: "other-plan" }, metadata: { narrativeLabel: "East door" } },
    );
    const formatter = createRouteDiagnosticFormatter(project, "en");

    expect(formatter.displayName("shared-door")).toBeUndefined();
    expect(formatter.displayName("shared-face")).toBeUndefined();
    expect(formatter.format("Opening shared-door has no 1 m clear portal in face shared-face.")).toBe("Opening shared-door has no 1 m clear portal in face shared-face.");
    expect(formatter.format("Opening missing is not available.")).toBe("Opening missing is not available.");
  });

  it("localizes known access diagnostics while preserving their ids as internal data", () => {
    const project = fixture(); const formatter = createRouteDiagnosticFormatter(project, "pl");

    expect(formatter.format("door-id: explicit-deny.")).toBe("Library threshold: Obowiązuje jawny zakaz dostępu.");
    expect(formatter.format("A key is required for door-id.")).toBe("Potrzebny jest klucz do obiektu „Library threshold”.");
    expect(formatter.format("No path with 1.2 m clearance was found between the requested endpoints.")).toBe("Nie znaleziono przejścia o szerokości 1.2 m między wskazanymi punktami.");
    expect(project.story.objects[0]!.ref.id).toBe("door-id");
  });
});
