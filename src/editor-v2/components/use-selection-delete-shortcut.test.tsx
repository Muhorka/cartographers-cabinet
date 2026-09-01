import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { useSelectionDeleteShortcut } from "./use-selection-delete-shortcut";

it("deletes the selection from a focused tool, but ignores text editing and handled events", () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const remove = vi.fn(); const host = document.createElement("div"); document.body.append(host); const root = createRoot(host);
  function Test() { useSelectionDeleteShortcut(remove); return <><button>Tool</button><input/><textarea/><div contentEditable suppressContentEditableWarning>Note</div></>; }
  try {
    act(() => root.render(<Test/>));
    const key = () => new KeyboardEvent("keydown", { key: "Delete", bubbles: true, cancelable: true });
    act(() => host.querySelector("button")!.dispatchEvent(key())); expect(remove).toHaveBeenCalledTimes(1);
    for (const target of host.querySelectorAll('input, textarea, [contenteditable]')) act(() => target.dispatchEvent(key()));
    const handled = key(); handled.preventDefault(); act(() => host.querySelector("button")!.dispatchEvent(handled));
    expect(remove).toHaveBeenCalledTimes(1);
  } finally { act(() => root.unmount()); host.remove(); vi.unstubAllGlobals(); }
});
