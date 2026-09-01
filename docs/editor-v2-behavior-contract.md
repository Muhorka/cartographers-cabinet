# Editor v2 behavior contract

The editor must select behavior from an object's capabilities, not from one-off subject identifiers.

Canonical sources:

- names: `src/editor-v2/i18n/object-naming.ts`;
- visible and available layers/subjects: `src/editor-v2/model/work-context.ts` and `src/editor-v2/toolbox/toolbox-model.ts`;
- draft topology and automatic closure: `src/editor-v2/draft/`;
- region union: `src/editor-v2/geometry/region-union.ts`;
- erase dispatch and geometry: `src/editor-v2/drawing/semantic-eraser.ts`;
- selection transformations: `src/editor-v2/drawing/selection-operations.ts` and `selection-detail-operations.ts`;
- region labels: `src/editor-v2/components/map-sheet-region-label.tsx`;
- transitions between levels: one `VerticalTransition` record with explicit connected level ids.

Invariants:

1. A new subject joins an existing capability family and gets the same erase, selection, transform, merge, label, ownership and agent behavior.
2. A semantic draft may combine compatible instruments. Navigation never silently drops unfinished strokes.
3. Geometry clipped by its containing outline is handled automatically for strokes. A whole-object move may still require a deferred topology decision.
4. A union returns the actual combined geometry, including compound geometry when parts are disjoint; it never implements merge by deleting one selected object unchanged.
5. Current layer wins hit testing; within it, the deepest visible hierarchy item wins.
6. Human UI and agent commands use the same domain commands and validation rules.
7. `editor-v2` must not import behavior from the legacy editor checkpoint.

Intentional differences are allowed only as named domain rules. They must state why the subject differs, live in the shared domain command for that capability, and have a test comparing it with the default family behavior. Examples include openings attaching to walls, transitions connecting explicitly selected levels, and terrain being allowed to cross a location boundary. A subject-specific implementation of naming, selection, erasing, union or basic drafting is not an intentional difference.

Every repaired defect must add a family-level regression test, including at least one sibling subject where the defect could recur.
