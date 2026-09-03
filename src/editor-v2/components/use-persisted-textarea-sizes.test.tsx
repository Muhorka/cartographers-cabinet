import { act, useRef } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { textareaSizeStorageKey, usePersistedTextareaSizes } from "./use-persisted-textarea-sizes";

type ResizeCallback = (entries: Array<{ target: Element; contentRect: { height: number } }>) => void;
class FakeResizeObserver {
  static instances: FakeResizeObserver[] = [];
  private readonly callback: ResizeCallback;
  private target?: Element;
  constructor(callback: ResizeCallback) { this.callback = callback; FakeResizeObserver.instances.push(this); }
  observe(target: Element) { this.target = target; }
  disconnect() { this.target = undefined; }
  emit(height: number) { if (this.target) this.callback([{ target: this.target, contentRect: { height } }]); }
}

function Harness({ projectId }: { projectId: string }) {
  const root = useRef<HTMLDivElement>(null);
  usePersistedTextareaSizes(root, projectId);
  return <div ref={root}><textarea data-textarea-size-key="story-entry:anna:description" rows={4}/></div>;
}

describe("manual textarea size persistence", () => {
  let host: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(() => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    vi.stubGlobal("ResizeObserver", FakeResizeObserver);
    localStorage.clear();
    FakeResizeObserver.instances = [];
    host = document.createElement("div"); document.body.append(host); root = createRoot(host);
  });

  afterEach(() => { act(() => root.unmount()); host.remove(); vi.unstubAllGlobals(); localStorage.clear(); });

  it("stores the browser-resized used height and restores it only for that project", () => {
    act(() => root.render(<Harness projectId="estate"/>));
    act(() => FakeResizeObserver.instances[0]!.emit(180));
    act(() => root.unmount());
    expect(localStorage.getItem(textareaSizeStorageKey("estate"))).toContain("180px");

    root = createRoot(host);
    act(() => root.render(<Harness projectId="other"/>));
    expect((host.querySelector("textarea") as HTMLTextAreaElement).style.height).toBe("");
    act(() => root.unmount());

    root = createRoot(host);
    act(() => root.render(<Harness projectId="estate"/>));
    expect((host.querySelector("textarea") as HTMLTextAreaElement).style.height).toBe("180px");
  });
});
