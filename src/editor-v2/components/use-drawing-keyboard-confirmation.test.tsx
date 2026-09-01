import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { useDrawingKeyboardConfirmation } from "./use-drawing-keyboard-confirmation";

function Harness({ instrument, onPen, onMulti }: { instrument: "pen" | "wall-run"; onPen(): void; onMulti(): void }) {
  useDrawingKeyboardConfirmation(instrument, onPen, onMulti);
  return <div/>;
}

describe("drawing keyboard confirmation", () => {
  it("confirms a wall run with Enter even when the map does not own focus", () => {
    const container = document.createElement("div"); document.body.appendChild(container); const root = createRoot(container); const onMulti = vi.fn();
    act(() => root.render(<Harness instrument="wall-run" onPen={vi.fn()} onMulti={onMulti}/>));
    act(() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" })));
    expect(onMulti).toHaveBeenCalledOnce();
    act(() => root.unmount()); container.remove();
  });

  it("does not steal Enter from an inspector control", () => {
    const container = document.createElement("div"); document.body.appendChild(container); const root = createRoot(container); const onMulti = vi.fn();
    act(() => root.render(<Harness instrument="wall-run" onPen={vi.fn()} onMulti={onMulti}/>));
    const input = document.createElement("input"); document.body.appendChild(input);
    act(() => input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true })));
    expect(onMulti).not.toHaveBeenCalled();
    input.remove(); act(() => root.unmount()); container.remove();
  });
});
