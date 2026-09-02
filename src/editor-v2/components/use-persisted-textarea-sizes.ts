"use client";

import { useEffect, type RefObject } from "react";

const storagePrefix = "cartographer-textarea-sizes:";
const validHeight = /^(?:[3-9]\d|[1-9]\d{2}|1\d{3}|2000)(?:\.\d+)?px$/;

export function textareaSizeStorageKey(projectId: string) {
  return `${storagePrefix}${projectId}`;
}

export function parseTextareaSizes(value: string | null): Record<string, string> {
  if (!value) return {};
  try {
    const parsed: unknown = JSON.parse(value);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return Object.fromEntries(Object.entries(parsed).filter((entry): entry is [string, string] => typeof entry[1] === "string" && validHeight.test(entry[1])));
  } catch {
    return {};
  }
}

function textareaKey(field: HTMLTextAreaElement) {
  if (field.dataset.textareaSizeKey) return field.dataset.textareaSizeKey;
  const label = field.closest("label");
  const caption = label?.querySelector(":scope > span")?.textContent?.trim()
    ?? [...(label?.childNodes ?? [])].find(({ nodeType, textContent }) => nodeType === Node.TEXT_NODE && textContent?.trim())?.textContent?.trim();
  return caption ? `label:${caption}` : undefined;
}

/** Retains user-resized textarea heights as a browser-local preference for one project. */
export function usePersistedTextareaSizes(root: RefObject<HTMLElement | null>, projectId?: string) {
  useEffect(() => {
    const host = root.current;
    if (!host || !projectId || typeof ResizeObserver === "undefined") return;
    const storageKey = textareaSizeStorageKey(projectId);
    let stored: string | null = null;
    try { stored = localStorage.getItem(storageKey); } catch { /* Preferences must never block editing. */ }
    const sizes = parseTextareaSizes(stored);
    let saveTimer: number | undefined;
    const saveSoon = () => {
      if (saveTimer !== undefined) window.clearTimeout(saveTimer);
      saveTimer = window.setTimeout(() => {
        saveTimer = undefined;
        try { localStorage.setItem(storageKey, JSON.stringify(sizes)); } catch { /* Preferences must never block editing. */ }
      }, 120);
    };
    const resizeObserver = new ResizeObserver((entries) => {
      let changed = false;
      for (const { target } of entries) {
        const textarea = target as HTMLTextAreaElement;
        const key = textareaKey(textarea);
        const height = textarea.style.height;
        if (!key || !validHeight.test(height) || sizes[key] === height) continue;
        sizes[key] = height;
        changed = true;
      }
      if (changed) saveSoon();
    });
    const observeField = (field: HTMLTextAreaElement) => {
      const key = textareaKey(field);
      if (!key) return;
      const saved = sizes[key];
      if (saved) field.style.height = saved;
      resizeObserver.observe(field);
    };
    host.querySelectorAll<HTMLTextAreaElement>("textarea").forEach(observeField);
    const mutationObserver = new MutationObserver((records) => {
      for (const record of records) {
        if (record.type === "attributes" && record.target instanceof HTMLTextAreaElement) observeField(record.target);
        record.addedNodes.forEach((node) => {
          if (!(node instanceof HTMLElement)) return;
          if (node instanceof HTMLTextAreaElement) observeField(node);
          node.querySelectorAll<HTMLTextAreaElement>("textarea").forEach(observeField);
        });
      }
    });
    mutationObserver.observe(host, { childList: true, subtree: true, attributes: true, attributeFilter: ["data-textarea-size-key"] });
    return () => {
      mutationObserver.disconnect();
      resizeObserver.disconnect();
      if (saveTimer !== undefined) {
        window.clearTimeout(saveTimer);
        try { localStorage.setItem(storageKey, JSON.stringify(sizes)); } catch { /* Preferences must never block editing. */ }
      }
    };
  }, [projectId, root]);
}
