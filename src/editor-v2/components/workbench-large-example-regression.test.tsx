import fs from "node:fs";
import path from "node:path";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { parseProjectFile } from "../persistence/project-file";
import { storyDataSchema } from "../story/schema";
import { EditorSession } from "../state/editor-session";
import { useWorkbenchStory } from "./use-workbench-story";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const source = fs.readFileSync(path.join(process.cwd(), "public/examples/residence-of-the-silver-lindens.cartographer.json"), "utf8");
const maxFullStoryValidationsPerRender = 8;

function StoryReadHarness({ session }: { session: EditorSession }) {
  const snapshot = session.getViewState();
  useWorkbenchStory({
    session,
    snapshot,
    selections: [],
    inspectedPlaceId: snapshot.activePlaceId,
    locale: "en",
    mode: "drawing",
    refresh: vi.fn(),
    zoom: 6,
    onSelect: vi.fn(),
    onFocus: vi.fn(() => false),
    onOpenPlace: vi.fn(),
    onOpenWorldbook: vi.fn(),
  });
  return <output>large example ready</output>;
}

afterEach(() => vi.restoreAllMocks());

describe("large example Story read regression", () => {
  it("mounts the representative project without revalidating the complete Story for every map object", () => {
    const project = parseProjectFile(source).project;
    const activePlaceId = project.places.find(({ parentId }) => !parentId)?.id;
    const session = new EditorSession(project, { initialPlaceId: activePlaceId });
    const originalSafeParse = storyDataSchema.safeParse.bind(storyDataSchema);
    let fullValidations = 0;
    vi.spyOn(storyDataSchema, "safeParse").mockImplementation((...args) => {
      fullValidations += 1;
      if (fullValidations > maxFullStoryValidationsPerRender) {
        throw new Error(`A single Story read attempted more than ${maxFullStoryValidationsPerRender} complete schema validations.`);
      }
      return originalSafeParse(...args);
    });

    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    try {
      expect(() => act(() => root.render(<StoryReadHarness session={session}/>))).not.toThrow();
      expect(host.textContent).toContain("large example ready");
      expect(fullValidations).toBeLessThanOrEqual(maxFullStoryValidationsPerRender);
    } finally {
      act(() => root.unmount());
      host.remove();
    }
  }, 15_000);
});
