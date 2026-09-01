"use client";

import { useId, useState, type ReactNode, type SyntheticEvent } from "react";
import styles from "./story-workbench.module.css";

export type StoryDisclosureSection = "tree" | "zones" | "worldbook" | "lenses";

type StoryDisclosureBookLabels = Record<StoryDisclosureSection, string>;

type StoryDisclosureBookProps = {
  labels: StoryDisclosureBookLabels;
  tree: ReactNode;
  zones: ReactNode;
  worldbook: ReactNode;
  lenses: ReactNode;
  visibleSections?: readonly StoryDisclosureSection[];
  defaultOpen?: Partial<Record<StoryDisclosureSection, boolean>>;
  openSections?: Partial<Record<StoryDisclosureSection, boolean>>;
  onOpenSectionsChange?(sections: Record<StoryDisclosureSection, boolean>): void;
  onOpenChange?(section: StoryDisclosureSection, open: boolean): void;
};

const sections: readonly StoryDisclosureSection[] = ["tree", "zones", "worldbook", "lenses"];

export function StoryDisclosureBook({ labels, tree, zones, worldbook, lenses, visibleSections = sections, defaultOpen, openSections, onOpenSectionsChange, onOpenChange }: StoryDisclosureBookProps) {
  const idPrefix = useId();
  const content = { tree, zones, worldbook, lenses } satisfies Record<StoryDisclosureSection, ReactNode>;
  const [internalOpenSections, setInternalOpenSections] = useState<Record<StoryDisclosureSection, boolean>>(() => Object.fromEntries(
    sections.map((section) => [section, defaultOpen?.[section] ?? (section === "tree" || section === "zones")]),
  ) as Record<StoryDisclosureSection, boolean>);
  const visibleOpenSections = sections.reduce((result, section) => {
    result[section] = openSections?.[section] ?? internalOpenSections[section];
    return result;
  }, {} as Record<StoryDisclosureSection, boolean>);

  function handleToggle(section: StoryDisclosureSection, event: SyntheticEvent<HTMLDetailsElement>) {
    const open = event.currentTarget.open;
    const previous = visibleOpenSections;
    if (previous[section] === open) return;
    const next = { ...previous, [section]: open };
    if (openSections?.[section] === undefined) setInternalOpenSections(next);
    onOpenSectionsChange?.(next);
    onOpenChange?.(section, open);
  }

  return <aside className={styles.disclosureBook} aria-label={labels.tree}>
    {sections.filter((section) => visibleSections.includes(section)).map((section) => {
      const contentId = `${idPrefix}-${section}`;
      return <details className={styles.disclosureSection} key={section} open={visibleOpenSections[section]} onToggle={(event) => handleToggle(section, event)}>
        <summary className={styles.disclosureSummary} aria-controls={contentId} aria-expanded={visibleOpenSections[section]}>{labels[section]}</summary>
        <div id={contentId} className={styles.disclosureContent}>{content[section]}</div>
      </details>;
    })}
  </aside>;
}
